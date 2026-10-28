/* ECRU — simulateur : chiffre d'affaires supplémentaire si davantage de clients reviennent.
   Calcul affiché tel quel : clients × panier × part de clients qui reviennent, montée progressive sur 4 mois. */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  var MOIS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

  function el(nom, attrs, parent) {
    var n = document.createElementNS(NS, nom);
    Object.keys(attrs).forEach(function (k) {
      n.setAttribute(k, attrs[k]);
    });
    if (parent) parent.appendChild(n);
    return n;
  }

  function init(root) {
    if (root.dataset.ecruSimuPret) return;
    root.dataset.ecruSimuPret = '1';
    var svg = root.querySelector('[data-ecru-graphique]');
    var gainEl = root.querySelector('[data-ecru-gain]');
    var detailEl = root.querySelector('[data-ecru-detail]');
    var champs = root.querySelectorAll('[data-ecru-simu]');
    var W = 600;
    var H = 240;
    var bas = 208;
    var haut = 30;
    var largeur = W / 12;

    // Barres : chiffre d'affaires supplémentaire cumulé, mois après mois
    var etiquette = el('text', { y: haut, 'text-anchor': 'end', class: 'ecru-simu__valeur' }, svg);
    var barres = MOIS.map(function (m, i) {
      var x = i * largeur + largeur * 0.2;
      var w = largeur * 0.6;
      var g = el('g', {}, svg);
      var base = el('rect', { x: x, width: w, y: bas, height: 0, rx: 2, class: 'ecru-simu__barre-base' }, g);
      var plus = el('rect', { x: x, width: w, y: bas, height: 0, rx: 2, class: 'ecru-simu__barre-plus', style: 'transition-delay:' + i * 30 + 'ms' }, g);
      var t = el('text', { x: x + w / 2, y: H - 6, 'text-anchor': 'middle', class: 'ecru-simu__mois' }, g);
      t.textContent = m;
      return { base: base, plus: plus };
    });
    el('line', { x1: 0, x2: W, y1: bas + 0.5, y2: bas + 0.5, class: 'ecru-simu__axe' }, svg);
    var desc = el('desc', {}, svg);

    function valeur(nom) {
      var c = root.querySelector('[data-ecru-simu="' + nom + '"]');
      return parseFloat(c.value) || 0;
    }

    function calcul() {
      var clients = valeur('clients');
      var panier = valeur('panier');
      var retour = valeur('retour') / 100;
      var gain = valeur('gain') / 100;
      var mois = MOIS.map(function (m, i) {
        var montee = Math.min(1, (i + 1) / 4);
        var base = clients * panier * (1 + retour);
        var plus = clients * panier * gain * montee;
        return { base: base, plus: plus };
      });
      var total = mois.reduce(function (a, m) {
        return a + m.plus;
      }, 0);
      var cumul = 0;
      var cumuls = mois.map(function (m) {
        cumul += m.plus;
        return cumul;
      });
      var max = Math.max(1, cumul);
      cumuls.forEach(function (c, i) {
        var hp = Math.max(2, ((bas - haut) * c) / max);
        // Fond discret : toute la hauteur, pour lire la progression
        barres[i].base.setAttribute('y', haut);
        barres[i].base.setAttribute('height', bas - haut);
        barres[i].plus.setAttribute('y', bas - hp);
        barres[i].plus.setAttribute('height', hp);
      });
      etiquette.setAttribute('x', W - largeur * 0.2);
      etiquette.setAttribute('y', haut - 10);
      etiquette.textContent = '+ ' + euros.format(cumul);
      gainEl.textContent = '+ ' + euros.format(total);
      var parMois = clients * panier * gain;
      detailEl.textContent = 'Soit ' + euros.format(parMois) + ' de plus par mois une fois la fidélité installée.';
      desc.textContent = 'Chiffre d’affaires supplémentaire cumulé sur 12 mois, jusqu’à ' + euros.format(cumul) + ', soit ' + euros.format(parMois) + ' de plus par mois après 4 mois.';
      champs.forEach(function (c) {
        var o = root.querySelector('[data-ecru-sortie="' + c.dataset.ecruSimu + '"]');
        var v = c.dataset.unite === ' €' ? euros.format(+c.value) : (c.dataset.unite === ' points' ? '+' + c.value : c.value) + (c.dataset.unite === ' €' ? '' : c.dataset.unite);
        if (o) o.textContent = v;
        c.style.setProperty('--p', ((c.value - c.min) / (c.max - c.min)) * 100 + '%');
      });
    }

    champs.forEach(function (c) {
      c.addEventListener('input', calcul);
    });
    calcul();
  }

  function initAll() {
    document.querySelectorAll('[data-ecru-simulateur]').forEach(init);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
  else initAll();
  document.addEventListener('shopify:section:load', initAll);
})();
