/* ECRU — configurateur produit : options, MOQ, éditeur sur mesure (couleur, nom, logo), retourner la carte.
   La carte 3D (ecru-carte-3d.js) reçoit chaque changement par l'événement « ecru:card-update ». */
(function () {
  if (window.__ecruConfigurateur) return;
  window.__ecruConfigurateur = true;

  // Modèles prêts à personnaliser (mêmes réglages que les rendus assets/ecru-modele-*.webp)
  var MODELES = {"editorial":{"titre":"Éditorial","fond":"#0d0d0c","relief":"#e9e4d8","elements":[{"t":"text","v":"Maison","x":0.37,"y":0.6,"s":0.19,"f":"display","a":"left","k":-0.01},{"t":"text","v":"Lune","x":0.37,"y":0.8,"s":0.19,"f":"display","a":"left","k":-0.01},{"t":"text","v":"Restaurant — Paris","x":0.37,"y":0.14,"s":0.045,"f":"body","a":"left"}]},"minimal":{"titre":"Minimal","fond":"#e9e4d8","relief":"#121211","elements":[{"t":"text","v":"Atelier Sel","x":0.95,"y":0.86,"s":0.06,"f":"body","a":"right"},{"t":"text","v":"N° 001","x":0.95,"y":0.14,"s":0.045,"f":"body","a":"right"}]},"monogramme":{"titre":"Monogramme","fond":"#0d0d0c","relief":"#7d7b76","elements":[{"t":"text","v":"C","x":1.03,"y":0.8,"s":1.3,"f":"display","a":"right","k":-0.01},{"t":"text","v":"Club Marceau","x":0.37,"y":0.14,"s":0.05,"f":"body","a":"left"}]},"signature":{"titre":"Signature","fond":"#d6cfbf","relief":"#2e2c28","elements":[{"t":"text","v":"Salon Ambre","x":0.655,"y":0.47,"s":0.08,"f":"display","a":"center"},{"t":"text","v":"Coiffure · Lyon","x":0.655,"y":0.6,"s":0.042,"f":"body","a":"center"}]},"numero":{"titre":"Numéro","fond":"#2a2926","relief":"#e9e4d8","elements":[{"t":"text","v":"Nº7","x":0.95,"y":0.66,"s":0.42,"f":"display","a":"right","k":-0.01},{"t":"text","v":"Nuit Blanche","x":0.37,"y":0.14,"s":0.05,"f":"body","a":"left"}]},"pierre":{"titre":"Pierre","fond":"#8f8a80","relief":"#121211","elements":[{"t":"text","v":"Le Comptoir","x":0.37,"y":0.16,"s":0.085,"f":"display","a":"left"},{"t":"text","v":"Bar à vins","x":0.37,"y":0.28,"s":0.045,"f":"body","a":"left"},{"t":"text","v":"Depuis 2024","x":0.95,"y":0.86,"s":0.04,"f":"body","a":"right"}]}};

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
    var teintes = { fond: '#0d0d0c', relief: '#e9e4d8', fenetre: 'auto' };

    // ---------- Éditeur : un nom et un logo, à placer librement ----------
    var editeur = form.querySelector('[data-ecru-editeur]');
    var reglages = form.querySelector('[data-ecru-reglages]');
    var champNom = form.querySelector('[data-ecru-nom]');
    var champTaille = form.querySelector('[data-ecru-el-taille]');
    var fichier = form.querySelector('[data-ecru-fichier]');
    var logoRetirer = form.querySelector('[data-ecru-logo-retirer]');
    var elements = [{ id: 'nom', t: 'text', v: champNom ? champNom.value : '', x: 0.66, y: 0.62, s: 0.09, f: 'display', a: 'center' }];
    // Deux faces : « elements » est toujours la face en cours d'édition
    var face = 'recto';
    var faces = { recto: elements, verso: [] };
    function liste(f) {
      if (f === face) return elements;
      return faces[f];
    }
    var selection = null;
    var modeleApplique = false;

    function modeDe(options) {
      if (data.surMesure) return 'design';
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
    function visibles(f) {
      return (f ? liste(f) : elements).filter(function (e) {
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
        var pourLa3d = function (e) {
          return { t: e.t, v: e.v, u: e.u, x: e.x, y: e.y, s: e.s, f: e.f, a: e.a || 'center', k: e.k };
        };
        look.elements = visibles('recto').map(pourLa3d);
        look.verso = visibles('verso').map(pourLa3d);
      } else {
        look.ink = inkPour(color);
        look.verso = [];
      }
      look.color = color;
      look.fenetre = modeDe(options) !== 'standard' && teintes.fenetre !== 'auto' ? teintes.fenetre : null;
      return look;
    }

    var attente = 0;
    function rendre(present) {
      if (!carte) return;
      var look = apparence();
      look.present = !!present;
      // Gardé pour la 3D si elle n'est pas encore chargée
      carte.__ecruLook = look;
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
      if (teintes.fenetre !== 'auto') editeur.style.setProperty('--fenetre', teintes.fenetre);
      else editeur.style.removeProperty('--fenetre');
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
          // Contenu (texte ou logo) + poignée pour agrandir / réduire
          n.innerHTML = '<span class="ecru-editeur__contenu"></span>';
          editeur.appendChild(n);
          brancherGlisser(n);
        }
        var contenu = n.firstChild;
        n.style.left = e.x * 100 + '%';
        n.style.top = e.y * 100 + '%';
        n.style.setProperty('--s', e.s);
        n.classList.toggle('is-selection', selection === e.id);
        if (e.t === 'logo') {
          n.classList.add('ecru-editeur__el--logo');
          contenu.textContent = '';
          n.style.setProperty('--logo', 'url(' + e.u + ')');
          n.style.setProperty('--ratio', e.ratio || 1);
          n.setAttribute('aria-label', 'Logo, position ' + pct(e.x) + ' / ' + pct(e.y) + '. Glisser ou flèches pour déplacer, + et − pour la taille.');
        } else {
          var titre = e.f !== 'body';
          n.classList.toggle('ecru-editeur__el--titre', titre);
          contenu.textContent = titre ? e.v.toUpperCase() : e.v;
          n.style.letterSpacing = (e.k != null ? e.k : titre ? 0.12 : 0.04) + 'em';
          n.dataset.align = e.a || 'center';
          n.setAttribute('aria-label', 'Texte « ' + e.v + ' », position ' + pct(e.x) + ' / ' + pct(e.y) + '. Glisser ou flèches pour déplacer, + et − pour la taille.');
        }
      });
      majReglages();
      majMaquette();
      placerPoignee();
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
      if (estTexte && champNom && document.activeElement !== champNom) champNom.value = e.v;
      reglages.querySelector('label').textContent = 'Taille';
      champTaille.setAttribute('aria-label', estTexte ? 'Taille du nom' : 'Taille du logo');
      champTaille.min = estTexte ? 3 : 10;
      champTaille.max = estTexte ? 130 : 95;
      champTaille.value = Math.round(e.s * 100);
    }

    // Résumé lisible de la maquette, envoyé avec la commande
    function majMaquette() {
      var lisible = form.querySelector('[data-ecru-maquette]');
      var brut = form.querySelector('[data-ecru-maquette-json]');
      if (!lisible) return;
      var resume = function (e) {
        var pos = 'position ' + pct(e.x) + ' / ' + pct(e.y) + ', taille ' + Math.round(e.s * 100);
        return e.t === 'logo' ? 'Logo (' + pos + ')' : 'Texte « ' + e.v + ' » (' + pos + ')';
      };
      var brutDe = function (e) {
        return { t: e.t, v: e.t === 'text' ? e.v : undefined, x: +e.x.toFixed(3), y: +e.y.toFixed(3), s: +e.s.toFixed(3), f: e.f, a: e.a };
      };
      var verso = visibles('verso');
      var fen = teintes.fenetre !== 'auto' ? ', fenêtre NFC ' + teintes.fenetre.toUpperCase() : '';
      lisible.value = 'Fond ' + teintes.fond.toUpperCase() + fen + ' | Recto : ' + (visibles('recto').map(resume).join(' ; ') || 'vierge') + (verso.length ? ' | Verso : ' + verso.map(resume).join(' ; ') : '');
      brut.value = JSON.stringify({ recto: visibles('recto').map(brutDe), verso: verso.map(brutDe) });
    }

    function guides(x, y) {
      editeur.classList.toggle('is-centre-v', Math.abs(x - 0.5) < 0.012);
      editeur.classList.toggle('is-centre-h', Math.abs(y - 0.5) < 0.012);
    }

    // Taille : bornes selon le type d'élément
    function borner(e, s) {
      return e.t === 'logo' ? Math.max(0.06, Math.min(0.95, s)) : Math.max(0.025, Math.min(1.4, s));
    }
    function redimensionner(e, s) {
      e.s = borner(e, s);
      var n = editeur.querySelector('[data-el="' + e.id + '"]');
      if (n) n.style.setProperty('--s', e.s);
      if (champTaille && selection === e.id) champTaille.value = Math.round(e.s * 100);
      rendreBientot();
    }

    // Poignée unique : posée au coin de l'élément sélectionné, toujours dans la carte
    var poignee = null;
    var etire = null;
    function placerPoignee() {
      if (!poignee) return;
      var n = selection && editeur.querySelector('[data-el="' + selection + '"]');
      if (!n) {
        poignee.hidden = true;
        return;
      }
      var re = editeur.getBoundingClientRect();
      var rn = n.getBoundingClientRect();
      poignee.hidden = false;
      poignee.style.left = Math.min(rn.right, re.right - 10) - re.left + 'px';
      poignee.style.top = Math.min(rn.bottom, re.bottom - 10) - re.top + 'px';
    }
    if (editeur) {
      poignee = document.createElement('span');
      poignee.className = 'ecru-editeur__poignee';
      poignee.setAttribute('aria-hidden', 'true');
      poignee.hidden = true;
      editeur.appendChild(poignee);
      poignee.addEventListener('pointerdown', function (ev) {
        var e = element(selection);
        var n = e && editeur.querySelector('[data-el="' + e.id + '"]');
        if (!n) return;
        ev.stopPropagation();
        ev.preventDefault();
        poignee.setPointerCapture(ev.pointerId);
        var r = n.getBoundingClientRect();
        var c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        etire = { c: c, d: Math.max(8, Math.hypot(ev.clientX - c.x, ev.clientY - c.y)), s: e.s, e: e };
      });
      poignee.addEventListener('pointermove', function (ev) {
        if (!etire) return;
        var d = Math.hypot(ev.clientX - etire.c.x, ev.clientY - etire.c.y);
        redimensionner(etire.e, (etire.s * d) / etire.d);
        placerPoignee();
      });
      var finEtire = function () {
        if (!etire) return;
        etire = null;
        dessinerEditeur();
        rendre(false);
      };
      poignee.addEventListener('pointerup', finEtire);
      poignee.addEventListener('pointercancel', finEtire);
      window.addEventListener('resize', placerPoignee);
    }

    function brancherGlisser(n) {
      var depart = null;
      var doigts = {};
      var pince = null;
      n.addEventListener('pointerdown', function (ev) {
        var e = element(n.dataset.el);
        if (!e) return;
        doigts[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
        var ids = Object.keys(doigts);
        if (ids.length === 2) {
          // Deux doigts : pincer pour réduire, écarter pour agrandir
          var a = doigts[ids[0]];
          var b = doigts[ids[1]];
          pince = { d: Math.max(8, Math.hypot(a.x - b.x, a.y - b.y)), s: e.s };
          depart = null;
          return;
        }
        selectionner(e.id);
        n.setPointerCapture(ev.pointerId);
        var r = editeur.getBoundingClientRect();
        depart = { px: ev.clientX, py: ev.clientY, x: e.x, y: e.y, w: r.width, h: r.height };
        ev.preventDefault();
      });
      n.addEventListener('pointermove', function (ev) {
        if (doigts[ev.pointerId]) doigts[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
        if (pince) {
          var ids = Object.keys(doigts);
          if (ids.length < 2) return;
          var a = doigts[ids[0]];
          var b = doigts[ids[1]];
          redimensionner(element(n.dataset.el), (pince.s * Math.hypot(a.x - b.x, a.y - b.y)) / pince.d);
          return;
        }
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
        placerPoignee();
        rendreBientot();
      });
      function fin(ev) {
        if (ev) delete doigts[ev.pointerId];
        if (pince) {
          if (Object.keys(doigts).length < 2) {
            pince = null;
            dessinerEditeur();
            rendre(false);
          }
          return;
        }
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
        if (ev.key === '+' || ev.key === '=' || ev.key === '-' || ev.key === '−') {
          ev.preventDefault();
          redimensionner(e, e.s * (ev.key === '-' || ev.key === '−' ? 0.92 : 1.08));
          rendre(false);
          return;
        }
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

    function sansLogo(l) {
      return l.filter(function (e) {
        return e.t !== 'logo';
      });
    }
    function retirerLogo() {
      elements = sansLogo(elements);
      faces.recto = sansLogo(liste('recto'));
      faces.verso = sansLogo(liste('verso'));
      elements = faces[face];
      if (fichier) fichier.value = '';
      form.querySelector('[data-ecru-fichier-nom]').textContent = '';
      if (logoRetirer) logoRetirer.hidden = true;
      if (selection === 'logo') selection = null;
      dessinerEditeur();
      rendre(false);
    }

    if (editeur && champNom) {
      champNom.addEventListener('input', function () {
        var e = element(selection);
        if (!e || e.t !== 'text') {
          e = elements.find(function (x) {
            return x.t === 'text';
          });
        }
        if (!e) {
          e = { id: face + '-texte', t: 'text', v: '', x: 0.5, y: 0.55, s: 0.06, f: 'body', a: 'center' };
          elements.push(e);
        }
        e.v = champNom.value;
        selection = e.id;
        dessinerEditeur();
        rendreBientot();
      });
    }
    if (editeur && champTaille) {
      champTaille.addEventListener('input', function () {
        var e = element(selection);
        if (!e) return;
        e.s = champTaille.value / 100;
        dessinerEditeur();
        rendreBientot();
      });
    }
    if (editeur) {
      editeur.addEventListener('pointerdown', function (ev) {
        if (ev.target === editeur) selectionner(null);
      });
      if (logoRetirer) logoRetirer.addEventListener('click', retirerLogo);
      fichier.addEventListener('change', function () {
        var f = fichier.files && fichier.files[0];
        faces.recto = sansLogo(liste('recto'));
        faces.verso = sansLogo(liste('verso'));
        elements = faces[face];
        if (!f || !/^image\//.test(f.type)) {
          retirerLogo();
          return;
        }
        form.querySelector('[data-ecru-fichier-nom]').textContent = f.name;
        if (logoRetirer) logoRetirer.hidden = false;
        masquerLogo(URL.createObjectURL(f)).then(function (m) {
          if (!m) return;
          elements.push({ id: 'logo', t: 'logo', u: m.url, ratio: m.ratio, x: 0.66, y: 0.36, s: 0.26 });
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
      if (m === 'design') {
        // Première ouverture du sur mesure : on part d'un beau modèle plutôt que d'une carte vide
        if (!modeleApplique && !new URLSearchParams(window.location.search).get('modele')) appliquerModele('editorial');
        dessinerEditeur();
      }
    }

    function majMoq(options) {
      minimum = 1;
      var defini = false;
      if (data.moqProduit > 0) {
        minimum = data.moqProduit;
        defini = true;
      }
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

    // Prix : carte (selon la matière) + chaque lien rempli, par carte ; option fidélité au mois
    var totalEl = form.querySelector('[data-ecru-total]');
    var prixEl = root.querySelector('[data-ecru-prix]');
    var caseFidelite = form.querySelector('[data-ecru-fidelite]');
    var detailsFidelite = form.querySelector('[data-ecru-fidelite-details]');
    var argent = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: data.devise || 'EUR' });
    function avecFidelite() {
      return !!(caseFidelite && caseFidelite.checked);
    }
    function nbLiens() {
      if (!data.lien) return 0;
      return [].filter.call(form.querySelectorAll('[data-ecru-liens] input[type=url]:not([disabled])'), function (c) {
        return c.value.trim() !== '';
      }).length;
    }
    function majTotal() {
      var v = variants.find(function (x) {
        return String(x.id) === String(input.value);
      });
      if (!v) return;
      var n = nbLiens();
      var unite = v.price + n * (data.lien ? data.lien.prix : 0);
      if (prixEl) prixEl.textContent = argent.format(unite / 100);
      if (!totalEl) return;
      var q = parseInt(quantite.value, 10) || 0;
      var texte = 'Total : ' + argent.format((unite * q) / 100) + ' pour ' + q + ' cartes';
      if (n) texte += ' (dont ' + n + (n > 1 ? ' liens' : ' lien') + ')';
      if (avecFidelite() && data.mois) texte += ' + ' + argent.format(data.mois / 100) + ' / mois';
      totalEl.textContent = texte;
    }
    quantite.addEventListener('input', majTotal);
    form.addEventListener('input', function (e) {
      if (e.target.type === 'url') majTotal();
    });
    function majFidelite() {
      var on = avecFidelite();
      if (detailsFidelite) {
        detailsFidelite.hidden = !on;
        detailsFidelite.querySelectorAll('input').forEach(function (c) {
          c.disabled = !on;
        });
      }
      majTotal();
    }
    if (caseFidelite) {
      caseFidelite.addEventListener('change', majFidelite);
      if (new URLSearchParams(window.location.search).get('fidelite') === '1') {
        caseFidelite.checked = true;
        majFidelite();
      }
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
      majTotal();
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
      if (champ) champ.value = teinte === 'auto' ? '' : teinte;
      form.querySelectorAll('[data-cible="' + cible + '"]').forEach(function (b) {
        b.setAttribute('aria-checked', b.dataset.teinte === teinte ? 'true' : 'false');
      });
      if (typeof majAssortiments === 'function') majAssortiments();
      dessinerEditeur();
      rendre(true);
    }
    form.querySelectorAll('[data-cible]').forEach(function (b) {
      b.addEventListener('click', function () {
        choisirTeinte(b.dataset.cible, b.dataset.teinte);
      });
    });
    // Recto / verso : on édite une face, la carte 3D se retourne pour la montrer
    var boutonsFace = form.querySelectorAll('[data-ecru-face]');
    function changerFace(f, sansVue) {
      if (f === face) return;
      faces[face] = elements;
      face = f;
      elements = faces[f];
      selection = null;
      if (editeur) editeur.classList.toggle('is-verso', f === 'verso');
      (boutonsFace || []).forEach(function (b) {
        b.setAttribute('aria-pressed', b.dataset.ecruFace === f ? 'true' : 'false');
      });
      var premier = elements.find(function (x) {
        return x.t === 'text';
      });
      if (champNom) {
        champNom.value = premier ? premier.v : '';
        champNom.placeholder = f === 'verso' ? 'Un texte au verso (facultatif)' : 'Votre marque';
      }
      dessinerEditeur();
      if (!sansVue && carte) carte.dispatchEvent(new CustomEvent('ecru:view', { detail: { view: f } }));
    }
    boutonsFace.forEach(function (b) {
      b.addEventListener('click', function () {
        changerFace(b.dataset.ecruFace);
      });
    });

    // Modèles : couleurs et mise en page d'un coup, tout reste modifiable
    function appliquerModele(nom) {
      var m = MODELES[nom];
      if (!m) return;
      modeleApplique = true;
      changerFace('recto', true);
      var logo = elements.filter(function (e) {
        return e.t === 'logo';
      });
      elements = m.elements.map(function (e, i) {
        var c = Object.assign({}, e);
        c.id = i === 0 ? 'nom' : 'texte' + i;
        return c;
      }).concat(logo);
      selection = 'nom';
      if (champNom) champNom.value = elements[0].v;
      form.querySelectorAll('[data-ecru-modele]').forEach(function (b) {
        b.setAttribute('aria-pressed', b.dataset.ecruModele === nom ? 'true' : 'false');
      });
      teintes.relief = m.relief;
      var champ = form.querySelector('[data-ecru-champ="relief"]');
      if (champ) champ.value = m.relief;
      form.querySelectorAll('[data-cible="relief"]').forEach(function (x) {
        x.setAttribute('aria-checked', x.dataset.teinte === m.relief ? 'true' : 'false');
      });
      choisirTeinte('fond', m.fond);
    }
    form.querySelectorAll('[data-ecru-modele]').forEach(function (b) {
      b.addEventListener('click', function () {
        appliquerModele(b.dataset.ecruModele);
      });
    });

    // Assortiments : jeux de couleurs (carte + marquage et/ou fenêtre NFC) choisis ensemble
    var assortiments = form.querySelectorAll('.ecru-assortiment');
    function poser(cible, teinte) {
      teintes[cible] = teinte;
      var champ = form.querySelector('[data-ecru-champ="' + cible + '"]');
      if (champ) champ.value = teinte === 'auto' ? '' : teinte;
      form.querySelectorAll('[data-cible="' + cible + '"]').forEach(function (x) {
        x.setAttribute('aria-checked', x.dataset.teinte === teinte ? 'true' : 'false');
      });
    }
    function majAssortiments() {
      if (!assortiments) return;
      assortiments.forEach(function (b) {
        var ok = b.dataset.fond === teintes.fond && (!b.dataset.relief || b.dataset.relief === teintes.relief) && (!b.dataset.fenetre || b.dataset.fenetre === teintes.fenetre);
        b.setAttribute('aria-pressed', ok ? 'true' : 'false');
      });
    }
    assortiments.forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.relief) poser('relief', b.dataset.relief);
        if (b.dataset.fenetre) poser('fenetre', b.dataset.fenetre);
        choisirTeinte('fond', b.dataset.fond);
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
        majTotal();
      });
    });
    form.addEventListener('submit', function (e) {
      if ((parseInt(quantite.value, 10) || 0) < minimum) {
        e.preventDefault();
        quantite.value = minimum;
        statut.textContent = 'Minimum de commande : ' + minimum + ' cartes.';
        return;
      }
      // Option fidélité : le logo est indispensable pour la page de fidélité
      if (avecFidelite() && !(fichier && fichier.files && fichier.files.length)) {
        e.preventDefault();
        statut.textContent = 'Ajoutez votre logo pour l’option fidélité : il s’affiche sur la page de vos clients.';
        var l = form.querySelector('label[for="' + (fichier && fichier.id) + '"]');
        if (l) {
          l.scrollIntoView({ block: 'center', behavior: 'smooth' });
          l.focus && fichier.focus();
        }
        return;
      }
      // Les cartes partent avec leurs options : liens (par carte) et abonnement fidélité
      var extras = [];
      var n = nbLiens();
      var q = parseInt(quantite.value, 10) || 0;
      if (n && data.lien) extras.push({ id: data.lien.id, quantity: n * q, properties: { Cartes: data.titre || '' } });
      var abo = data.abonnement;
      if (avecFidelite() && abo && abo.plan) extras.push({ id: abo.id, quantity: 1, selling_plan: abo.plan });
      if (!extras.length || !window.fetch) return;
      e.preventDefault();
      bouton.disabled = true;
      var racine = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
      fetch(racine + 'cart/add.js', { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) {
          if (!r.ok) throw r;
          return fetch(racine + 'cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ items: extras }),
          });
        })
        .then(function (r) {
          if (!r.ok) throw r;
          window.location.href = racine + 'cart';
        })
        .catch(function () {
          bouton.disabled = false;
          statut.textContent = 'L’ajout au panier n’a pas abouti. Réessayez.';
        });
    });

    // ---------- Liens supplémentaires (jusqu'à 4) ----------
    var ajoutLien = form.querySelector('[data-ecru-lien-ajout]');
    if (ajoutLien) {
      ajoutLien.addEventListener('click', function () {
        var suivant = form.querySelector('[data-ecru-lien-sup][hidden]');
        if (!suivant) return;
        suivant.hidden = false;
        var champ = suivant.querySelector('input');
        champ.disabled = false;
        champ.focus();
        if (!form.querySelector('[data-ecru-lien-sup][hidden]')) ajoutLien.hidden = true;
      });
    }

    // ---------- Retourner la carte ----------
    var retourner = root.querySelector('[data-ecru-retourner]');
    if (retourner && carte) {
      retourner.addEventListener('click', function () {
        var verso = retourner.getAttribute('aria-pressed') !== 'true';
        retourner.setAttribute('aria-pressed', verso ? 'true' : 'false');
        carte.dispatchEvent(new CustomEvent('ecru:view', { detail: { view: verso ? 'verso' : 'recto' } }));
      });
    }

    form.querySelectorAll('[data-cible="fond"][data-teinte="#0d0d0c"], [data-cible="relief"][data-teinte="#e9e4d8"], [data-cible="fenetre"][data-teinte="auto"]').forEach(function (b) {
      b.setAttribute('aria-checked', 'true');
    });
    maj();
    var modeleDemande = new URLSearchParams(window.location.search).get('modele');
    if (modeleDemande && MODELES[modeleDemande] && modeDe(choix()) === 'design') appliquerModele(modeleDemande);
    else if (modeDe(choix()) !== 'standard') rendre(false);
  }

  function initAll() {
    document.querySelectorAll('[data-ecru-produit]').forEach(init);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
  else initAll();
  document.addEventListener('shopify:section:load', initAll);
})();
