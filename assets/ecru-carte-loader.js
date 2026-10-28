/* ECRU — carte 3D : chargement différé, avantages reliés à la carte par un trait et un point. */
(function () {
  if (window.__ecruCarteLoader) return;
  window.__ecruCarteLoader = true;
  var loaded = {};

  // tenir : la carte se pose de face (survol, bouton) ; sinon elle continue de tourner
  function setOpen(el, open, tenir) {
    // Sans avantages à montrer, rien à lire : la carte continue de tourner
    if (!el.querySelector('.ecru-carte__avantage')) return;
    el.classList.toggle('is-open', open);
    if (tenir !== false) el.dispatchEvent(new CustomEvent('ecru:avantages', { detail: open }));
  }

  // Emplacements : côté, hauteur du libellé (fraction de la scène), point visé sur la carte (-1 à 1)
  var SLOTS = [
    [-1, 0.26, -0.55],
    [-1, 0.5, 0],
    [-1, 0.74, 0.55],
    [1, 0.35, -0.4],
    [1, 0.65, 0.4],
  ];

  function layout(el) {
    var vue = el.querySelector('.ecru-carte__vue');
    var svg = el.querySelector('.ecru-carte__fleches');
    var items = el.querySelectorAll('.ecru-carte__avantage');
    if (!vue || !svg || !items.length) return;
    if (window.innerWidth < 900) {
      svg.innerHTML = '';
      items.forEach(function (li) {
        li.style.left = li.style.top = li.style.maxWidth = '';
      });
      return;
    }
    var w = vue.clientWidth;
    var h = vue.clientHeight;
    // Même cadrage que la scène 3D (ecru-carte-3d.js)
    var frac = Math.min(0.74, ((0.52 * h) / w) * (85.6 / 54));
    var cw = frac * w;
    var ch = (cw * 54) / 85.6;
    var cx = w / 2;
    var cy = h / 2;
    var side = cx - cw / 2;
    var gap = Math.max(56, Math.min(150, side * 0.32));
    var maxLabel = Math.max(120, side - gap - 40);
    var ns = 'http://www.w3.org/2000/svg';
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.innerHTML = '';

    items.forEach(function (li, i) {
      var s = SLOTS[i];
      if (!s) return;
      var dir = s[0];
      var edge = cx + (dir * cw) / 2;
      // Pointe posée sur la carte, légèrement à l'intérieur du bord
      var tx = edge - dir * cw * 0.07;
      var ty = cy + (s[2] * ch) / 2;
      var lx = edge + dir * gap;
      var ly = s[1] * h;
      li.style.left = lx + dir * 16 + 'px';
      li.style.top = ly + 'px';
      li.style.maxWidth = maxLabel + 'px';
      li.classList.toggle('is-gauche', dir < 0);

      var dx = tx - lx;
      var c1x = lx + dx * 0.55;
      var c2x = tx - dx * 0.3;
      var path = document.createElementNS(ns, 'path');
      path.setAttribute('class', 'ecru-carte__trait');
      path.setAttribute('d', 'M' + lx + ',' + ly + ' C' + c1x + ',' + ly + ' ' + c2x + ',' + ty + ' ' + tx + ',' + ty);
      path.style.setProperty('--i', i);
      svg.appendChild(path);
      path.style.setProperty('--len', Math.ceil(path.getTotalLength()) + 1);

      // Au bout du trait, sur la carte : un point et un anneau qui respire
      var ring = document.createElementNS(ns, 'circle');
      ring.setAttribute('class', 'ecru-carte__anneau');
      ring.setAttribute('cx', tx);
      ring.setAttribute('cy', ty);
      ring.setAttribute('r', 7);
      ring.style.setProperty('--i', i);
      svg.appendChild(ring);
      var dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('class', 'ecru-carte__point');
      dot.setAttribute('cx', tx);
      dot.setAttribute('cy', ty);
      dot.setAttribute('r', 3);
      dot.style.setProperty('--i', i);
      svg.appendChild(dot);
    });
  }

  function init(el) {
    if (!el || el.dataset.ecruInit) return;
    el.dataset.ecruInit = '1';
    var stage = el.querySelector('[data-ecru-stage]');

    layout(el);
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () {
        layout(el);
      }).observe(el.querySelector('.ecru-carte__vue') || el);
    }

    if (stage) {
      stage.addEventListener('pointerenter', function (e) {
        if (e.pointerType === 'mouse' && window.innerWidth >= 900) setOpen(el, true);
      });
      stage.addEventListener('pointerleave', function (e) {
        if (e.pointerType !== 'mouse') return;
        // Avantages affichés d'emblée : ils restent, la carte reprend sa rotation
        if (el.hasAttribute('data-auto-open')) el.dispatchEvent(new CustomEvent('ecru:avantages', { detail: false }));
        else setOpen(el, false);
      });
    }

    var saveData = navigator.connection && navigator.connection.saveData;
    if (saveData || !('IntersectionObserver' in window)) return;

    var io = new IntersectionObserver(
      function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        // La 3D attend la fin du chargement et un moment calme : l'image fixe s'affiche d'abord
        whenIdle(function () {
          var url = el.dataset.module;
          var p = loaded[url] || (loaded[url] = import(url));
          p.then(function (m) {
            return m.mount(el);
          }).then(function () {
            // Avantages affichés d'emblée sur ordinateur, la carte continue de tourner
            if (el.hasAttribute('data-auto-open') && window.innerWidth >= 900) {
              setTimeout(function () {
                if (!el.classList.contains('is-open')) setOpen(el, true, false);
              }, 900);
            }
          }).catch(function () {
            el.classList.add('is-fallback');
          });
        });
      },
      { rootMargin: '300px 0px' }
    );
    io.observe(el);
  }

  function whenIdle(fn) {
    var go = function () {
      if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 2500 });
      else setTimeout(fn, 600);
    };
    if (document.readyState === 'complete') go();
    else window.addEventListener('load', go, { once: true });
  }

  function initAll(root) {
    (root || document).querySelectorAll('[data-ecru-carte]').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initAll();
    });
  } else {
    initAll();
  }
  document.addEventListener('shopify:section:load', function (e) {
    initAll(e.target);
  });
  document.addEventListener('shopify:section:unload', function (e) {
    var el = e.target.querySelector('[data-ecru-carte]');
    if (el && el.__ecru) el.__ecru.destroy();
  });
})();
