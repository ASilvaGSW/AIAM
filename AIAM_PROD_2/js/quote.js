/* AIAM Quotation Builder
   Editor state -> live document preview -> print / PDF.
   Layout and wording follow Quotes/AIAM_Quotation_Template.xlsx */
(function () {
  "use strict";

  const DRAFT_KEY = "aiam.quote.draft";
  const SEQ_PREFIX = "aiam.quote.seq.";

  const DEFAULT_TERMS = [
    "Payment due in 14 days",
    "Sales tax not collected for out-of-state shipment",
    "Payment accepted by ACH, company check, or credit card payment link upon request.",
    "Manufacturer warranty applies. AIAM will support supplier communication for warranty or replacement coordination.",
  ].join("\n");

  const DEFAULT_FOOTER =
    "If you have any questions concerns contact KenJin@aiam-tech.com, +1 956-995-0007";

  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });

  /* ---------- Dates (built from parts so the local day never shifts) ---------- */

  function todayISO() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function parseISO(iso) {
    const parts = String(iso || "").split("-").map(Number);
    if (parts.length !== 3 || parts.some(function (n) { return !n; })) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatDate(date) {
    if (!date) return "";
    return date.getMonth() + 1 + "/" + date.getDate() + "/" + date.getFullYear();
  }

  function addDays(date, days) {
    const d = new Date(date.getTime());
    d.setDate(d.getDate() + days);
    return d;
  }

  /* ---------- State ---------- */

  function nextQuoteNumber() {
    const year = new Date().getFullYear();
    const key = SEQ_PREFIX + year;
    let seq = 1;
    try {
      seq = (parseInt(localStorage.getItem(key), 10) || 0) + 1;
      localStorage.setItem(key, String(seq));
    } catch (e) {
      seq = 1;
    }
    return "QTN-" + year + "-" + String(seq).padStart(4, "0");
  }

  function emptyItem() {
    return { qty: "1", desc: "", unit: "" };
  }

  function freshState() {
    return {
      number: nextQuoteNumber(),
      date: todayISO(),
      validDays: 14,
      contact: "",
      company: "",
      addr1: "",
      addr2: "",
      items: [emptyItem()],
      taxRate: 0,
      shipping: 0,
      terms: DEFAULT_TERMS,
      footer: DEFAULT_FOOTER,
    };
  }

  function normalize(raw) {
    const base = {
      number: "",
      date: todayISO(),
      validDays: 14,
      contact: "",
      company: "",
      addr1: "",
      addr2: "",
      items: [],
      taxRate: 0,
      shipping: 0,
      terms: DEFAULT_TERMS,
      footer: DEFAULT_FOOTER,
    };
    const s = Object.assign(base, raw || {});
    s.items = Array.isArray(s.items) && s.items.length
      ? s.items.map(function (it) {
          return {
            qty: it && it.qty != null ? String(it.qty) : "",
            desc: it && it.desc != null ? String(it.desc) : "",
            unit: it && it.unit != null ? String(it.unit) : "",
          };
        })
      : [emptyItem()];
    return s;
  }

  let state = null;

  /* ---------- Money helpers ---------- */

  /* A unit price is either a number or a label such as "Included",
     which the template prints as text with a $0.00 amount. */
  function parseUnit(raw) {
    const text = String(raw == null ? "" : raw).trim();
    if (!text) return { label: "", value: 0, numeric: false };
    const cleaned = text.replace(/[$,\s]/g, "");
    if (cleaned !== "" && isFinite(Number(cleaned))) {
      const value = Number(cleaned);
      return { label: money.format(value), value: value, numeric: true };
    }
    return { label: text, value: 0, numeric: false };
  }

  function toNumber(raw) {
    const n = Number(String(raw == null ? "" : raw).replace(/[$,\s%]/g, ""));
    return isFinite(n) ? n : 0;
  }

  function itemAmount(item) {
    const unit = parseUnit(item.unit);
    return unit.numeric ? toNumber(item.qty) * unit.value : 0;
  }

  function calcTotals() {
    const subtotal = state.items.reduce(function (sum, it) {
      return sum + itemAmount(it);
    }, 0);
    const tax = subtotal * (toNumber(state.taxRate) / 100);
    const shipping = toNumber(state.shipping);
    return {
      subtotal: subtotal,
      tax: tax,
      shipping: shipping,
      total: subtotal + tax + shipping,
    };
  }

  /* ---------- Elements ---------- */

  const el = {};
  [
    "quoteForm", "fNumber", "fDate", "fValidDays", "fValidUntil",
    "fContact", "fCompany", "fAddr1", "fAddr2",
    "itemRows", "btnAddItem",
    "fTaxRate", "fShipping",
    "rSubtotal", "rTax", "rShipping", "rTotal",
    "fTerms", "fFooter",
    "docContact", "docCompany", "docAddr1", "docAddr2",
    "docNumber", "docDate", "docValid", "docItems",
    "docSubtotal", "docTax", "docShipping", "docTotal",
    "docTerms", "docFooter",
    "sheet", "sheetFrame", "sheetScaler", "preview",
    "saveState", "btnNew", "btnPrint", "btnExport", "btnImport", "fileImport",
  ].forEach(function (id) {
    el[id] = document.getElementById(id);
  });
  el.preview = document.querySelector(".preview");

  /* ---------- Editor: line item rows ---------- */

  function buildItemRows() {
    el.itemRows.textContent = "";
    state.items.forEach(function (item, index) {
      const row = document.createElement("div");
      row.className = "item-row";
      row.dataset.index = String(index);

      const qty = document.createElement("input");
      qty.type = "number";
      qty.min = "0";
      qty.step = "1";
      qty.className = "i-in-qty";
      qty.dataset.key = "qty";
      qty.value = item.qty;
      qty.setAttribute("aria-label", "Quantity for line " + (index + 1));

      const desc = document.createElement("textarea");
      desc.rows = 2;
      desc.className = "i-in-desc";
      desc.dataset.key = "desc";
      desc.value = item.desc;
      desc.placeholder = "Item description";
      desc.setAttribute("aria-label", "Description for line " + (index + 1));

      const unit = document.createElement("input");
      unit.type = "text";
      unit.className = "i-in-unit";
      unit.dataset.key = "unit";
      unit.value = item.unit;
      unit.placeholder = "0.00";
      unit.setAttribute("aria-label", "Unit price for line " + (index + 1));

      const amount = document.createElement("span");
      amount.className = "item-amount";
      amount.textContent = money.format(itemAmount(item));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "item-remove";
      remove.dataset.action = "remove";
      remove.title = "Remove line";
      remove.setAttribute("aria-label", "Remove line " + (index + 1));
      remove.innerHTML =
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">' +
        '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>';

      row.append(qty, desc, unit, amount, remove);
      el.itemRows.appendChild(row);
    });
  }

  el.itemRows.addEventListener("input", function (event) {
    const input = event.target;
    const key = input.dataset.key;
    const row = input.closest(".item-row");
    if (!key || !row) return;

    const index = Number(row.dataset.index);
    state.items[index][key] = input.value;

    const amount = row.querySelector(".item-amount");
    if (amount) amount.textContent = money.format(itemAmount(state.items[index]));

    renderDoc();
    queueSave();
  });

  el.itemRows.addEventListener("click", function (event) {
    const button = event.target.closest('[data-action="remove"]');
    if (!button) return;
    const index = Number(button.closest(".item-row").dataset.index);
    state.items.splice(index, 1);
    if (!state.items.length) state.items.push(emptyItem());
    buildItemRows();
    renderDoc();
    queueSave();
  });

  el.btnAddItem.addEventListener("click", function () {
    state.items.push(emptyItem());
    buildItemRows();
    renderDoc();
    queueSave();
    const rows = el.itemRows.querySelectorAll(".item-row");
    const last = rows[rows.length - 1];
    if (last) last.querySelector(".i-in-desc").focus();
  });

  /* ---------- Editor: simple fields ---------- */

  const FIELD_MAP = {
    fNumber: "number",
    fDate: "date",
    fValidDays: "validDays",
    fContact: "contact",
    fCompany: "company",
    fAddr1: "addr1",
    fAddr2: "addr2",
    fTaxRate: "taxRate",
    fShipping: "shipping",
    fTerms: "terms",
    fFooter: "footer",
  };

  Object.keys(FIELD_MAP).forEach(function (id) {
    el[id].addEventListener("input", function () {
      state[FIELD_MAP[id]] = el[id].value;
      renderDoc();
      queueSave();
    });
  });

  function fillEditor() {
    Object.keys(FIELD_MAP).forEach(function (id) {
      el[id].value = state[FIELD_MAP[id]];
    });
    buildItemRows();
  }

  /* ---------- Render the document ---------- */

  function validUntilDate() {
    const start = parseISO(state.date);
    if (!start) return null;
    const days = Math.max(0, Math.round(toNumber(state.validDays)));
    return addDays(start, days);
  }

  function renderDoc() {
    el.docContact.textContent = state.contact;
    el.docCompany.textContent = state.company;
    el.docAddr1.textContent = state.addr1;
    el.docAddr2.textContent = state.addr2;

    el.docNumber.textContent = state.number;
    el.docDate.textContent = formatDate(parseISO(state.date));

    const until = validUntilDate();
    el.docValid.textContent = formatDate(until);
    el.fValidUntil.textContent = until ? formatDate(until) : "—";

    el.docItems.textContent = "";
    state.items.forEach(function (item) {
      const hasContent = item.desc.trim() || item.unit.trim();
      if (!hasContent) return;

      const unit = parseUnit(item.unit);
      const tr = document.createElement("tr");

      const qty = document.createElement("td");
      qty.className = "i-qty";
      qty.textContent = item.qty;

      const desc = document.createElement("td");
      desc.className = "i-desc";
      desc.textContent = item.desc;

      const unitCell = document.createElement("td");
      unitCell.className = "i-unit";
      unitCell.textContent = unit.label;

      const amountCell = document.createElement("td");
      amountCell.className = "i-amt";
      amountCell.textContent = money.format(itemAmount(item));

      tr.append(qty, desc, unitCell, amountCell);
      el.docItems.appendChild(tr);
    });

    const totals = calcTotals();
    el.docSubtotal.textContent = money.format(totals.subtotal);
    el.docTax.textContent = money.format(totals.tax);
    el.docShipping.textContent = money.format(totals.shipping);
    el.docTotal.textContent = money.format(totals.total);

    el.rSubtotal.textContent = money.format(totals.subtotal);
    el.rTax.textContent = money.format(totals.tax);
    el.rShipping.textContent = money.format(totals.shipping);
    el.rTotal.textContent = money.format(totals.total);

    el.docTerms.textContent = state.terms;
    el.docFooter.textContent = state.footer;

    fitSheet();
  }

  /* ---------- Fit the sheet into the preview pane ---------- */

  let lastFit = "";

  function fitSheet() {
    if (!el.preview) return;
    const available = el.preview.clientWidth - 56;
    const width = el.sheet.offsetWidth;
    const height = el.sheet.offsetHeight;
    if (!width || !height) return;

    const scale = Math.min(1, available / width);
    /* Bail out when nothing changed so resize observation cannot loop */
    const signature = scale + "|" + width + "|" + height;
    if (signature === lastFit) return;
    lastFit = signature;

    el.sheetScaler.style.setProperty("--scale", scale);
    el.sheetFrame.style.width = width * scale + "px";
    el.sheetFrame.style.height = height * scale + "px";
  }

  window.addEventListener("resize", fitSheet);
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(fitSheet).observe(el.preview);
  }

  /* ---------- Persistence ---------- */

  let saveTimer = null;
  let stateTimer = null;

  function queueSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 400);
  }

  function save() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
      flashStatus("Draft saved");
    } catch (e) {
      flashStatus("Could not save draft");
    }
  }

  function flashStatus(message) {
    el.saveState.textContent = message;
    clearTimeout(stateTimer);
    stateTimer = setTimeout(function () {
      el.saveState.textContent = "";
    }, 2200);
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      return normalize(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  }

  /* ---------- Toolbar actions ---------- */

  el.btnNew.addEventListener("click", function () {
    const confirmed = window.confirm(
      "Start a new quote? The current draft will be replaced.\n\nUse Export first if you want to keep a copy."
    );
    if (!confirmed) return;
    state = freshState();
    fillEditor();
    renderDoc();
    save();
  });

  el.btnExport.addEventListener("click", function () {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Quotation_" + (state.number || "draft") + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  el.btnImport.addEventListener("click", function () {
    el.fileImport.click();
  });

  el.fileImport.addEventListener("change", function () {
    const file = el.fileImport.files && el.fileImport.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        state = normalize(JSON.parse(String(reader.result)));
        fillEditor();
        renderDoc();
        save();
        flashStatus("Quote imported");
      } catch (e) {
        window.alert("That file could not be read as a saved quote.");
      }
    };
    reader.readAsText(file);
    el.fileImport.value = "";
  });

  el.btnPrint.addEventListener("click", function () {
    window.print();
  });

  /* "Save as PDF" uses document.title as the suggested filename */
  const pageTitle = document.title;
  window.addEventListener("beforeprint", function () {
    document.title = "Quotation_" + (state.number || "draft");
  });
  window.addEventListener("afterprint", function () {
    document.title = pageTitle;
  });

  /* Keep the form from submitting anywhere */
  el.quoteForm.addEventListener("submit", function (event) {
    event.preventDefault();
  });

  /* ---------- Boot ---------- */

  state = loadDraft() || freshState();
  fillEditor();
  renderDoc();

  /* Web fonts change the sheet height, so re-fit once they land */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitSheet);
  }
})();
