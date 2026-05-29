(function () {
  "use strict";

  const navToggle = document.getElementById("navToggle");
  const mainNav = document.getElementById("mainNav");
  const navLinks = Array.from(document.querySelectorAll(".nav-link"));

  // Mobile menu toggle
  if (navToggle && mainNav) {
    navToggle.addEventListener("click", function () {
      const open = mainNav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(open));
    });
  }

  // Active link handling + close mobile menu on selection
  navLinks.forEach(function (link) {
    link.addEventListener("click", function () {
      navLinks.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
      if (mainNav) mainNav.classList.remove("open");
      if (navToggle) navToggle.setAttribute("aria-expanded", "false");
    });
  });

  // Highlight nav based on section scrolled into view
  const sections = navLinks
    .map((l) => document.querySelector(l.getAttribute("href")))
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            const id = "#" + entry.target.id;
            navLinks.forEach(function (l) {
              l.classList.toggle("active", l.getAttribute("href") === id);
            });
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    sections.forEach((s) => observer.observe(s));
  }
})();
