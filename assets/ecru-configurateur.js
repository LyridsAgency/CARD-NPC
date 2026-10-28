/* ECRU — configurateur produit : options, MOQ, éditeur sur mesure (couleur, nom, logo), retourner la carte.
   La carte 3D (ecru-carte-3d.js) reçoit chaque changement par l'événement « ecru:card-update ». */
(function () {
  if (window.__ecruConfigurateur) return;
  window.__ecruConfigurateur = true;

  // Modèles prêts à personnaliser (mêmes réglages que les rendus assets/ecru-modele-*.webp)
  var MODELES = {"editorial":{"titre":"Éditorial","fond":"#0d0d0c","relief":"#e9e4d8","elements":[{"t":"text","v":"ECRU","x":0.37,"y":0.8,"s":0.24,"f":"display","a":"left","k":-0.01},{"t":"text","v":"Cartes NFC","x":0.37,"y":0.14,"s":0.045,"f":"body","a":"left"}]},"minimal":{"titre":"Minimal","fond":"#e9e4d8","relief":"#121211","elements":[{"t":"text","v":"ECRU","x":0.95,"y":0.86,"s":0.06,"f":"body","a":"right","k":0.3},{"t":"text","v":"N° 001","x":0.95,"y":0.14,"s":0.045,"f":"body","a":"right"}]},"monogramme":{"titre":"Monogramme","fond":"#0d0d0c","relief":"#7d7b76","elements":[{"t":"text","v":"E","x":1.03,"y":0.8,"s":1.3,"f":"display","a":"right","k":-0.01},{"t":"text","v":"ECRU","x":0.37,"y":0.14,"s":0.05,"f":"body","a":"left","k":0.3}]},"signature":{"titre":"Signature","fond":"#d6cfbf","relief":"#2e2c28","elements":[{"t":"text","v":"ECRU","x":0.655,"y":0.47,"s":0.1,"f":"display","a":"center","k":0.12},{"t":"text","v":"Un geste. Tout s’ouvre.","x":0.655,"y":0.6,"s":0.042,"f":"body","a":"center"}]},"numero":{"titre":"Numéro","fond":"#2a2926","relief":"#e9e4d8","elements":[{"t":"text","v":"Nº7","x":0.95,"y":0.66,"s":0.42,"f":"display","a":"right","k":-0.01},{"t":"text","v":"ECRU","x":0.37,"y":0.14,"s":0.05,"f":"body","a":"left","k":0.3}]},"pierre":{"titre":"Pierre","fond":"#8f8a80","relief":"#121211","elements":[{"t":"text","v":"ECRU","x":0.37,"y":0.16,"s":0.085,"f":"display","a":"left","k":0.04},{"t":"text","v":"Cartes NFC","x":0.37,"y":0.28,"s":0.045,"f":"body","a":"left"},{"t":"text","v":"Sur mesure","x":0.95,"y":0.86,"s":0.04,"f":"body","a":"right"}]}};

  // Polices des cartes : mêmes définitions que la 3D (tools/src/ecru-carte-3d.js, POLICES)
  var POLICES = {
    affiche: { nom: 'Affiche', famille: '"Archivo Black", sans-serif', graisse: 400, majuscules: true, k: 0.12 },
    moderne: { nom: 'Moderne', famille: 'Inter, sans-serif', graisse: 500, majuscules: false, k: 0.04 },
    elegante: { nom: 'Élégante', famille: '"ECRU Playfair", serif', graisse: 600, majuscules: false, k: 0.01 },
    classique: { nom: 'Classique', famille: '"ECRU Cormorant", serif', graisse: 500, style: 'italic', majuscules: false, k: 0.01 },
    condensee: { nom: 'Condensée', famille: '"ECRU Bebas", sans-serif', graisse: 400, majuscules: true, k: 0.06 },
    geometrique: { nom: 'Géométrique', famille: '"ECRU Grotesk", sans-serif', graisse: 500, majuscules: false, k: 0 },
    signature: { nom: 'Signature', famille: '"ECRU Script", cursive', graisse: 400, majuscules: false, k: 0 },
  };
  function policeDe(e) {
    return POLICES[e.p] ? e.p : e.f === 'body' ? 'moderne' : 'affiche';
  }

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
      // Logo d'une commande passée (cdn.shopify.com) : lu sans « salir » le canevas
      if (/^https?:/.test(url)) img.crossOrigin = 'anonymous';
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
    var teintes = { fond: '#0d0d0c', relief: '#e9e4d8', fenetre: 'auto', page: '#0d0d0c' };

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
    // Recommande : logo de la commande d'origine (champ caché) et abonnement fidélité déjà en cours
    var logoAncien = null;
    var dejaAbonne = false;
    function oublierLogoAncien() {
      if (!logoAncien) return;
      logoAncien.remove();
      logoAncien = null;
      if (fichier) fichier.name = 'properties[Logo]';
    }

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
      // Sans choix de matière (cartes simples) : PVC
      var finish = options.some(function (o) {
        return /m[ée]tal/.test(bas(o));
      })
        ? 'metal'
        : 'mat';
      var color = '#0d0d0c';
      options.forEach(function (o) {
        var v = bas(o);
        if (v.indexOf('pvc') !== -1) finish = 'mat';
        if (data.couleurs[v]) color = data.couleurs[v];
      });
      // Métal : satiné, brossé ou chromé, au choix
      var finitionChoisie = form.querySelector('[data-ecru-finition-choix]:checked:not(:disabled)');
      if (finish === 'metal' && finitionChoisie) finish = finitionChoisie.dataset.ecruFinitionChoix;
      var look = { finish: finish, elements: [] };
      if (modeDe(options) === 'design') {
        color = teintes.fond;
        look.ink = teintes.relief;
        var pourLa3d = function (e) {
          return { t: e.t, v: e.v, u: e.u, x: e.x, y: e.y, s: e.s, f: e.f, p: e.p, a: e.a || 'center', k: e.k };
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
      // Sur la grande carte, le dessin suit le doigt ; sinon on attend la fin du geste
      attente = setTimeout(function () {
        rendre(false);
      }, surCarte ? 40 : 220);
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
          var pol = POLICES[policeDe(e)];
          n.classList.remove('ecru-editeur__el--titre');
          n.style.fontFamily = pol.famille;
          n.style.fontWeight = pol.graisse;
          n.style.fontStyle = pol.style || 'normal';
          contenu.textContent = pol.majuscules ? e.v.toUpperCase() : e.v;
          n.style.letterSpacing = (e.k != null ? e.k : pol.k) + 'em';
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

    var boutonsPolice = form.querySelectorAll('[data-ecru-police]');
    // La police s'applique au texte sélectionné, sinon au premier texte de la face
    function texteCible() {
      var e = element(selection);
      if (e && e.t === 'text') return e;
      return visibles().find(function (x) {
        return x.t === 'text';
      });
    }
    function marquerPolice() {
      if (!boutonsPolice) return;
      var e = texteCible();
      var cle = e ? policeDe(e) : '';
      boutonsPolice.forEach(function (b) {
        b.setAttribute('aria-checked', b.dataset.ecruPolice === cle ? 'true' : 'false');
      });
    }
    boutonsPolice.forEach(function (b) {
      b.addEventListener('click', function () {
        var e = texteCible();
        if (!e) return;
        e.p = b.dataset.ecruPolice;
        delete e.k;
        dessinerEditeur();
        rendre(true);
      });
    });

    function majReglages() {
      marquerPolice();
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
      champTaille.max = estTexte ? 130 : Math.round(borner(e, 9) * 100);
      champTaille.value = Math.round(e.s * 100);
    }

    // Résumé lisible de la maquette, envoyé avec la commande
    function majMaquette() {
      var lisible = form.querySelector('[data-ecru-maquette]');
      var brut = form.querySelector('[data-ecru-maquette-json]');
      if (!lisible) return;
      var resume = function (e) {
        var pos = 'position ' + pct(e.x) + ' / ' + pct(e.y) + ', taille ' + Math.round(e.s * 100);
        return e.t === 'logo' ? 'Logo (' + pos + ')' : 'Texte « ' + e.v + ' » en ' + POLICES[policeDe(e)].nom + ' (' + pos + ')';
      };
      var brutDe = function (e) {
        return { t: e.t, v: e.t === 'text' ? e.v : undefined, x: +e.x.toFixed(3), y: +e.y.toFixed(3), s: +e.s.toFixed(3), f: e.f, p: e.t === 'text' ? policeDe(e) : undefined, a: e.a };
      };
      var verso = visibles('verso');
      var fen = teintes.fenetre !== 'auto' ? ', fenêtre NFC ' + teintes.fenetre.toUpperCase() : '';
      lisible.value = 'Fond ' + teintes.fond.toUpperCase() + fen + ' | Recto : ' + (visibles('recto').map(resume).join(' ; ') || 'vierge') + (verso.length ? ' | Verso : ' + verso.map(resume).join(' ; ') : '');
      brut.value = JSON.stringify({ recto: visibles('recto').map(brutDe), verso: verso.map(brutDe) });
      // Résumé lisible pour le client (panier, e-mails) : textes, polices, logo ; le détail technique reste caché
      var design = form.querySelector('[data-ecru-design]');
      if (design) {
        var court = function (e) {
          return e.t === 'logo' ? 'logo' : '« ' + e.v + ' » (' + POLICES[policeDe(e)].nom + ')';
        };
        var r = visibles('recto').map(court).join(', ');
        design.value = 'Recto : ' + (r || 'vierge') + (verso.length ? ' · Verso : ' + verso.map(court).join(', ') : '');
      }
    }

    function guides(x, y) {
      editeur.classList.toggle('is-centre-v', Math.abs(x - 0.5) < 0.012);
      editeur.classList.toggle('is-centre-h', Math.abs(y - 0.5) < 0.012);
    }

    // Taille : bornes selon le type d'élément
    // Logo : 60 % de la hauteur de la carte au plus, et jamais plus large que 60 % de sa largeur
    var RATIO_CARTE = 85.6 / 54;
    var LOGO_MAX = 0.6;
    function borner(e, s) {
      if (e.t !== 'logo') return Math.max(0.025, Math.min(1.4, s));
      var maxLargeur = (LOGO_MAX * RATIO_CARTE) / (e.ratio || 1);
      return Math.max(0.06, Math.min(LOGO_MAX, maxLargeur, s));
    }
    // Le logo reste entier sur la carte (les textes, eux, peuvent déborder volontairement)
    function garderDansCarte(e) {
      if (!e || e.t !== 'logo') return;
      var demiL = (e.s * (e.ratio || 1)) / RATIO_CARTE / 2;
      var demiH = e.s / 2;
      e.x = Math.max(demiL + 0.02, Math.min(1 - demiL - 0.02, e.x));
      e.y = Math.max(demiH + 0.03, Math.min(1 - demiH - 0.03, e.y));
    }
    // Place libre pour un nouveau logo : loin des textes et de la fenêtre NFC
    function boite(e) {
      if (e.t === 'logo') {
        var l = (e.s * (e.ratio || 1)) / RATIO_CARTE;
        return [e.x - l / 2, e.y - e.s / 2, e.x + l / 2, e.y + e.s / 2];
      }
      var larg = (e.s * String(e.v || '').length * 0.62) / RATIO_CARTE;
      var x0 = e.a === 'left' ? e.x : e.a === 'right' ? e.x - larg : e.x - larg / 2;
      return [x0, e.y - e.s / 2, x0 + larg, e.y + e.s / 2];
    }
    function recouvrement(a, b) {
      return Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    }
    function placerLogo(logo) {
      var occupe = elements.filter(function (e) {
        return e !== logo && (e.t === 'logo' ? !!e.u : !!(e.v && e.v.trim()));
      }).map(boite);
      if (teintes.fenetre !== 'aucune') occupe.push([0, 0, 0.3, 1]);
      var places = [[0.66, 0.36], [0.82, 0.3], [0.82, 0.7], [0.62, 0.62], [0.5, 0.25], [0.5, 0.75], [0.66, 0.5]];
      var meilleur = null;
      [0.26, 0.2, 0.15].some(function (taille) {
        places.forEach(function (pl) {
          var essai = { t: 'logo', ratio: logo.ratio, s: borner(logo, taille), x: pl[0], y: pl[1] };
          garderDansCarte(essai);
          var b = boite(essai);
          var gene = occupe.reduce(function (t, o) {
            return t + recouvrement(b, o);
          }, 0);
          if (!meilleur || gene < meilleur.gene - 1e-6) meilleur = { gene: gene, x: essai.x, y: essai.y, s: essai.s };
        });
        return meilleur.gene < 1e-4;
      });
      logo.x = meilleur.x;
      logo.y = meilleur.y;
      logo.s = meilleur.s;
    }
    function redimensionner(e, s) {
      e.s = borner(e, s);
      garderDansCarte(e);
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
        garderDansCarte(e);
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
          garderDansCarte(e);
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
      oublierLogoAncien();
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
        e.s = borner(e, champTaille.value / 100);
        garderDansCarte(e);
        dessinerEditeur();
        rendreBientot();
      });
    }
    if (editeur) {
      editeur.addEventListener('pointerdown', function (ev) {
        if (ev.target === editeur) selectionner(null);
      });
      if (logoRetirer)
        logoRetirer.addEventListener('click', function () {
          retirerLogo();
          logoPageFidelite(null);
        });
      fichier.addEventListener('change', function () {
        var f = fichier.files && fichier.files[0];
        oublierLogoAncien();
        faces.recto = sansLogo(liste('recto'));
        faces.verso = sansLogo(liste('verso'));
        elements = faces[face];
        if (!f || !/^image\//.test(f.type)) {
          retirerLogo();
          logoPageFidelite(null);
          return;
        }
        logoPageFidelite(f);
        form.querySelector('[data-ecru-fichier-nom]').textContent = f.name;
        if (logoRetirer) logoRetirer.hidden = false;
        masquerLogo(URL.createObjectURL(f)).then(function (m) {
          if (!m) return;
          var logo = { id: 'logo', t: 'logo', u: m.url, ratio: m.ratio, x: 0.66, y: 0.36, s: 0.26 };
          placerLogo(logo);
          elements.push(logo);
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
      if (avecFidelite() && dejaAbonne) texte += ' · fidélité incluse dans votre abonnement';
      else if (avecFidelite() && data.mois) texte += ' + ' + argent.format(data.mois / 100) + ' / mois';
      totalEl.textContent = texte;
    }
    quantite.addEventListener('input', majTotal);
    form.addEventListener('input', function (e) {
      if (e.target.type === 'url') majTotal();
    });
    // Client déjà abonné : la fidélité est incluse, jamais refacturée
    dejaAbonne = !!(data.dejaAbonne && caseFidelite);
    if (dejaAbonne) {
      caseFidelite.value = 'Incluse dans mon abonnement';
      var prixInclus = form.querySelector('.ecru-interrupteur__prix');
      if (prixInclus) prixInclus.textContent = 'Incluse';
      var texteInclus = form.querySelector('.ecru-interrupteur__texte > span');
      if (texteInclus) texteInclus.textContent = 'Vous êtes déjà abonné : ces cartes rejoignent votre programme, sans rien repayer.';
    }
    // Recommande sans fidélité : des cartes simples, qui ont besoin de leur lien
    var enRecommande = false;
    var champLien = form.querySelector('[name="properties[Lien]"]');
    function majLienExige() {
      if (!champLien) return;
      var exige = enRecommande && !avecFidelite();
      champLien.required = exige;
      var bloc = champLien.closest('.ecru-champ');
      bloc.classList.toggle('is-exige', exige);
      var aide = bloc.querySelector('[data-ecru-lien-exige]');
      if (exige && !aide) {
        aide = document.createElement('p');
        aide.className = 'ecru-champ__aide';
        aide.dataset.ecruLienExige = '';
        aide.textContent = 'Sans fidélité, la carte ouvre ce lien : votre site, votre menu ou votre page d’avis.';
        bloc.appendChild(aide);
      }
      if (aide) aide.hidden = !exige;
    }
    function majFidelite() {
      var on = avecFidelite();
      majLienExige();
      if (detailsFidelite) {
        detailsFidelite.hidden = !on;
        detailsFidelite.querySelectorAll('input').forEach(function (c) {
          c.disabled = !on;
        });
      }
      majTotal();
    }
    // Réglages fidélité : la grande carte reprend sa rotation, l'aperçu du téléphone s'anime
    var fieldsetFid = form.querySelector('.ecru-option--fidelite');
    var animFid = 0;
    function animerPageFidelite(on) {
      clearInterval(animFid);
      if (!on || !ecranFid || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var tampons = ecranFid.querySelectorAll('.ecru-apercu__tampons i');
      var n = ecranFid.querySelector('.ecru-apercu__compte b');
      var msg = ecranFid.querySelector('.ecru-apercu__offre');
      var compte = 7;
      animFid = setInterval(function () {
        compte = compte >= 10 ? 1 : compte + 1;
        tampons.forEach(function (t, i) {
          t.classList.toggle('is-plein', i < compte);
          t.classList.toggle('is-nouveau', i === compte - 1);
        });
        if (n) n.textContent = compte;
        if (msg) msg.textContent = compte >= 10 ? 'Récompense disponible : montrez cette page en caisse.' : 'Plus que ' + (10 - compte) + (10 - compte > 1 ? ' visites' : ' visite') + ' : votre récompense.';
        ecranFid.classList.toggle('is-recompense', compte >= 10);
      }, 2200);
    }
    function libererCarte() {
      if (surCarte && modeEdition) edition(false);
      if (carte) carte.dispatchEvent(new CustomEvent('ecru:view', { detail: { view: 'auto' } }));
      if (typeof marquerVue === 'function') marquerVue('');
    }
    if (fieldsetFid)
      ['pointerdown', 'focusin'].forEach(function (t) {
        fieldsetFid.addEventListener(t, libererCarte);
      });
    if (caseFidelite) {
      majPageFidelite();
      caseFidelite.addEventListener('change', function () {
        animerPageFidelite(caseFidelite.checked);
      });
      caseFidelite.addEventListener('change', majFidelite);
      if (new URLSearchParams(window.location.search).get('fidelite') === '1') {
        caseFidelite.checked = true;
        majFidelite();
        // Après l'initialisation complète (l'aperçu du téléphone est déclaré plus bas)
        setTimeout(function () {
          majPageFidelite();
          animerPageFidelite(true);
        }, 0);
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
      // La finition ne concerne que le métal
      var finition = form.querySelector('[data-ecru-finition]');
      if (finition) {
        var estMetal = sel.some(function (o) {
          return /m[ée]tal/i.test(o || '');
        });
        finition.hidden = !estMetal;
        finition.querySelectorAll('input').forEach(function (r) {
          r.disabled = !estMetal;
        });
      }
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

    function marquerTeinte(cible, teinte) {
      var champ = form.querySelector('[data-ecru-champ="' + cible + '"]');
      if (champ) champ.value = teinte === 'auto' ? '' : teinte;
      form.querySelectorAll('[data-cible="' + cible + '"]').forEach(function (b) {
        b.setAttribute('aria-checked', b.dataset.teinte === teinte ? 'true' : 'false');
      });
    }
    // Aperçu de la page de fidélité : la couleur choisie en fond, le texte crème ou noir pour rester lisible
    // (même règle que la vraie page, fidelite/src/pages.js)
    var ecranFid = form.querySelector('[data-ecru-fid-ecran]');
    function majPageFidelite() {
      var fond = teintes.page || '#0d0d0c';
      marquerTeinte('page', fond);
      // Dans la commande : le nom de la couleur et son code (« Vert sapin · #1f3a2e »)
      var champPage = form.querySelector('[data-ecru-champ="page"]');
      var pastille = form.querySelector('[data-cible="page"][data-teinte="' + fond + '"]');
      if (champPage) champPage.value = (pastille ? pastille.title : 'Sur mesure') + ' · ' + fond;
      if (!ecranFid) return;
      ecranFid.style.setProperty('--fid-fond', fond);
      ecranFid.style.setProperty('--fid-rgb', clarte(fond) > 150 ? '18, 18, 17' : '233, 228, 216');
    }
    function logoPageFidelite(f) {
      var zone = form.querySelector('[data-ecru-fid-logo]');
      var nom = form.querySelector('[data-ecru-fid-logo-nom]');
      if (!zone) return;
      zone.textContent = '';
      if (f) {
        var img = new Image();
        img.alt = '';
        img.src = URL.createObjectURL(f);
        zone.appendChild(img);
        zone.classList.add('a-logo');
        if (nom) nom.textContent = f.name;
      } else {
        zone.textContent = 'Votre logo';
        zone.classList.remove('a-logo');
        if (nom) nom.textContent = 'De préférence sur fond transparent.';
      }
    }
    function choisirTeinte(cible, teinte) {
      teintes[cible] = teinte;
      if (cible === 'page') {
        majPageFidelite();
        return;
      }
      var champ = form.querySelector('[data-ecru-champ="' + cible + '"]');
      if (champ) champ.value = teinte === 'auto' ? '' : teinte;
      marquerTeinte(cible, teinte);
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
      if (surCarte && modeEdition) edition(true);
      else if (!sansVue && carte) carte.dispatchEvent(new CustomEvent('ecru:view', { detail: { view: f } }));
    }

    // ---------- Édition sur la grande carte ----------
    // Dès que la 3D est prête, l'éditeur quitte le panneau et se pose sur la grande carte :
    // la carte se met de face, le calque d'édition (poignées, cadres) suit exactement sa place.
    // Sans 3D (WebGL indisponible), l'éditeur reste dans le panneau.
    var surCarte = false;
    var modeEdition = false;
    var bouton3d = root.querySelector('[data-ecru-mode-3d]');
    function edition(on) {
      modeEdition = on;
      if (on && typeof marquerVue === 'function') marquerVue('');
      root.classList.toggle('is-edition', on && surCarte);
      if (carte) carte.dispatchEvent(new CustomEvent('ecru:edition', { detail: { face: on ? face : null } }));
      if (bouton3d) {
        bouton3d.setAttribute('aria-pressed', on ? 'false' : 'true');
        bouton3d.querySelector('span').textContent = on ? 'Voir en 3D' : 'Modifier';
      }
    }
    function installerSurCarte() {
      if (surCarte || !editeur || !carte || !data.surMesure || carte.classList.contains('is-fallback')) return;
      var scene = carte.querySelector('[data-ecru-stage]');
      if (!scene) return;
      scene.appendChild(editeur);
      editeur.classList.add('ecru-editeur--surcarte');
      surCarte = true;
      if (bouton3d) bouton3d.hidden = false;
      edition(true);
      dessinerEditeur();
    }
    if (data.surMesure && carte && editeur) {
      if (carte.classList.contains('is-ready')) installerSurCarte();
      else
        new MutationObserver(function (m, o) {
          if (!carte.classList.contains('is-ready')) return;
          o.disconnect();
          installerSurCarte();
        }).observe(carte, { attributes: true, attributeFilter: ['class'] });
      if (bouton3d)
        bouton3d.addEventListener('click', function () {
          edition(!modeEdition);
        });
      // Toucher un réglage du design repose la carte de face
      var panneauDesign = form.querySelector('[data-ecru-panneau="design"]');
      if (panneauDesign)
        ['pointerdown', 'focusin'].forEach(function (t) {
          panneauDesign.addEventListener(t, function () {
            if (surCarte && !modeEdition) edition(true);
          });
        });
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
      if (e.target.dataset.ecruFinitionChoix) rendre(true);
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
      if (avecFidelite() && !dejaAbonne && !logoAncien && !(fichier && fichier.files && fichier.files.length)) {
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
      // Option fidélité : l'abonnement mensuel part toujours avec les cartes.
      // Sans formule d'abonnement configurée (Shopify Subscriptions), le premier mois est ajouté, clairement indiqué.
      if (avecFidelite() && !dejaAbonne && abo && abo.id)
        extras.push(
          abo.plan
            ? { id: abo.id, quantity: 1, selling_plan: abo.plan }
            : { id: abo.id, quantity: 1, properties: { Facturation: 'Premier mois. Le prélèvement mensuel est mis en place à la validation de votre commande.' } }
        );
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

    // ---------- Points de vue ----------
    var boutonsVue = root.querySelectorAll('[data-ecru-vue]');
    function marquerVue(v) {
      boutonsVue.forEach(function (b) {
        b.setAttribute('aria-pressed', b.dataset.ecruVue === v ? 'true' : 'false');
      });
    }
    boutonsVue.forEach(function (b) {
      b.addEventListener('click', function () {
        if (!carte) return;
        marquerVue(b.dataset.ecruVue);
        // Sans 3D (téléphone sans WebGL, chargement en cours) : on affiche la photo de ce point de vue
        if (!carte.classList.contains('is-ready')) {
          var affiche = carte.querySelector('.ecru-carte__affiche-img');
          var photo = b.querySelector('img');
          if (affiche && photo) {
            affiche.removeAttribute('srcset');
            affiche.src = photo.currentSrc || photo.src;
          }
          return;
        }
        if (surCarte && modeEdition) edition(false);
        carte.dispatchEvent(new CustomEvent('ecru:view', { detail: { view: b.dataset.ecruVue } }));
        // 360° : un tour puis la carte reste libre ; aucune vue ne reste « choisie »
        if (b.dataset.ecruVue === 'tour')
          setTimeout(function () {
            marquerVue('');
          }, 1800);
      });
    });
    if (carte)
      carte.addEventListener('ecru:tournee', function () {
        marquerVue('');
      });

    // ---------- Retourner la carte ----------
    var retourner = root.querySelector('[data-ecru-retourner]');
    if (retourner && carte) {
      retourner.addEventListener('click', function () {
        if (surCarte && modeEdition) {
          changerFace(face === 'recto' ? 'verso' : 'recto');
          retourner.setAttribute('aria-pressed', face === 'verso' ? 'true' : 'false');
          return;
        }
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
    recommander(new URLSearchParams(window.location.search).get('recommande'));

    // ---------- Recommande : la commande d'origine, reprise à l'identique ----------
    // ?recommande= (page « Votre compte ») : { v: variante, q: quantité, p: propriétés de la ligne }, en base64 url
    function lire(code) {
      try {
        var b = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
        var octets = new Uint8Array(b.length);
        for (var i = 0; i < b.length; i++) octets[i] = b.charCodeAt(i);
        return JSON.parse(new TextDecoder().decode(octets));
      } catch (e) {
        return null;
      }
    }
    function teinte(v) {
      return /^#[0-9a-f]{6}$/i.test(v || '') ? v : null;
    }
    function recommander(code) {
      var r = code && lire(code);
      if (!r || !r.p) return;
      var p = r.p;
      // Finition du métal
      var fin = p['Finition métal'] && [].find.call(form.querySelectorAll('[data-ecru-finition-choix]'), function (x) {
        return x.value === p['Finition métal'];
      });
      if (fin && !fin.disabled) fin.checked = true;
      // Couleurs et design (sur mesure)
      if (modeDe(choix()) === 'design') {
        modeleApplique = true;
        if (teinte(p._Couleur)) poser('fond', p._Couleur);
        if (teinte(p._Marquage)) poser('relief', p._Marquage);
        poser('fenetre', teinte(p['_Fenêtre NFC']) || 'auto');
        var maquette = null;
        try {
          maquette = JSON.parse(p._maquette || 'null');
        } catch (e) {}
        if (maquette) {
          changerFace('recto', true);
          var repris = function (l, f) {
            var n = 0;
            return (l || [])
              .filter(function (e) {
                return e && (e.t === 'text' || e.t === 'logo') && isFinite(e.x) && isFinite(e.y) && isFinite(e.s);
              })
              .map(function (e) {
                var c = { t: e.t, x: +e.x, y: +e.y, s: +e.s, f: e.f === 'body' ? 'body' : 'display', a: e.a || 'center' };
                if (e.t === 'text') {
                  c.v = String(e.v || '');
                  if (POLICES[e.p]) c.p = e.p;
                  c.id = f === 'recto' && n === 0 ? 'nom' : f + '-texte' + n;
                  n++;
                } else c.id = 'logo';
                return c;
              });
          };
          var recto = repris(maquette.recto, 'recto');
          var verso = repris(maquette.verso, 'verso');
          // Le logo de la commande (fichier déjà envoyé à Shopify) : gardé tel quel, sauf si un nouveau est choisi
          // (fichiers Shopify uniquement : cdn.shopify.com ou /cdn/shop/ de la boutique)
          var urlLogo = /^(https:\/\/cdn\.shopify\.com\/|\/cdn\/shop\/)/.test(p.Logo || '') ? p.Logo : null;
          var avecLogo = function (e) {
            return e.t !== 'logo' || urlLogo;
          };
          elements = faces.recto = recto.filter(avecLogo);
          faces.verso = verso.filter(avecLogo);
          var champ = elements.find(function (e) {
            return e.t === 'text';
          });
          if (champNom && champ) champNom.value = champ.v;
          if (urlLogo && fichier) {
            logoAncien = document.createElement('input');
            logoAncien.type = 'hidden';
            logoAncien.name = 'properties[Logo]';
            logoAncien.value = urlLogo;
            fichier.removeAttribute('name');
            fichier.insertAdjacentElement('afterend', logoAncien);
            form.querySelector('[data-ecru-fichier-nom]').textContent = 'Logo de votre commande';
            if (logoRetirer) logoRetirer.hidden = false;
            var zone = form.querySelector('[data-ecru-fid-logo]');
            if (zone) {
              var img = new Image();
              img.alt = '';
              img.src = urlLogo;
              zone.textContent = '';
              zone.appendChild(img);
              zone.classList.add('a-logo');
            }
            masquerLogo(urlLogo).then(function (m) {
              if (!m) return;
              ['recto', 'verso'].forEach(function (f) {
                liste(f).forEach(function (e) {
                  if (e.t !== 'logo') return;
                  e.u = m.url;
                  e.ratio = m.ratio;
                });
              });
              dessinerEditeur();
              rendre(false);
            });
          }
        }
        majAssortiments();
        dessinerEditeur();
      }
      // Liens
      ['Lien', 'Lien 2', 'Lien 3', 'Lien 4'].forEach(function (cle) {
        var c = form.querySelector('[name="properties[' + cle + ']"]');
        if (!c || !p[cle]) return;
        c.value = p[cle];
        c.disabled = false;
        var bloc = c.closest('[data-ecru-lien-sup]');
        if (bloc) bloc.hidden = false;
      });
      if (ajoutLien && !form.querySelector('[data-ecru-lien-sup][hidden]')) ajoutLien.hidden = true;
      // Fidélité : l'abonnement en cours continue, il n'est pas ajouté au panier une seconde fois
      // Abonné : les cartes rejoignent son programme (rien à repayer), qu'elles l'aient eu ou non.
      // Il peut décocher : ce seront des cartes simples, avec leur lien.
      enRecommande = true;
      var avaitFidelite = !!p['Option fidélité'];
      // « Vert sapin · #1f3a2e » (ou un ancien « #1f3a2e » seul)
      var hexPage = String(p['Couleur page fidélité'] || '').split('·').pop().trim();
      if (teinte(hexPage)) {
        teintes.page = hexPage.toLowerCase();
        majPageFidelite();
      }
      if (caseFidelite && (dejaAbonne || avaitFidelite)) {
        if (dejaAbonne) caseFidelite.value = 'Incluse dans mon abonnement' + (p._commande ? ' (recommande de ' + p._commande + ')' : '');
        caseFidelite.checked = true;
      }
      majFidelite();
      // Quantité
      var q = parseInt(r.q, 10);
      if (q > 0) quantite.value = Math.max(minimum, q);
      majTotal();
      rendre(true);
      // Ce qui a été repris, dit simplement en haut du formulaire
      var note = document.createElement('p');
      note.className = 'ecru-recommande';
      note.setAttribute('role', 'status');
      note.textContent =
        'Recommande' + (p._commande ? ' de la commande ' + p._commande : '') + ' : tout est repris à l’identique. Changez ce que vous voulez, puis ajoutez au panier.' +
        (dejaAbonne && caseFidelite
          ? ' Ces cartes rejoignent votre programme de fidélité, sans rien repayer. Vous n’en voulez pas ? Décochez la fidélité : ce seront des cartes simples qui ouvrent votre lien.'
          : '');
      form.insertBefore(note, form.firstChild);
    }
  }

  function initAll() {
    document.querySelectorAll('[data-ecru-produit]').forEach(init);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
  else initAll();
  document.addEventListener('shopify:section:load', initAll);
})();
