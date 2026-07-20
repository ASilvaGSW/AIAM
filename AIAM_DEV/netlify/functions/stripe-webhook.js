const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function decrementStock(supabase, cartItems) {
  for (const item of cartItems) {
    const id = String(item.id);
    const qty = parseInt(item.qty, 10);
    if (!id || Number.isNaN(qty) || qty < 1) continue;

    const { data: product } = await supabase
      .from("products")
      .select("id, qty")
      .eq("id", id)
      .single();

    if (!product) continue;

    const nextQty = Math.max(0, (product.qty || 0) - qty);
    await supabase.from("products").update({ qty: nextQty }).eq("id", id);
  }
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    console.error("Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return { statusCode: 500, body: "Webhook not configured" };
  }

  const stripe = new Stripe(stripeKey);
  const signature = event.headers["stripe-signature"];

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return { statusCode: 400, body: "Invalid signature" };
  }

  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;
    console.log("Payment completed:", session.id, session.amount_total);

    const supabase = getSupabase();
    if (supabase && session.metadata && session.metadata.cart) {
      try {
        const cartItems = JSON.parse(session.metadata.cart);
        await decrementStock(supabase, cartItems);
        console.log("Stock updated for session:", session.id);
      } catch (err) {
        console.error("Failed to update stock:", err);
      }
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ received: true }),
  };
};
