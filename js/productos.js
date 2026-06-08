(function () {
  "use strict";

  const STORAGE_KEY = "aiam-cart";

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
  const cartClear = document.getElementById("cartClear");
  const cartRequest = document.getElementById("cartRequest");

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

  function buildQuoteBody(items) {
    if (!items.length) return "";
    const lines = items.map(function (item) {
      return "- " + item.name + " x" + item.qty;
    });
    return encodeURIComponent(
      "Hello,\n\nI would like a quote for the following products:\n\n" +
        lines.join("\n") +
        "\n\nTotal items: " +
        getTotalQty(items) +
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
      const li = document.createElement("li");
      li.className = "cart-item";
      li.dataset.id = item.id;

      li.innerHTML =
        '<div class="cart-item-info">' +
        '<strong class="cart-item-name"></strong>' +
        "</div>" +
        '<div class="cart-item-controls">' +
        '<button type="button" class="cart-qty-btn" data-action="decrease" aria-label="Decrease quantity">−</button>' +
        '<span class="cart-item-qty"></span>' +
        '<button type="button" class="cart-qty-btn" data-action="increase" aria-label="Increase quantity">+</button>' +
        '<button type="button" class="cart-remove" data-action="remove" aria-label="Remove item">Remove</button>' +
        "</div>";

      li.querySelector(".cart-item-name").textContent = item.name;
      li.querySelector(".cart-item-qty").textContent = String(item.qty);
      cartList.appendChild(li);
    });

    if (cartTotalItems) cartTotalItems.textContent = String(totalQty);
    if (cartLineCount) cartLineCount.textContent = String(items.length);
    updateRequestLink(items);
  }

  function addToCart(id, name) {
    const items = loadCart();
    const existing = items.find(function (item) {
      return item.id === id;
    });

    if (existing) {
      existing.qty += 1;
    } else {
      items.push({ id: id, name: name, qty: 1 });
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

  function openCart() {
    if (!cartPanel || !cartOverlay) return;
    cartPanel.hidden = false;
    cartOverlay.hidden = false;
    document.body.classList.add("cart-open");
    if (cartToggle) cartToggle.setAttribute("aria-expanded", "true");
  }

  function closeCart() {
    if (!cartPanel || !cartOverlay) return;
    cartPanel.hidden = true;
    cartOverlay.hidden = true;
    document.body.classList.remove("cart-open");
    if (cartToggle) cartToggle.setAttribute("aria-expanded", "false");
  }

  document.querySelectorAll("[data-add-cart]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const card = btn.closest(".product-card");
      if (!card) return;
      addToCart(card.dataset.id, card.dataset.name);
      btn.textContent = "Added";
      btn.classList.add("is-added");
      setTimeout(function () {
        btn.textContent = "Add to cart";
        btn.classList.remove("is-added");
      }, 1200);
    });
  });

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

  if (cartToggle) cartToggle.addEventListener("click", openCart);
  if (cartClose) cartClose.addEventListener("click", closeCart);
  if (cartOverlay) cartOverlay.addEventListener("click", closeCart);
  if (cartClear) cartClear.addEventListener("click", clearCart);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeCart();
  });

  renderCart();
})();
