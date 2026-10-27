/* ECRU — configurateur produit : options, MOQ, éditeur sur mesure (couleur, nom, logo), retourner la carte.
   La carte 3D (ecru-carte-3d.js) reçoit chaque changement par l'événement « ecru:card-update ». */
(function () {
  if (window.__ecruConfigurateur) return;
  window.__ecruConfigurateur = true;

  function bas(v) {
    return String(v || '').trim().toLowerCase();
  }
  function clarte(hex) {
    var h = String(hex || '#000').replace('#', '');
    if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
    var n = parseInt(h, 16) || 0;
    return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
  }
  function inkPour(color) {
    return clarte(color) > 150 ? '#121211' : '#e9e4d8';
  }
  function pct(v) {
    return Math.round(v * 100) + ' %';
  }

  // Logo → masque blanc sur fond transparent (zones transparentes ou claires = vide).
  // Le même masque sert à l'éditeur (mask-image) et à la carte 3D.
  function masquerLogo(url) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var max = 900;
        var r = Math.min(1, max / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * r));
        var h = Math.max(1, Math.round(img.height * r));
        var c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        var ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        var d = ctx.getImageData(0, 0, w, h);
        var px = d.data;
        var transparent = false;
        for (var i = 3; i < px.length; i += 16) {
          if (px[i] < 240) {
            transparent = true;
            break;
          }
        }
        for (var j = 0; j < px.length; j += 4) {
          var lum = (px[j] * 0.299 + px[j + 1] * 0.587 + px[j + 2] * 0.114) / 255;
          var a = transparent ? px[j + 3] / 255 : Math.max(0, Math.min(1, (0.85 - lum) / 0.6));
          px[j] = px[j + 1] = px[j + 2] = 255;
          px[j + 3] = a * 255;
        }
        ctx.putImageData(d, 0, 0);
        resolve({ url: c.toDataURL('image/png'), ratio: w / h });
      };
      img.onerror = function () {
        resolve(null);
      };
      img.src = url;
    });
  }

  function init(root) {
    var form = root.querySelector('[data-ecru-form]');
    var donnees = root.querySelector('[data-ecru-donnees]');
    if (!form || !donnees || root.dataset.ecruPret) return;
    root.dataset.ecruPret = '1';
    var data = JSON.parse(donnees.textContent);
    var variants = data.variants;
    var input = form.querySelector('[data-ecru-variant]');
    var bouton = form.querySelector('[data-ecru-ajout]');
    var statut = form.querySelector('[data-ecru-statut]');
    var quantite = form.querySelector('[data-ecru-quantite]');
    var moqEl = form.querySelector('[data-ecru-moq]');
    var legende = root.querySelector('[data-ecru-legende]');
    var carte = root.querySelector('[data-ecru-carte]');
    var minimum = 1;
    var teintes = { fond: '#0d0d0c', relief: '#e9e4d8' };

    // ---------- Éditeur : un nom et un logo, à placer librement ----------
    var editeur = form.querySelector('[data-ecru-editeur]');
    var reglages = form.querySelector('[data-ecru-reglages]');
    var champNom = form.querySelector('[data-ecru-nom]');
    var champTaille = form.querySelector('[data-ecru-el-taille]');
    var fichier = form.querySelector('[data-ecru-fichier]');
    var logoRetirer = form.querySelector('[data-ecru-logo-retirer]');
    var elements = [{ id: 'nom', t: 'text', v: champNom ? champNom.value : '', x: 0.5, y: 0.62, s: 0.1, f: 'display', a: 'center' }];
    var selection = null;

    function modeDe(options) {
      var m = 'standard';
      options.forEach(function (o) {
        var v = bas(o);
        if (/design|mesure|custom|personnal/.test(v)) m = 'design';
      });
      return m;
    }
    function choix() {
      var sel = [];
      form.querySelectorAll('input[type=radio][data-position]:checked').forEach(function (r) {
        sel[r.dataset.position - 1] = r.value;
      });
      return sel;
    }
    function visibles() {
      return elements.filter(function (e) {
        return e.t === 'logo' ? !!e.u : !!(e.v && e.v.trim());
      });
    }

    function apparence() {
      var options = choix();
      var finish = 'metal';
      var color = '#0d0d0c';
      options.forEach(function (o) {
        var v = bas(o);
        if (v.indexOf('pvc') !== -1) finish = 'mat';
        if (data.couleurs[v]) color = data.couleurs[v];
      });
      var look = { finish: finish, elements: [] };
      if (modeDe(options) === 'design') {
        color = teintes.fond;
        look.ink = teintes.relief;
        look.elements = visibles().map(function (e) {
          return { t: e.t, v: e.v, u: e.u, x: e.x, y: e.y, s: e.s, f: e.f, a: 'center' };
        });
      } else {
        look.ink = inkPour(color);
      }
      look.color = color;
      return look;
    }

    var attente = 0;
    function rendre(present) {
      if (!carte) return;
      var look = apparence();
      look.present = !!present;
      carte.dispatchEvent(new CustomEvent('ecru:card-update', { detail: look }));
    }
    // Pendant un glissement, la carte 3D suit sans saturer le navigateur
    function rendreBientot() {
      clearTimeout(attente);
      attente = setTimeout(function () {
        rendre(false);
      }, 220);
    }

    function element(id) {
      return elements.find(function (e) {
        return e.id === id;
      });
    }

    function dessinerEditeur() {
      if (!editeur) return;
      editeur.style.setProperty('--fond', teintes.fond);
      editeur.style.setProperty('--marquage', teintes.relief);
      var vis = visibles();
      editeur.querySelectorAll('[data-el]').forEach(function (n) {
        if (!vis.some((e) => e.id === n.dataset.el)) n.remove();
      });
      vis.forEach(function (e) {
        var n = editeur.querySelector('[data-el="' + e.id + '"]');
        if (!n) {
          n = document.createElement('div');
          n.className = 'ecru-editeur__el';
          n.dataset.el = e.id;
          n.tabIndex = 0;
          n.setAttribute('role', 'button');
          editeur.appendChild(n);
          brancherGlisser(n);
        }
        n.style.left = e.x * 100 + '%';
        n.style.top = e.y * 100 + '%';
        n.style.setProperty('--s', e.s);
        n.classList.toggle('is-selection', selection === e.id);
        if (e.t === 'logo') {
          n.classList.add('ecru-editeur__el--logo');
          n.textContent = '';
          n.style.setProperty('--logo', 'url(' + e.u + ')');
          n.style.setProperty('--ratio', e.ratio || 1);
          n.setAttribute('aria-label', 'Logo, position ' + pct(e.x) + ' / ' + pct(e.y) + '. Glisser ou flèches pour déplacer.');
        } else {
          n.classList.add('ecru-editeur__el--titre');
          n.textContent = e.v.toUpperCase();
          n.setAttribute('aria-label', 'Nom « ' + e.v + ' », position ' + pct(e.x) + ' / ' + pct(e.y) + '. Glisser ou flèches pour déplacer.');
        }
      });
      majReglages();
      majMaquette();
    }

    function selectionner(id) {
      selection = id;
      dessinerEditeur();
    }

    function majReglages() {
      if (!reglages) return;
      var e = element(selection);
      var ok = e && visibles().indexOf(e) !== -1;
      reglages.hidden = !ok;
      if (!ok) return;
      var estTexte = e.t === 'text';
      reglages.querySelector('label').textContent = 'Taille';
      champTaille.setAttribute('aria-label', estTexte ? 'Taille du nom' : 'Taille du logo');
      champTaille.min = estTexte ? 4 : 10;
      champTaille.max = estTexte ? 30 : 70;
      champTaille.value = Math.round(e.s * 100);
    }

    // Résumé lisible de la maquette, envoyé avec la commande
    function majMaquette() {
      var lisible = form.querySelector('[data-ecru-maquette]');
      var brut = form.querySelector('[data-ecru-maquette-json]');
      if (!lisible) return;
      var vis = visibles();
      lisible.value = vis
        .map(function (e) {
          var pos = 'position ' + pct(e.x) + ' / ' + pct(e.y) + ', taille ' + Math.round(e.s * 100);
          return e.t === 'logo' ? 'Logo (' + pos + ')' : 'Nom « ' + e.v + ' » (' + pos + ')';
        })
        .join(' ; ');
      brut.value = JSON.stringify(
        vis.map(function (e) {
          return { t: e.t, v: e.t === 'text' ? e.v : undefined, x: +e.x.toFixed(3), y: +e.y.toFixed(3), s: +e.s.toFixed(3) };
        })
      );
    }

    function guides(x, y) {
      editeur.classList.toggle('is-centre-v', Math.abs(x - 0.5) < 0.012);
      editeur.classList.toggle('is-centre-h', Math.abs(y - 0.5) < 0.012);
    }

    function brancherGlisser(n) {
      var depart = null;
      n.addEventListener('pointerdown', function (ev) {
        var e = element(n.dataset.el);
        if (!e) return;
        selectionner(e.id);
        n.setPointerCapture(ev.pointerId);
        var r = editeur.getBoundingClientRect();
        depart = { px: ev.clientX, py: ev.clientY, x: e.x, y: e.y, w: r.width, h: r.height };
        ev.preventDefault();
      });
      n.addEventListener('pointermove', function (ev) {
        if (!depart) return;
        var e = element(n.dataset.el);
        var x = depart.x + (ev.clientX - depart.px) / depart.w;
        var y = depart.y + (ev.clientY - depart.py) / depart.h;
        // Aimant au centre
        if (Math.abs(x - 0.5) < 0.012) x = 0.5;
        if (Math.abs(y - 0.5) < 0.012) y = 0.5;
        e.x = Math.max(0.03, Math.min(0.97, x));
        e.y = Math.max(0.05, Math.min(0.95, y));
        guides(e.x, e.y);
        n.style.left = e.x * 100 + '%';
        n.style.top = e.y * 100 + '%';
        rendreBientot();
      });
      function fin() {
        if (!depart) return;
        depart = null;
        editeur.classList.remove('is-centre-v', 'is-centre-h');
        dessinerEditeur();
        rendre(false);
      }
      n.addEventListener('pointerup', fin);
      n.addEventListener('pointercancel', fin);
      n.addEventListener('focus', function () {
        if (selection !== n.dataset.el) selectionner(n.dataset.el);
      });
      n.addEventListener('keydown', function (ev) {
        var e = element(n.dataset.el);
        if (!e) return;
        var pas = ev.shiftKey ? 0.05 : 0.01;
        var bouge = { ArrowLeft: [-pas, 0], ArrowRight: [pas, 0], ArrowUp: [0, -pas], ArrowDown: [0, pas] }[ev.key];
        if (bouge) {
          ev.preventDefault();
          e.x = Math.max(0.03, Math.min(0.97, e.x + bouge[0]));
          e.y = Math.max(0.05, Math.min(0.95, e.y + bouge[1]));
          dessinerEditeur();
          n.focus();
          rendreBientot();
        }
      });
    }

    function retirerLogo() {
      elements = elements.filter(function (e) {
        return e.t !== 'logo';
      });
      if (fichier) fichier.value = '';
      form.querySelector('[data-ecru-fichier-nom]').textContent = '';
      if (logoRetirer) logoRetirer.hidden = true;
      if (selection === 'logo') selection = null;
      dessinerEditeur();
      rendre(false);
    }

    if (editeur) {
      champNom.addEventListener('input', function () {
        element('nom').v = champNom.value;
        selection = champNom.value.trim() ? 'nom' : null;
        dessinerEditeur();
        rendreBientot();
      });
      champTaille.addEventListener('input', function () {
        var e = element(selection);
        if (!e) return;
        e.s = champTaille.value / 100;
        dessinerEditeur();
        rendreBientot();
      });
      editeur.addEventListener('pointerdown', function (ev) {
        if (ev.target === editeur) selectionner(null);
      });
      if (logoRetirer) logoRetirer.addEventListener('click', retirerLogo);
      fichier.addEventListener('change', function () {
        var f = fichier.files && fichier.files[0];
        elements = elements.filter(function (e) {
          return e.t !== 'logo';
        });
        if (!f || !/^image\//.test(f.type)) {
          retirerLogo();
          return;
        }
        form.querySelector('[data-ecru-fichier-nom]').textContent = f.name;
        if (logoRetirer) logoRetirer.hidden = false;
        masquerLogo(URL.createObjectURL(f)).then(function (m) {
          if (!m) return;
          elements.push({ id: 'logo', t: 'logo', u: m.url, ratio: m.ratio, x: 0.5, y: 0.36, s: 0.26 });
          selectionner('logo');
          rendre(true);
        });
      });
    }

    // ---------- Options, MOQ, panneaux ----------
    function panneaux(m) {
      form.querySelectorAll('[data-ecru-panneau]').forEach(function (p) {
        var actif = p.dataset.ecruPanneau === m;
        p.hidden = !actif;
        p.querySelectorAll('input:not([type=color]):not([type=range])').forEach(function (f) {
          f.disabled = !actif;
        });
      });
      form.querySelectorAll('[data-ecru-note]').forEach(function (n) {
        n.hidden = n.dataset.ecruNote !== m;
      });
      if (m === 'design') dessinerEditeur();
    }

    function majMoq(options) {
      minimum = 1;
      var defini = false;
      options.forEach(function (o) {
        var q = data.moq[bas(o)];
        if (q > 0) {
          minimum = Math.max(minimum, q);
          defini = true;
        }
      });
      if (moqEl) moqEl.textContent = defini ? minimum + ' cartes' : data.moqTexte;
      quantite.min = minimum;
      if ((parseInt(quantite.value, 10) || 0) < minimum) quantite.value = minimum;
    }

    function maj() {
      var sel = choix();
      var v = variants.find(function (x) {
        return x.options.every(function (o, i) {
          return sel[i] === undefined || sel[i] === o;
        });
      });
      form.querySelectorAll('input[type=radio][data-position]').forEach(function (r) {
        var pos = r.dataset.position - 1;
        var possible = variants.some(function (x) {
          return (
            x.available &&
            x.options[pos] === r.value &&
            x.options.every(function (o, i) {
              return i === pos || sel[i] === undefined || sel[i] === o;
            })
          );
        });
        r.disabled = !possible && !r.checked;
      });
      form.querySelectorAll('[data-ecru-valeur]').forEach(function (el) {
        el.textContent = sel[el.dataset.ecruValeur - 1] || '';
      });
      if (legende) legende.textContent = sel.filter(Boolean).join(' · ');
      panneaux(modeDe(sel));
      majMoq(sel);
      if (!v) {
        bouton.disabled = true;
        bouton.textContent = 'Indisponible';
        statut.textContent = 'Cette combinaison n’existe pas.';
        return;
      }
      input.value = v.id;
      bouton.disabled = !v.available;
      bouton.textContent = v.available ? data.ajout : 'Indisponible';
      statut.textContent = '';
      var url = new URL(window.location.href);
      url.searchParams.set('variant', v.id);
      window.history.replaceState({}, '', url.toString());
    }

    function choisirTeinte(cible, teinte) {
      teintes[cible] = teinte;
      var champ = form.querySelector('[data-ecru-champ="' + cible + '"]');
      if (champ) champ.value = teinte;
      form.querySelectorAll('[data-cible="' + cible + '"]').forEach(function (b) {
        b.setAttribute('aria-checked', b.dataset.teinte === teinte ? 'true' : 'false');
      });
      dessinerEditeur();
      rendre(true);
    }
    form.querySelectorAll('[data-cible]').forEach(function (b) {
      b.addEventListener('click', function () {
        choisirTeinte(b.dataset.cible, b.dataset.teinte);
      });
    });
    form.querySelectorAll('[data-ecru-libre]').forEach(function (c) {
      c.addEventListener('input', function () {
        choisirTeinte(c.dataset.ecruLibre, c.value);
      });
    });

    form.addEventListener('change', function (e) {
      if (e.target.dataset.position) {
        maj();
        rendre(true);
      }
      if (e.target === quantite && (parseInt(quantite.value, 10) || 0) < minimum) {
        quantite.value = minimum;
        statut.textContent = 'Minimum de commande : ' + minimum + ' cartes.';
      }
    });
    form.querySelectorAll('[data-ecru-qte]').forEach(function (b) {
      b.addEventListener('click', function () {
        quantite.value = Math.max(minimum, (parseInt(quantite.value, 10) || minimum) + parseInt(b.dataset.ecruQte, 10));
      });
    });
    form.addEventListener('submit', function (e) {
      if ((parseInt(quantite.value, 10) || 0) < minimum) {
        e.preventDefault();
        quantite.value = minimum;
        statut.textContent = 'Minimum de commande : ' + minimum + ' cartes.';
      }
    });

    // ---------- Retourner la carte ----------
    var retourner = root.querySelector('[data-ecru-retourner]');
    if (retourner && carte) {
      retourner.addEventListener('click', function () {
        var verso = retourner.getAttribute('aria-pressed') !== 'true';
        retourner.setAttribute('aria-pressed', verso ? 'true' : 'false');
        carte.dispatchEvent(new CustomEvent('ecru:view', { detail: { view: verso ? 'verso' : 'recto' } }));
      });
    }

    form.querySelectorAll('[data-cible="fond"][data-teinte="#0d0d0c"], [data-cible="relief"][data-teinte="#e9e4d8"]').forEach(function (b) {
      b.setAttribute('aria-checked', 'true');
    });
    maj();
    if (modeDe(choix()) !== 'standard') rendre(false);
  }

  function initAll() {
    document.querySelectorAll('[data-ecru-produit]').forEach(init);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
  else initAll();
  document.addEventListener('shopify:section:load', initAll);
})();
