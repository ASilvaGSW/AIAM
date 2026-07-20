const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  };
}

function getSiteUrl() {
  return (
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.SITE_URL ||
    "http://localhost:8888"
  );
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: {}, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return jsonResponse(500, { error: "STRIPE_SECRET_KEY is not configured" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) {
    return jsonResponse(400, { error: "Cart is empty" });
  }

  const supabase = getSupabase();
  const stripe = new Stripe(stripeKey);
  const lineItems = [];
  const cartMeta = [];

  for (const item of items) {
    const id = String(item.id);
    const qty = parseInt(item.qty, 10);

    if (!id || Number.isNaN(qty) || qty < 1) {
      return jsonResponse(400, { error: "Invalid cart item" });
    }

    const { data: product, error } = await supabase
      .from("products")
      .select("id, product_name, price, qty, stripe_price_id")
      .eq("id", id)
      .single();

    if (error || !product) {
      return jsonResponse(400, { error: "Product not found: " + id });
    }

    if (product.qty != null && product.qty < qty) {
      return jsonResponse(400, {
        error: "Not enough stock for " + product.product_name,
      });
    }

    cartMeta.push({ id: product.id, qty });

    if (product.stripe_price_id) {
      lineItems.push({ price: product.stripe_price_id, quantity: qty });
    } else {
      const unitAmount = Math.round(Number(product.price) * 100);
      if (!Number.isFinite(unitAmount) || unitAmount < 0) {
        return jsonResponse(400, { error: "Invalid price for " + product.product_name });
      }
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: product.product_name },
          unit_amount: unitAmount,
        },
        quantity: qty,
      });
    }
  }

  const siteUrl = getSiteUrl().replace(/\/$/, "");

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: siteUrl + "/products.html?paid=1",
      cancel_url: siteUrl + "/products.html?canceled=1",
      metadata: {
        source: "aiam-cart",
        cart: JSON.stringify(cartMeta),
      },
    });

    return jsonResponse(200, { url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return jsonResponse(500, { error: err.message || "Checkout failed" });
  }
};
