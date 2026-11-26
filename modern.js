/* TWINS GSM — لمسات الواجهة: ظهور ناعم + زر واتساب عائم */
(function () {
  "use strict";
  var isSite = !!document.getElementById("siteHeader");
  if ("IntersectionObserver" in window && isSite) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { threshold: .08 });
    document.querySelectorAll(".section > .container, .stats .container, .contact .container").forEach(function (el) { el.classList.add("mreveal"); io.observe(el); });
  }
  if (isSite) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "wa-fab"; b.setAttribute("aria-label", "تواصل واتساب");
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 3.5A11.8 11.8 0 0 0 12 0C5.4 0 .1 5.3.1 11.9c0 2.1.5 4.1 1.6 5.9L0 24l6.4-1.7a12 12 0 0 0 5.6 1.4c6.6 0 11.9-5.3 11.9-11.9 0-3.2-1.2-6.200-3.400-8.300zM12 21.700c-1.800 0-3.500-.5-5-1.400l-.4-.2-3.800 1 1-3.700-.2-.4a9.700 9.700 0 0 1-1.500-5.200C2.100 6.500 6.500 2.100 12 2.100c2.600 0 5.100 1 6.900 2.900a9.700 9.700 0 0 1 2.900 6.900c0 5.400-4.400 9.800-9.800 9.800z"/></svg><span>كلّمنا واتساب</span>';
    b.addEventListener("click", function () {
      var a = document.querySelector('a[href*="wa.me"],a[href*="whatsapp"]');
      if (a) window.open(a.href, "_blank", "noopener"); else location.hash = "#contact";
    });
    document.body.appendChild(b);
  }
})();
