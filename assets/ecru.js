/* ECRU — apparitions lentes au défilement. Rien ne bouge si « réduire les animations » est actif. */
(function () {
  var items = document.querySelectorAll('.ecru-reveal');
  if (!items.length) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach(function (el) {
      el.classList.add('is-visible');
    });
    return;
  }
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
  );
  items.forEach(function (el) {
    io.observe(el);
  });
})();

/* Page contact : « Demande spécifique » depuis une page produit pré-remplit le message. */
(function () {
  var produit = new URLSearchParams(window.location.search).get('produit');
  var champ = document.getElementById('ContactForm-body');
  if (!produit || !champ || champ.value) return;
  champ.value = 'Demande spécifique — ' + produit + ' :\n';
})();
