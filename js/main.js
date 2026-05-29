(function () {
  "use strict";

  const navToggle = document.getElementById("navToggle");
  const mainNav = document.getElementById("mainNav");
  const navLinks = Array.from(document.querySelectorAll(".nav-link"));
  const views = Array.from(document.querySelectorAll(".view"));

  // Mobile menu toggle
  if (navToggle && mainNav) {
    navToggle.addEventListener("click", function () {
      const open = mainNav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(open));
    });
  }

  function showView(name) {
    views.forEach(function (v) {
      v.classList.toggle("active", v.getAttribute("data-view") === name);
    });
    navLinks.forEach(function (l) {
      l.classList.toggle("active", l.getAttribute("data-view") === name);
    });
    // Reset scroll position of the newly shown view
    const active = document.querySelector(".view.active");
    if (active) active.scrollTop = 0;

    // Close mobile menu
    if (mainNav) mainNav.classList.remove("open");
    if (navToggle) navToggle.setAttribute("aria-expanded", "false");

    if (history.replaceState) history.replaceState(null, "", "#" + name);
  }

  // Any element with data-view triggers navigation (nav links, brand, badge, etc.)
  document.querySelectorAll("[data-view]").forEach(function (el) {
    if (el.classList.contains("view")) return; // skip the view sections themselves
    el.addEventListener("click", function (e) {
      e.preventDefault();
      showView(el.getAttribute("data-view"));
    });
  });

  // Open the view referenced by the URL hash on load
  const initial = (location.hash || "#home").replace("#", "");
  if (views.some((v) => v.getAttribute("data-view") === initial)) {
    showView(initial);
  }

  // Contact form: preview-only confirmation
  const form = document.getElementById("contactForm");
  const note = document.getElementById("formNote");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      if (note) note.hidden = false;
      form.reset();
    });
  }
})();
