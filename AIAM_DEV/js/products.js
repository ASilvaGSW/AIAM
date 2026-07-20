(function () {
  "use strict";

  const STORAGE_KEY = "aiam-cart";
  const DEFAULT_PRODUCT_IMAGE = "src/img/card_wire.png";

  const SUPABASE_URL = "https://eoztsaelpvqhkkgzpkzp.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvenRzYWVscHZxaGtrZ3pwa3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NDA4NjksImV4cCI6MjA5NzIxNjg2OX0.hLQO6WWaEPDUjZSuHXjsWXPVS9zp16GGXTRXx7Lu7o0";
  const PRODUCTS_API = SUPABASE_URL + "/rest/v1/products";
  const API_HEADERS = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: "Bearer " + SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
  };

  const productsGrid = document.getElementById("productsGrid");
  const productsStatus = document.getElementById("productsStatus");
  const cartToggle = document.getElementById("cartToggle");
  const cartBadge = document.getElementById("cartBadge");
  const cartOverlay = document.getElementById("cartOverlay");
  const cartPanel = document.getElementById("cartPanel");
  const cartClose = document.getElementById("cartClose");
  const cartList = document.getElementById("cartList");
  const cartEmpty = document.getElementById("cartEmpty");
  const cartSummary = document.getElementById("cartSummary");
  const cartTotalItems = document.getElementById("cartTotalItems");
  const cartLineCount = document.getElementById("cartLineCount");
  const cartTotalCost = document.getElementById("cartTotalCost");
  const cartClear = document.getElementById("cartClear");
  const cartRequest = document.getElementById("cartRequest");
  const cartCheckout = document.getElementById("cartCheckout");
  const paymentBanner = document.getElementById("paymentBanner");
  const CHECKOUT_API = "/.netlify/functions/create-checkout";

  function formatCurrency(amount) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount || 0);
  }

  function parsePrice(value) {
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 ? num : 0;
  }

  function getProductImageUrl(row) {
    const image = row && row.image != null ? String(row.image).trim() : "";
    return image || DEFAULT_PRODUCT_IMAGE;
  }

  function loadCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveCart(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function getTotalQty(items) {
    return items.reduce(function (sum, item) {
      return sum + item.qty;
    }, 0);
  }

  function getTotalCost(items) {
    return items.reduce(function (sum, item) {
      return sum + parsePrice(item.price) * item.qty;
    }, 0);
  }

  function buildQuoteBody(items) {
    if (!items.length) return "";
    const lines = items.map(function (item) {
      const lineTotal = parsePrice(item.price) * item.qty;
      return (
        "- " +
        item.name +
        " x" +
        item.qty +
        " @ " +
        formatCurrency(item.price) +
        " = " +
        formatCurrency(lineTotal)
      );
    });
    return encodeURIComponent(
      "Hello,\n\nI would like a quote for the following products:\n\n" +
        lines.join("\n") +
        "\n\nTotal items: " +
        getTotalQty(items) +
        "\nEstimated total: " +
        formatCurrency(getTotalCost(items)) +
        "\n\nThank you."
    );
  }

  function updateRequestLink(items) {
    if (!cartRequest) return;
    const base = "mailto:kenjin@aiam-tech.com?subject=Product%20quote%20request";
    cartRequest.href = items.length ? base + "&body=" + buildQuoteBody(items) : base;
  }

  function renderCart() {
    const items = loadCart();
    const totalQty = getTotalQty(items);
    const totalCost = getTotalCost(items);

    if (cartBadge) {
      cartBadge.textContent = String(totalQty);
      cartBadge.hidden = totalQty === 0;
    }

    if (!cartList || !cartEmpty || !cartSummary) return;

    cartList.innerHTML = "";

    if (!items.length) {
      cartEmpty.hidden = false;
      cartSummary.hidden = true;
      updateRequestLink(items);
      return;
    }

    cartEmpty.hidden = true;
    cartSummary.hidden = false;

    items.forEach(function (item) {
      const price = parsePrice(item.price);
      const lineTotal = price * item.qty;
      const li = document.createElement("li");
      li.className = "cart-item";
      li.dataset.id = item.id;

      li.innerHTML =
        '<div class="cart-item-info">' +
        '<strong class="cart-item-name"></strong>' +
        '<p class="cart-item-price"></p>' +
        "</div>" +
        '<div class="cart-item-controls">' +
        '<button type="button" class="cart-qty-btn" data-action="decrease" aria-label="Decrease quantity">−</button>' +
        '<span class="cart-item-qty"></span>' +
        '<button type="button" class="cart-qty-btn" data-action="increase" aria-label="Increase quantity">+</button>' +
        '<button type="button" class="cart-remove" data-action="remove" aria-label="Remove item">Remove</button>' +
        "</div>";

      li.querySelector(".cart-item-name").textContent = item.name;
      li.querySelector(".cart-item-price").textContent =
        formatCurrency(price) + " each · " + formatCurrency(lineTotal);
      li.querySelector(".cart-item-qty").textContent = String(item.qty);
      cartList.appendChild(li);
    });

    if (cartTotalItems) cartTotalItems.textContent = String(totalQty);
    if (cartLineCount) cartLineCount.textContent = String(items.length);
    if (cartTotalCost) cartTotalCost.textContent = formatCurrency(totalCost);
    updateRequestLink(items);
  }

  function addToCart(id, name, price) {
    const items = loadCart();
    const unitPrice = parsePrice(price);
    const existing = items.find(function (item) {
      return item.id === id;
    });

    if (existing) {
      existing.qty += 1;
      existing.price = unitPrice;
      existing.name = name;
    } else {
      items.push({ id: id, name: name, qty: 1, price: unitPrice });
    }

    saveCart(items);
    renderCart();
  }

  function changeQty(id, delta) {
    const items = loadCart();
    const item = items.find(function (entry) {
      return entry.id === id;
    });
    if (!item) return;

    item.qty += delta;
    const next = items.filter(function (entry) {
      return entry.qty > 0;
    });

    saveCart(next);
    renderCart();
  }

  function removeItem(id) {
    const items = loadCart().filter(function (entry) {
      return entry.id !== id;
    });
    saveCart(items);
    renderCart();
  }

  function clearCart() {
    saveCart([]);
    renderCart();
  }

  function showPaymentBanner(message, type) {
    if (!paymentBanner) return;
    paymentBanner.textContent = message;
    paymentBanner.className = "payment-banner payment-banner--" + type;
    paymentBanner.hidden = false;
  }

  function handlePaymentReturn() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "1") {
      showPaymentBanner("Payment successful. Thank you for your order.", "success");
      clearCart();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("canceled") === "1") {
      showPaymentBanner("Checkout canceled. Your cart is still saved.", "canceled");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }

  async function startStripeCheckout() {
    const items = loadCart();
    if (!items.length || !cartCheckout) return;

    cartCheckout.disabled = true;
    const label = cartCheckout.textContent;
    cartCheckout.textContent = "Redirecting…";

    try {
      const response = await fetch(CHECKOUT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(function (item) {
            return { id: item.id, qty: item.qty };
          }),
        }),
      });

      const data = await response.json().catch(function () {
        return {};
      });

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Could not start checkout");
      }

      window.location.href = data.url;
    } catch (err) {
      console.error("Checkout error:", err);
      alert(err.message || "Checkout is not available. Try Request quote instead.");
      cartCheckout.disabled = false;
      cartCheckout.textContent = label;
    }
  }

  function setCartOpenState(isOpen) {
    if (!cartToggle) return;
    cartToggle.setAttribute("aria-expanded", String(isOpen));
    cartToggle.setAttribute("aria-label", isOpen ? "Close cart" : "Open cart");
  }

  function openCart() {
    if (!cartPanel || !cartOverlay) return;
    cartPanel.hidden = false;
    cartOverlay.hidden = false;
    document.body.classList.add("cart-open");
    setCartOpenState(true);
  }

  function closeCart() {
    if (!cartPanel || !cartOverlay) return;
    cartPanel.hidden = true;
    cartOverlay.hidden = true;
    document.body.classList.remove("cart-open");
    setCartOpenState(false);
  }

  function toggleCart() {
    if (cartPanel && !cartPanel.hidden) {
      closeCart();
    } else {
      openCart();
    }
  }

  function setProductsStatus(message, type) {
    if (!productsStatus) return;
    productsStatus.hidden = false;
    productsStatus.textContent = message;
    productsStatus.className = "products-status" + (type ? " " + type : "");
    if (productsGrid) productsGrid.hidden = true;
  }

  function createProductCard(row) {
    const id = String(row.id);
    const name = row.product_name || "Product";
    const stockQty = row.qty != null ? row.qty : 0;
    const price = parsePrice(row.price);

    const article = document.createElement("article");
    article.className = "product-card";
    article.dataset.id = id;
    article.dataset.name = name;
    article.dataset.price = String(price);

    const photo = document.createElement("div");
    photo.className = "product-photo";
    const img = document.createElement("img");
    img.src = getProductImageUrl(row);
    img.alt = name;
    photo.appendChild(img);

    const badge = document.createElement("span");
    badge.className =
      "product-badge" + (stockQty > 0 ? " product-badge--stock" : " product-badge--quote");
    badge.textContent = stockQty > 0 ? "In stock · " + stockQty : "Quote";

    const body = document.createElement("div");
    body.className = "product-body";

    const top = document.createElement("div");
    top.className = "product-top";

    const title = document.createElement("h3");
    title.textContent = name;

    const priceEl = document.createElement("span");
    priceEl.className = "product-price";
    priceEl.textContent = formatCurrency(price);

    top.appendChild(title);
    top.appendChild(priceEl);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-add-cart";
    btn.setAttribute("data-add-cart", "");
    btn.innerHTML =
      '<span>Add to cart</span>' +
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<path d="M12 5v14M5 12h14" />' +
      "</svg>";

    photo.appendChild(badge);
    body.appendChild(top);
    body.appendChild(btn);

    article.appendChild(photo);
    article.appendChild(body);

    return article;
  }

  function renderProductCards(products) {
    if (!productsGrid) return;

    productsGrid.innerHTML = "";

    if (!products.length) {
      setProductsStatus("No products available at the moment.", "empty");
      return;
    }

    if (productsStatus) productsStatus.hidden = true;
    productsGrid.hidden = false;

    products.forEach(function (row) {
      productsGrid.appendChild(createProductCard(row));
    });
  }

  async function fetchProducts() {
    const response = await fetch(
      PRODUCTS_API + "?select=id,created_at,product_name,qty,price,image&order=created_at.desc",
      {
        method: "GET",
        headers: API_HEADERS,
      }
    );

    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    if (!response.ok) {
      const msg =
        (body && body.message) ||
        (typeof body === "string" ? body : JSON.stringify(body));
      throw new Error(response.status + " — " + msg);
    }

    return Array.isArray(body) ? body : [];
  }

  async function loadProducts() {
    setProductsStatus("Loading products…", "loading");

    try {
      const products = await fetchProducts();
      renderProductCards(products);
    } catch (err) {
      setProductsStatus("Could not load products. Please try again later.", "error");
      console.error("Products load error:", err);
    }
  }

  if (productsGrid) {
    productsGrid.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-add-cart]");
      if (!btn) return;

      const card = btn.closest(".product-card");
      if (!card) return;

      addToCart(card.dataset.id, card.dataset.name, card.dataset.price);
      const label = btn.querySelector("span");
      if (label) label.textContent = "Added";
      btn.classList.add("is-added");
      setTimeout(function () {
        if (label) label.textContent = "Add to cart";
        btn.classList.remove("is-added");
      }, 1200);
    });
  }

  if (cartList) {
    cartList.addEventListener("click", function (e) {
      const actionBtn = e.target.closest("[data-action]");
      if (!actionBtn) return;

      const itemEl = actionBtn.closest(".cart-item");
      if (!itemEl) return;
      const id = itemEl.dataset.id;
      const action = actionBtn.dataset.action;

      if (action === "increase") changeQty(id, 1);
      if (action === "decrease") changeQty(id, -1);
      if (action === "remove") removeItem(id);
    });
  }

  if (cartToggle) cartToggle.addEventListener("click", toggleCart);
  if (cartClose) cartClose.addEventListener("click", closeCart);
  if (cartOverlay) cartOverlay.addEventListener("click", closeCart);
  if (cartClear) cartClear.addEventListener("click", clearCart);
  if (cartCheckout) cartCheckout.addEventListener("click", startStripeCheckout);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeCart();
  });

  const navToggle = document.getElementById("navToggle");
  const mainNav = document.getElementById("mainNav");
  if (navToggle && mainNav) {
    navToggle.addEventListener("click", function () {
      const open = mainNav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(open));
    });
  }

  handlePaymentReturn();
  renderCart();
  loadProducts();
})();
