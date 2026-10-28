// Pages HTML (rendu serveur, sans JavaScript côté téléphone) aux couleurs du commerce.

export function echapper(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function clarte(hex) {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
}

// La page prend la couleur du commerce (choisie à la commande ou dans l'espace pro).
// Le texte passe en crème ou en noir selon la clarté du fond : toujours lisible.
export const COULEURS = [
  ['#0d0d0c', 'Noir'],
  ['#e9e4d8', 'Crème'],
  ['#1b2440', 'Bleu nuit'],
  ['#1f3a2e', 'Vert sapin'],
  ['#5a1a24', 'Bordeaux'],
  ['#b5532f', 'Terracotta'],
  ['#d6cfbf', 'Sable'],
  ['#8f8a80', 'Pierre'],
];
export function couleurValide(v) {
  return /^#[0-9a-f]{6}$/i.test(v || '') ? v.toLowerCase() : null;
}
function teintes(accent) {
  const fond = couleurValide(accent) || '#0d0d0c';
  const clair = clarte(fond) > 150;
  const rgb = clair ? '18,18,17' : '233,228,216';
  const encre = clair ? '#121211' : '#e9e4d8';
  return { fond, encre, doux: `rgba(${rgb},.64)`, ligne: `rgba(${rgb},.2)`, plein: encre };
}

export function page({ titre, accent, corps }) {
  const t = teintes(accent);
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="referrer" content="same-origin">
<meta name="theme-color" content="${t.fond}">
<title>${echapper(titre)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;background:${t.fond};color:${t.encre}}
body{font:16px/1.5 Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
main{min-height:100svh;max-width:520px;margin:0 auto;display:flex;flex-direction:column;gap:28px;padding:max(40px,env(safe-area-inset-top)) 24px max(28px,env(safe-area-inset-bottom))}
h1,.titre{margin:0;font:400 34px/0.95 'Archivo Black',sans-serif;letter-spacing:-.02em;text-transform:uppercase}
.logo{display:block;max-width:200px;max-height:110px;width:auto;height:auto;object-fit:contain}
.petit{font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:${t.doux};margin:0}
.doux{color:${t.doux};margin:0}
.compte{display:flex;align-items:baseline;gap:10px;margin:0}
.compte b{font:400 96px/.85 'Archivo Black',sans-serif;letter-spacing:-.04em}
.compte span{font-size:22px;color:${t.doux}}
.tampons{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:0;padding:0;list-style:none}
.tampons li{aspect-ratio:1;border-radius:50%;border:1px solid ${t.ligne}}
.tampons li.plein{background:${t.plein};border-color:${t.plein}}
.barre{height:4px;border-radius:4px;background:${t.ligne};overflow:hidden}
.barre i{display:block;height:100%;background:${t.plein}}
.bloc{padding:20px 22px;border:1px solid ${t.ligne};border-radius:14px}
.bloc p{margin:0}
.recompense{font:400 20px/1.15 'Archivo Black',sans-serif;text-transform:uppercase;margin:6px 0 0!important}
.liens{display:flex;flex-direction:column;border-top:1px solid ${t.ligne}}
.liens a{display:flex;justify-content:space-between;align-items:center;min-height:58px;border-bottom:1px solid ${t.ligne};color:${t.encre};text-decoration:none;font-size:17px}
.liens a::after{content:'→';color:${t.doux}}
.boutons{display:grid;grid-template-columns:3fr 1fr;gap:10px}
button,.bouton{display:flex;align-items:center;justify-content:center;width:100%;min-height:60px;padding:10px 18px;text-align:center;border:1px solid ${t.ligne};border-radius:999px;background:transparent;color:${t.encre};font:500 14px Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;cursor:pointer}
button.plein,.bouton.plein{background:${t.encre};border-color:${t.encre};color:${t.fond}}
button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid ${t.encre};outline-offset:3px}
form{margin:0}
.badge{align-self:flex-start;padding:6px 12px;border:1px solid ${t.ligne};border-radius:99px;font-size:11px;letter-spacing:.22em;text-transform:uppercase}
.flash{padding:14px 18px;border-radius:12px;border:1px solid ${t.encre};color:${t.encre};font-weight:500}
.grille{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.grille .bloc b{display:block;font:400 34px/1 'Archivo Black',sans-serif}
label{display:block;font-size:13px;color:${t.doux};margin:0 0 6px}
input{width:100%;padding:14px 16px;border:1px solid ${t.ligne};border-radius:10px;background:transparent;color:${t.encre};font:16px Inter,sans-serif}
.champs{display:flex;flex-direction:column;gap:16px}
.choix{border:0;padding:0;margin:0;display:grid;gap:8px}
.choix legend{font-size:13px;margin-bottom:6px}
.option{display:flex;gap:12px;align-items:flex-start;margin:0;padding:14px 16px;border:1px solid ${t.ligne};border-radius:12px;cursor:pointer;color:${t.encre};font-size:15px}
.option:has(input:checked){border-color:${t.encre}}
.option input{width:auto;margin:3px 0 0;accent-color:${t.encre}}
.option b{display:block;font-weight:500}
.option span{color:${t.doux};font-size:13px;line-height:1.45}
.option span b{color:${t.encre};font-size:15px}
.reglages:has(#mode-points:checked) .si-tampons,.reglages:has(#mode-tampons:checked) .si-points{display:none}
.nuancier{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.pastille{display:flex;align-items:center;gap:10px;margin:0;padding:10px 12px;border:1px solid ${t.ligne};border-radius:12px;cursor:pointer;color:${t.encre};font-size:14px}
.pastille:has(input[type=radio]:checked){border-color:${t.encre}}
.pastille input[type=radio]{position:absolute;opacity:0;width:1px;height:1px}
.pastille span,.pastille input[type=color]{flex:none;width:26px;height:26px;border-radius:50%;border:1px solid ${t.ligne};padding:0;background:none}
.pastille input[type=color]::-webkit-color-swatch-wrapper{padding:0}
.pastille input[type=color]::-webkit-color-swatch{border:0;border-radius:50%}
.pastille i{font-style:normal}
.pastille:has(input:focus-visible){outline:2px solid ${t.encre};outline-offset:2px}
.cadeau{display:grid;grid-template-columns:1fr 92px;gap:8px}
.cadeaux{list-style:none;margin:0;padding:0;border-top:1px solid ${t.ligne}}
.cadeaux li{display:flex;justify-content:space-between;gap:12px;padding:14px 0;border-bottom:1px solid ${t.ligne};color:${t.doux}}
.cadeaux li.ok{color:${t.encre}}
.cadeaux li b{font-weight:500;white-space:nowrap}
.cadeaux li.ok b{color:${t.plein}}
details summary{cursor:pointer;list-style:none}
.cadeau-btn{text-transform:none;letter-spacing:0;font-size:16px}
.etapes{list-style:none;margin:0;padding:0}
.etapes li{display:flex;gap:14px;align-items:baseline;padding:16px 0;border-bottom:1px solid ${t.ligne};color:${t.doux}}
.etapes b{font:400 18px 'Archivo Black',sans-serif;color:${t.encre}}
.pied{margin-top:auto;font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:${t.doux}}
.pied a{color:inherit}
</style>
</head>
<body><main>${corps}</main></body>
</html>`;
}

function enTete(c) {
  return c.logo
    ? `<img class="logo" src="${echapper(c.logo + (c.logo.includes('?') ? '&' : '?') + 'width=440')}" alt="${echapper(c.nom)}">`
    : `<h1>${echapper(c.nom)}</h1>`;
}

function tampons(n, seuil) {
  let li = '';
  for (let i = 1; i <= seuil; i++) li += `<li${i <= n ? ' class="plein"' : ''}></li>`;
  return `<ul class="tampons" aria-hidden="true">${li}</ul>`;
}

const pied = `<p class="pied">Carte <a href="https://ecru.fr">ECRU</a></p>`;

export function pageSuspendue(c) {
  return page({
    titre: c ? c.nom : 'Carte ECRU',
    accent: c ? c.couleur : null,
    corps: `<div style="margin:auto 0">
      ${c ? `<p class="petit">${echapper(c.nom)}</p>` : ''}
      <h1 style="margin-top:12px">Ce programme n’est plus actif.</h1>
      <p class="doux" style="margin-top:14px">Cette carte n’ouvre plus de page pour le moment.</p>
    </div>${pied}`,
  });
}

export function pageInconnue() {
  return page({
    titre: 'Carte ECRU',
    corps: `<div style="margin:auto 0"><h1>Carte inconnue.</h1><p class="doux" style="margin-top:14px">Cette carte n’est rattachée à aucun programme.</p></div>${pied}`,
  });
}

// Mode points : le prochain cadeau atteignable et la liste des cadeaux
function prochainCadeau(points, cadeaux) {
  return cadeaux.find((x) => x.points > points) || null;
}
function listeCadeaux(points, cadeaux) {
  if (!cadeaux.length) return '';
  return `<ul class="cadeaux">${cadeaux
    .map((x) => `<li class="${points >= x.points ? 'ok' : ''}"><span>${echapper(x.nom)}</span><b>${x.points} pts</b></li>`)
    .join('')}</ul>`;
}

// Le client scanne sa carte : il voit où il en est
export function pageClient(c, carte, reglage) {
  const liens = c.liens.length ? `<nav class="liens">${c.liens.map(([t, u]) => `<a href="${echapper(u)}" rel="noopener">${t}</a>`).join('')}</nav>` : '';
  const tete = `<header>${enTete(c)}<p class="doux" style="margin-top:12px">${echapper(c.accroche || 'Bon retour parmi nous.')}</p></header>`;

  if (reglage.mode === 'points') {
    const pts = carte.tampons;
    const suivant = prochainCadeau(pts, reglage.cadeaux);
    const dispo = reglage.cadeaux.filter((x) => pts >= x.points);
    const pct = suivant ? Math.min(100, Math.round((pts / suivant.points) * 100)) : 100;
    const message = dispo.length
      ? `<div class="bloc"><p class="petit">À vous de choisir</p><p class="recompense">${echapper(dispo[dispo.length - 1].nom)}</p><p class="doux" style="margin-top:8px">Montrez cette page en caisse.${suivant ? ` Ou continuez : plus que ${suivant.points - pts} points pour « ${echapper(suivant.nom)} ».` : ''}</p></div>`
      : carte.visites === 0
      ? `<div class="bloc"><p class="petit">Bienvenue</p><p class="doux" style="margin-top:6px">Montrez votre carte en caisse : chaque achat vous rapporte des points.</p></div>`
      : suivant
      ? `<div class="bloc"><p class="petit">Plus que ${suivant.points - pts} points</p><p class="recompense">${echapper(suivant.nom)}</p></div>`
      : '';
    return page({
      titre: c.nom,
      accent: (reglage && reglage.couleur) || c.couleur,
      corps: `${tete}
    <section aria-label="Vos points">
      <p class="compte"><b>${pts}</b><span>points</span></p>
      ${suivant ? `<div class="barre" style="margin-top:16px"><i style="width:${pct}%"></i></div>` : ''}
    </section>
    ${message}
    ${listeCadeaux(pts, reglage.cadeaux)}
    ${liens}
    ${pied}`,
    });
  }

  const seuil = reglage.seuil;
  const n = Math.min(carte.tampons, seuil);
  const prete = carte.tampons >= seuil;
  const reste = Math.max(0, seuil - carte.tampons);
  const message = carte.terminee
    ? `<div class="bloc"><p class="petit">Carte complète</p><p class="doux" style="margin-top:6px">Merci pour votre fidélité. Demandez en caisse pour repartir pour un tour.</p></div>`
    : prete
    ? `<div class="bloc"><p class="petit">Récompense disponible</p><p class="recompense">${echapper(reglage.recompense || 'Votre récompense vous attend')}</p><p class="doux" style="margin-top:8px">Montrez cette page en caisse.</p></div>`
    : carte.visites === 0
    ? `<div class="bloc"><p class="petit">Bienvenue</p><p class="doux" style="margin-top:6px">Montrez votre carte en caisse : votre premier tampon est pour aujourd’hui.</p></div>`
    : `<div class="bloc"><p class="petit">Plus que ${reste} visite${reste > 1 ? 's' : ''}</p>${reglage.recompense ? `<p class="recompense">${echapper(reglage.recompense)}</p>` : ''}</div>`;
  return page({
    titre: c.nom,
    accent: (reglage && reglage.couleur) || c.couleur,
    corps: `${tete}
    <section aria-label="Vos tampons">
      <p class="compte"><b>${carte.terminee ? seuil : n}</b><span>/ ${seuil}</span></p>
      <div style="margin-top:16px">${tampons(carte.terminee ? seuil : n, seuil)}</div>
    </section>
    ${message}
    ${liens}
    ${pied}`,
  });
}

// Le commerçant scanne la même carte avec son téléphone : il voit le niveau et ajoute un tampon ou des points
export function pagePro(c, carte, reglage, flash = '') {
  const depuis = carte.derniere_visite ? ilYa(carte.derniere_visite) : 'jamais';
  const entete = `<span class="badge">Mode commerçant · ${echapper(c.nom)}</span>
    ${flash ? `<p class="flash" role="status">${echapper(flash)}</p>` : ''}
    <header><p class="petit">Carte ${echapper(carte.code.toUpperCase())}</p>
      <p class="doux" style="margin-top:8px">Dernière visite : ${depuis} · ${carte.visites} visite${carte.visites > 1 ? 's' : ''} au total · ${carte.recompenses} récompense${carte.recompenses > 1 ? 's' : ''}</p></header>`;

  if (reglage.mode === 'points') {
    const pts = carte.tampons;
    const offrables = reglage.cadeaux.map((x, i) => [x, i]).filter(([x]) => pts >= x.points);
    return page({
      titre: `${c.nom} · carte ${carte.code}`,
      accent: (reglage && reglage.couleur) || c.couleur,
      corps: `${entete}
    <section aria-label="Points du client">
      <p class="compte"><b>${pts}</b><span>points</span></p>
    </section>
    <form method="post" class="champs">
      <input type="hidden" name="action" value="achat">
      <div><label for="montant">Montant de l’achat (€) · ${String(reglage.taux).replace('.', ',')} point${reglage.taux > 1 ? 's' : ''} par euro</label>
      <input id="montant" name="montant" type="text" inputmode="decimal" placeholder="25,00" autocomplete="off" required></div>
      <button class="plein" type="submit">Ajouter les points</button>
    </form>
    ${offrables.length ? `<section aria-label="Cadeaux disponibles" class="champs"><p class="petit">Cadeaux disponibles</p>${offrables
      .map(([x, i]) => `<form method="post"><input type="hidden" name="action" value="offrir"><input type="hidden" name="cadeau" value="${i}"><button class="cadeau-btn" type="submit">Offrir : ${echapper(x.nom)} · ${x.points} pts</button></form>`)
      .join('')}</section>` : ''}
    ${reglage.cadeaux.length ? '' : `<div class="bloc"><p class="doux">Aucun cadeau pour l’instant. Ajoutez-les dans le tableau de bord.</p></div>`}
    <details class="bloc"><summary class="petit">Corriger</summary>
      <form method="post" class="champs" style="margin-top:14px"><input type="hidden" name="action" value="corriger">
        <div><label for="corr">Points à retirer</label><input id="corr" name="points" type="number" min="1" max="${pts}" inputmode="numeric"></div>
        <button type="submit">Retirer</button></form>
    </details>
    <a class="bouton" href="/pro">Tableau de bord</a>
    ${pied}`,
    });
  }

  const seuil = reglage.seuil;
  const prete = carte.tampons >= seuil && !carte.terminee;
  const pct = Math.min(100, Math.round((carte.tampons / seuil) * 100));
  return page({
    titre: `${c.nom} · carte ${carte.code}`,
    accent: (reglage && reglage.couleur) || c.couleur,
    corps: `${entete}
    <section aria-label="Niveau du client">
      <p class="compte"><b>${carte.terminee ? seuil : carte.tampons}</b><span>/ ${seuil}</span></p>
      <div class="barre" style="margin-top:16px"><i style="width:${carte.terminee ? 100 : pct}%"></i></div>
    </section>
    ${prete ? `<div class="bloc"><p class="petit">Récompense due</p><p class="recompense">${echapper(reglage.recompense || 'Récompense')}</p></div>` : ''}
    ${carte.terminee
      ? `<div class="bloc"><p class="petit">Carte complète</p><p class="doux" style="margin-top:6px">La récompense a été remise.</p></div>
    <form method="post"><input type="hidden" name="action" value="relancer"><button class="plein" type="submit">Relancer la carte</button></form>`
      : `<div class="boutons">
      <form method="post"><input type="hidden" name="action" value="tampon"><button class="plein" type="submit">+ 1 tampon</button></form>
      <form method="post"><input type="hidden" name="action" value="retrait"><button type="submit" aria-label="Retirer un tampon">− 1</button></form>
    </div>`}
    ${prete ? `<form method="post"><input type="hidden" name="action" value="recompense"><button class="plein" type="submit">Récompense remise</button></form>` : ''}
    <a class="bouton" href="/pro">Tableau de bord</a>
    ${pied}`,
  });
}

export function pageTableau(c, stats, reglage, flash = '', site = '') {
  const compte = site ? `${site.replace(/\/$/, '')}/pages/compte#recommander` : '';
  const pts = reglage.mode === 'points';
  const lignesCadeaux = [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const x = reglage.cadeaux[i] || { nom: '', points: '' };
      return `<div class="cadeau"><input name="cadeau_nom_${i}" maxlength="60" value="${echapper(x.nom)}" placeholder="${['Café offert', 'Soin offert', '-10 % sur le prochain achat', '', '', ''][i]}" aria-label="Cadeau ${i + 1}">
        <input name="cadeau_points_${i}" type="number" min="1" max="100000" value="${x.points}" placeholder="${['50', '150', '300', '', '', ''][i]}" inputmode="numeric" aria-label="Points pour le cadeau ${i + 1}"></div>`;
    })
    .join('');
  return page({
    titre: `${c.nom} · tableau de bord`,
    accent: (reglage && reglage.couleur) || c.couleur,
    corps: `<span class="badge">Espace commerçant</span>
    ${flash ? `<p class="flash" role="status">${echapper(flash)}</p>` : ''}
    <header>${enTete(c)}<p class="doux" style="margin-top:12px">Pour ajouter ${pts ? 'des points' : 'un tampon'}, scannez la carte du client avec ce téléphone.</p></header>
    ${c.actif ? '' : `<div class="bloc"><p class="petit">Abonnement arrêté</p><p class="doux" style="margin-top:6px">Vos cartes affichent « Ce programme n’est plus actif ».</p></div>`}
    <section aria-label="Ce mois-ci">
      <p class="petit" style="margin-bottom:12px">Ce mois-ci</p>
      <div class="grille">
        <div class="bloc"><b>${stats.visitesMois}</b><p class="doux">visites</p></div>
        <div class="bloc"><b>${stats.recompensesMois}</b><p class="doux">récompenses</p></div>
        <div class="bloc"><b>${stats.clientsMois}</b><p class="doux">clients venus</p></div>
        <div class="bloc"><b>${stats.tauxRetour} %</b><p class="doux">sont revenus</p></div>
      </div>
      <p class="doux" style="margin-top:12px;font-size:14px">Mois précédent : ${stats.visitesMoisPrec} visites. Cartes en circulation : ${stats.cartesActives} sur ${stats.cartes}.</p>
    </section>
    <section aria-label="Vos récompenses">
      <p class="petit" style="margin-bottom:12px">Vos récompenses</p>
      <form method="post" action="/pro/reglages" class="champs reglages">
        <fieldset class="choix"><legend class="doux">Votre système</legend>
          <label class="option"><input type="radio" name="mode" value="tampons" id="mode-tampons"${pts ? '' : ' checked'}><span><b>Tampons</b>Un passage, un tampon. Une récompense au bout.</span></label>
          <label class="option"><input type="radio" name="mode" value="points" id="mode-points"${pts ? ' checked' : ''}><span><b>Points</b>Des points selon le montant, des cadeaux à vos prix.</span></label>
        </fieldset>
        <div class="si-tampons champs">
          <div><label for="seuil">Tampons nécessaires</label><input id="seuil" name="seuil" type="number" min="3" max="30" value="${reglage.seuil}" inputmode="numeric"></div>
          <div><label for="recompense">Récompense</label><input id="recompense" name="recompense" maxlength="80" value="${echapper(reglage.recompense)}" placeholder="La coupe offerte"></div>
          <fieldset class="choix"><legend class="doux">Une fois la récompense remise</legend>
            <label class="option"><input type="radio" name="apres" value="recommence"${reglage.apres === 'termine' ? '' : ' checked'}><span><b>La carte recommence</b>Le client repart pour un tour.</span></label>
            <label class="option"><input type="radio" name="apres" value="termine"${reglage.apres === 'termine' ? ' checked' : ''}><span><b>La carte s’arrête</b>Vous la relancez quand vous voulez, en la scannant.</span></label>
          </fieldset>
        </div>
        <div class="si-points champs">
          <div><label for="taux">Points par euro dépensé</label><input id="taux" name="taux" type="text" inputmode="decimal" value="${String(reglage.taux).replace('.', ',')}"></div>
          <div><p class="doux" style="font-size:13px;margin:0 0 6px">Vos cadeaux et leur prix en points</p><div class="champs" style="gap:8px">${lignesCadeaux}</div></div>
        </div>
        <fieldset class="choix"><legend class="doux">Couleur de votre page</legend>
          <div class="nuancier">${COULEURS.map(([hex, nom]) => `<label class="pastille" title="${nom}"><input type="radio" name="couleur" value="${hex}"${(reglage.couleur || c.couleur || '#0d0d0c').toLowerCase() === hex ? ' checked' : ''}><span style="background:${hex}"></span><i>${nom}</i></label>`).join('')}
            <label class="pastille" title="Autre couleur"><input type="radio" name="couleur" value="libre"${COULEURS.some(([h]) => h === (reglage.couleur || c.couleur || '#0d0d0c').toLowerCase()) ? '' : ' checked'}><input type="color" name="couleur_libre" value="${couleurValide(reglage.couleur || c.couleur) || '#0d0d0c'}" aria-label="Autre couleur"><i>Autre</i></label>
          </div>
          <p class="doux" style="font-size:13px">Vos clients la voient en scannant leur carte. Le texte s’adapte pour rester lisible.</p>
        </fieldset>
        <p class="doux" style="font-size:13px">Changer de système remet les cartes à zéro.</p>
        <button class="plein" type="submit">Enregistrer</button>
      </form>
    </section>
    ${
      compte
        ? `<section aria-label="Vos cartes" class="bloc">
      <p class="petit">Plus de cartes</p>
      <p class="doux" style="margin-top:6px">Même design, mêmes réglages : vos nouvelles cartes rejoignent ce programme. Votre abonnement continue, rien à repayer.</p>
      <a class="bouton" style="margin-top:14px" href="${echapper(compte)}">Commander à nouveau mes cartes</a>
    </section>`
        : ''
    }
    <a class="bouton" href="/pro/deconnexion">Se déconnecter de ce téléphone</a>
    ${pied}`,
  });
}

// Téléphone pas encore connecté : comment se connecter
export function pageConnexion(site) {
  const contact = `${(site || '').replace(/\/$/, '')}/pages/contact`;
  return page({
    titre: 'Espace commerçant',
    corps: `<span class="badge">Espace commerçant</span>
    <header><h1>Connectez ce téléphone.</h1>
      <p class="doux" style="margin-top:14px">Pas de mot de passe : ouvrez une fois votre lien personnel sur ce téléphone. Il reste connecté un an.</p></header>
    <ol class="liens etapes">
      <li><b>1</b>Retrouvez l’e-mail d’ECRU avec votre lien de connexion.</li>
      <li><b>2</b>Touchez le lien depuis ce téléphone : votre tableau de bord s’ouvre.</li>
      <li><b>3</b>Scannez la carte d’un client : ses tampons et vos boutons s’affichent.</li>
    </ol>
    ${site ? `<a class="bouton" href="${echapper(contact)}">Lien perdu : en demander un nouveau</a>` : ''}
    ${pied}`,
  });
}

export function pageMessage(titre, texte) {
  return page({ titre, corps: `<div style="margin:auto 0"><h1>${echapper(titre)}</h1><p class="doux" style="margin-top:14px">${echapper(texte)}</p></div>${pied}` });
}

export function pageAdmin(resultat = '', commerces = []) {
  const liste = commerces.length
    ? `<div class="bloc"><p class="petit">Commerces</p>${commerces
        .map((c) => `<p style="margin-top:10px">${echapper(c.nom)} <span class="doux">· ${echapper(c.handle)} · ${c.cartes} carte${c.cartes > 1 ? 's' : ''} · ${c.actif ? 'actif' : 'arrêté'}</span></p>`)
        .join('')}</div>`
    : '';
  const cle = (id) => `<div><label for="${id}">Clé d’administration</label><input id="${id}" name="jeton" type="password" required autocomplete="current-password"></div>`;
  const commerce = (id) => `<div><label for="${id}">Identifiant du commerce (ex. maison-lune)</label><input id="${id}" name="commerce" required pattern="[a-z0-9-]+"></div>`;
  return page({
    titre: 'ECRU · administration',
    corps: `<span class="badge">Administration ECRU</span>
    ${resultat}
    ${liste}
    <form method="post" action="/admin/commerce" class="champs bloc">
      <p class="petit">1. Fiche du commerce (créer ou modifier)</p>
      ${cle('t0')}${commerce('c0')}
      <div><label for="nom">Nom affiché</label><input id="nom" name="nom" maxlength="60" required></div>
      
      <div><label for="logo">Adresse du logo (image en ligne, facultatif)</label><input id="logo" name="logo" type="url"></div>
      <div><label for="accroche">Message d’accueil</label><input id="accroche" name="accroche" maxlength="120" placeholder="Bon retour parmi nous."></div>
      <div><label for="recompense">Récompense</label><input id="recompense" name="recompense" maxlength="80" placeholder="Le dessert offert"></div>
      <div><label for="seuil">Tampons pour la récompense</label><input id="seuil" name="seuil" type="number" min="3" max="30" value="10"></div>
      <div><label for="lm">Lien menu</label><input id="lm" name="lien_menu" type="url"></div>
      <div><label for="la">Lien avis</label><input id="la" name="lien_avis" type="url"></div>
      <div><label for="lr">Lien réseaux</label><input id="lr" name="lien_reseaux" type="url"></div>
      <div><label for="ls">Lien site</label><input id="ls" name="lien_site" type="url"></div>
      <label style="display:flex;gap:10px;align-items:center;font-size:15px"><input type="checkbox" name="actif" value="1" checked style="width:auto"> Abonnement actif (décocher pour arrêter ses cartes)</label>
      <button class="plein" type="submit">Enregistrer le commerce</button>
    </form>
    <form method="post" action="/admin/cartes" class="champs bloc">
      <p class="petit">2. Créer des cartes</p>
      ${cle('t1')}${commerce('c1')}
      <div><label for="n1">Nombre de cartes</label><input id="n1" name="nombre" type="number" min="1" max="1000" value="100"></div>
      <button class="plein" type="submit">Télécharger les adresses (CSV)</button>
    </form>
    <form method="post" action="/admin/acces" class="champs bloc">
      <p class="petit">3. Accès commerçant</p>
      ${cle('t2')}${commerce('c2')}
      <button type="submit">Créer le lien de connexion</button>
    </form>`,
  });
}

function ilYa(iso) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 3600) return `il y a ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  const j = Math.round(s / 86400);
  return `il y a ${j} jour${j > 1 ? 's' : ''}`;
}
