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

  // Contact form: submit to Formspree via fetch (stays on page)
  const form = document.getElementById("contactForm");
  const note = document.getElementById("formNote");
  const submitBtn = form ? form.querySelector(".btn-submit") : null;

  function setNote(message, isError) {
    if (!note) return;
    note.hidden = false;
    note.textContent = message;
    note.classList.toggle("is-error", !!isError);
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const data = new FormData(form);
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending…";
      }

      fetch(form.action, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      })
        .then(function (response) {
          if (response.ok) {
            setNote("Thanks — your message has been sent. We'll get back to you soon.", false);
            form.reset();
          } else {
            return response.json().then(function (body) {
              const msg =
                body && body.errors
                  ? body.errors.map((er) => er.message).join(", ")
                  : "Something went wrong. Please try again or email us directly.";
              setNote(msg, true);
            });
          }
        })
        .catch(function () {
          setNote("Network error. Please try again or email us directly.", true);
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Send Message";
          }
        });
    });
  }
})();
