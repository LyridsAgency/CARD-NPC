/* ECRU — carte 3D : chargement différé, avantages, flèches. */
(function () {
  if (window.__ecruCarteLoader) return;
  window.__ecruCarteLoader = true;
  var loaded = {};

  function setOpen(el, open) {
    el.classList.toggle('is-open', open);
    var btn = el.querySelector('.ecru-carte__bascule');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    el.dispatchEvent(new CustomEvent('ecru:avantages', { detail: open }));
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

      var a = dx > 0 ? 0 : Math.PI; // la courbe arrive à l'horizontale
      var L = 8;
      var p1 = [tx - L * Math.cos(a - 0.5), ty - L * Math.sin(a - 0.5)];
      var p2 = [tx - L * Math.cos(a + 0.5), ty - L * Math.sin(a + 0.5)];
      var head = document.createElementNS(ns, 'path');
      head.setAttribute('class', 'ecru-carte__pointe');
      head.setAttribute('d', 'M' + p1[0] + ',' + p1[1] + ' L' + tx + ',' + ty + ' L' + p2[0] + ',' + p2[1]);
      head.style.setProperty('--i', i);
      svg.appendChild(head);

      var dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('class', 'ecru-carte__origine');
      dot.setAttribute('cx', lx);
      dot.setAttribute('cy', ly);
      dot.setAttribute('r', 1.75);
      dot.style.setProperty('--i', i);
      svg.appendChild(dot);
    });
  }

  function init(el) {
    if (!el || el.dataset.ecruInit) return;
    el.dataset.ecruInit = '1';
    var stage = el.querySelector('[data-ecru-stage]');
    var btn = el.querySelector('.ecru-carte__bascule');
    var pinned = false;

    layout(el);
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () {
        layout(el);
      }).observe(el.querySelector('.ecru-carte__vue') || el);
    }

    if (btn) {
      btn.addEventListener('click', function () {
        pinned = !el.classList.contains('is-open');
        setOpen(el, pinned);
      });
    }
    if (stage) {
      stage.addEventListener('pointerenter', function (e) {
        if (e.pointerType === 'mouse' && window.innerWidth >= 900) setOpen(el, true);
      });
      stage.addEventListener('pointerleave', function (e) {
        if (e.pointerType === 'mouse' && !pinned) setOpen(el, false);
      });
    }

    var saveData = navigator.connection && navigator.connection.saveData;
    if (saveData || !('IntersectionObserver' in window)) return;

    var io = new IntersectionObserver(
      function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        var url = el.dataset.module;
        var p = loaded[url] || (loaded[url] = import(url));
        p.then(function (m) {
          return m.mount(el);
        }).catch(function () {
          el.classList.add('is-fallback');
        });
      },
      { rootMargin: '300px 0px' }
    );
    io.observe(el);
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
