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

/* Page contact : « Demande particulière » depuis une page produit pré-remplit le message. */
(function () {
  var produit = new URLSearchParams(window.location.search).get('produit');
  var champ = document.getElementById('ContactForm-body');
  if (!produit || !champ || champ.value) return;
  champ.value = 'Demande particulière — ' + produit + ' :\n';
})();

/* Chiffres : comptés de 0 à leur valeur quand ils apparaissent. */
(function () {
  var els = document.querySelectorAll('[data-ecru-compte]');
  if (!els.length || !('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      var el = e.target;
      var cible = parseFloat(String(el.dataset.ecruCompte).replace(',', '.'));
      if (!(cible > 0)) return;
      var dec = (String(el.dataset.ecruCompte).split(/[.,]/)[1] || '').length;
      var t0 = performance.now();
      var duree = 1600;
      (function pas(t) {
        var k = Math.min(1, (t - t0) / duree);
        var v = cible * (1 - Math.pow(1 - k, 3));
        el.textContent = v.toFixed(dec).replace('.', ',');
        if (k < 1) requestAnimationFrame(pas);
        else el.textContent = el.dataset.ecruCompte;
      })(t0);
    });
  }, { threshold: 0.6 });
  els.forEach(function (el) {
    io.observe(el);
  });
})();

/* Halo qui suit le pointeur sur les cartes (.ecru-spot). */
(function () {
  if (!window.matchMedia('(hover: hover)').matches) return;
  document.addEventListener('pointermove', function (e) {
    var el = e.target.closest && e.target.closest('.ecru-spot');
    if (!el) return;
    var r = el.getBoundingClientRect();
    el.style.setProperty('--mx', e.clientX - r.left + 'px');
    el.style.setProperty('--my', e.clientY - r.top + 'px');
  }, { passive: true });
})();
