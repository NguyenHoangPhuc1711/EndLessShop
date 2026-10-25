"use strict";

document.querySelectorAll(".nav-menu").forEach(function (menu) {
  const trigger = menu.querySelector(".nav-menu__trigger");
  const header = menu.closest(".header");
  const panel = menu.querySelector(".mega-menu");
  let pointerMenuWasOpen = false;

  function setMenuOpen(isOpen) {
    menu.classList.toggle("is-open", isOpen);
    trigger.setAttribute("aria-expanded", String(isOpen));
    panel.setAttribute("aria-hidden", String(!isOpen));
    panel.style.visibility = isOpen ? "visible" : "hidden";
    panel.style.opacity = isOpen ? "1" : "0";
    panel.style.pointerEvents = isOpen ? "auto" : "none";
    panel.style.transform = isOpen ? "translateY(0)" : "translateY(8px)";
    if (isOpen && window.matchMedia("(max-width: 900px)").matches) {
      menu.style.setProperty("--mega-menu-top", header.getBoundingClientRect().bottom + 8 + "px");
    }
  }

  menu.addEventListener("mouseenter", function () {
    if (window.matchMedia("(hover: hover)").matches) setMenuOpen(true);
  });
  menu.addEventListener("mouseleave", function () {
    if (window.matchMedia("(hover: hover)").matches) setMenuOpen(false);
  });
  menu.addEventListener("focusout", function (event) {
    if (!menu.contains(event.relatedTarget)) setMenuOpen(false);
  });

  trigger.addEventListener("pointerdown", function () {
    pointerMenuWasOpen = menu.classList.contains("is-open");
  });

  trigger.addEventListener("click", function (event) {
    event.stopPropagation();
    setMenuOpen(event.detail > 0 ? !pointerMenuWasOpen : !menu.classList.contains("is-open"));
  });

  menu.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      setMenuOpen(false);
      trigger.focus();
    }
  });

  document.addEventListener("click", function (event) {
    if (!menu.contains(event.target)) {
      setMenuOpen(false);
    }
  });
});
