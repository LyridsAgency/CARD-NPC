// Pages HTML (rendu serveur, sans JavaScript côté téléphone) aux couleurs du commerce.

export function echapper(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function clarte(hex) {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
}

function teintes(fond) {
  const clair = clarte(fond) > 150;
  return clair
    ? { fond, encre: '#121211', doux: 'rgba(18,18,17,.62)', ligne: 'rgba(18,18,17,.18)', plein: '#121211', surPlein: '#e9e4d8' }
    : { fond, encre: '#e9e4d8', doux: 'rgba(233,228,216,.62)', ligne: 'rgba(233,228,216,.18)', plein: '#e9e4d8', surPlein: '#121211' };
}

export function page({ titre, fond = '#070707', corps }) {
  const t = teintes(fond);
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
button.plein,.bouton.plein{background:${t.plein};border-color:${t.plein};color:${t.surPlein}}
button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid ${t.encre};outline-offset:3px}
form{margin:0}
.badge{align-self:flex-start;padding:6px 12px;border:1px solid ${t.ligne};border-radius:99px;font-size:11px;letter-spacing:.22em;text-transform:uppercase}
.flash{padding:14px 18px;border-radius:12px;background:${t.plein};color:${t.surPlein};font-weight:500}
.grille{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.grille .bloc b{display:block;font:400 34px/1 'Archivo Black',sans-serif}
label{display:block;font-size:13px;color:${t.doux};margin:0 0 6px}
input{width:100%;padding:14px 16px;border:1px solid ${t.ligne};border-radius:10px;background:transparent;color:${t.encre};font:16px Inter,sans-serif}
.champs{display:flex;flex-direction:column;gap:16px}
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
    fond: c ? c.couleur : '#0d0d0c',
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

// Le client scanne sa carte : il voit où il en est
export function pageClient(c, carte, reglage) {
  const seuil = reglage.seuil;
  const n = Math.min(carte.tampons, seuil);
  const prete = carte.tampons >= seuil;
  const reste = Math.max(0, seuil - carte.tampons);
  const message = prete
    ? `<div class="bloc"><p class="petit">Récompense disponible</p><p class="recompense">${echapper(reglage.recompense || 'Votre récompense vous attend')}</p><p class="doux" style="margin-top:8px">Montrez cette page en caisse.</p></div>`
    : carte.visites === 0
    ? `<div class="bloc"><p class="petit">Bienvenue</p><p class="doux" style="margin-top:6px">Montrez votre carte en caisse : votre premier tampon est pour aujourd’hui.</p></div>`
    : `<div class="bloc"><p class="petit">Plus que ${reste} visite${reste > 1 ? 's' : ''}</p>${reglage.recompense ? `<p class="recompense">${echapper(reglage.recompense)}</p>` : ''}</div>`;
  return page({
    titre: c.nom,
    fond: c.couleur,
    corps: `<header>${enTete(c)}<p class="doux" style="margin-top:12px">${echapper(c.accroche || 'Bon retour parmi nous.')}</p></header>
    <section aria-label="Vos tampons">
      <p class="compte"><b>${n}</b><span>/ ${seuil}</span></p>
      <div style="margin-top:16px">${tampons(n, seuil)}</div>
    </section>
    ${message}
    ${c.liens.length ? `<nav class="liens">${c.liens.map(([t, u]) => `<a href="${echapper(u)}" rel="noopener">${t}</a>`).join('')}</nav>` : ''}
    ${pied}`,
  });
}

// Le commerçant scanne la même carte avec son téléphone : il voit le niveau et ajoute un tampon
export function pagePro(c, carte, reglage, flash = '') {
  const seuil = reglage.seuil;
  const prete = carte.tampons >= seuil;
  const pct = Math.min(100, Math.round((carte.tampons / seuil) * 100));
  const depuis = carte.derniere_visite ? ilYa(carte.derniere_visite) : 'jamais';
  return page({
    titre: `${c.nom} · carte ${carte.code}`,
    fond: '#0d0d0c',
    corps: `<span class="badge">Mode commerçant · ${echapper(c.nom)}</span>
    ${flash ? `<p class="flash" role="status">${echapper(flash)}</p>` : ''}
    <header><p class="petit">Carte ${echapper(carte.code.toUpperCase())}</p>
      <p class="doux" style="margin-top:8px">Dernière visite : ${depuis} · ${carte.visites} visite${carte.visites > 1 ? 's' : ''} au total · ${carte.recompenses} récompense${carte.recompenses > 1 ? 's' : ''}</p></header>
    <section aria-label="Niveau du client">
      <p class="compte"><b>${carte.tampons}</b><span>/ ${seuil}</span></p>
      <div class="barre" style="margin-top:16px"><i style="width:${pct}%"></i></div>
    </section>
    ${prete ? `<div class="bloc"><p class="petit">Récompense due</p><p class="recompense">${echapper(reglage.recompense || 'Récompense')}</p></div>` : ''}
    <div class="boutons">
      <form method="post"><input type="hidden" name="action" value="tampon"><button class="plein" type="submit">+ 1 tampon</button></form>
      <form method="post"><input type="hidden" name="action" value="retrait"><button type="submit" aria-label="Retirer un tampon">− 1</button></form>
    </div>
    ${prete ? `<form method="post"><input type="hidden" name="action" value="recompense"><button class="plein" type="submit">Récompense remise</button></form>` : ''}
    <a class="bouton" href="/pro">Tableau de bord</a>
    ${pied}`,
  });
}

export function pageTableau(c, stats, reglage, flash = '') {
  return page({
    titre: `${c.nom} · tableau de bord`,
    fond: '#0d0d0c',
    corps: `<span class="badge">Espace commerçant</span>
    ${flash ? `<p class="flash" role="status">${echapper(flash)}</p>` : ''}
    <header>${enTete(c)}<p class="doux" style="margin-top:12px">Pour ajouter un tampon, scannez la carte du client avec ce téléphone.</p></header>
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
    <section aria-label="Réglages">
      <p class="petit" style="margin-bottom:12px">Votre récompense</p>
      <form method="post" action="/pro/reglages" class="champs">
        <div><label for="seuil">Tampons nécessaires</label><input id="seuil" name="seuil" type="number" min="3" max="30" value="${reglage.seuil}" inputmode="numeric"></div>
        <div><label for="recompense">Récompense</label><input id="recompense" name="recompense" maxlength="80" value="${echapper(reglage.recompense)}" placeholder="Le dessert offert"></div>
        <button class="plein" type="submit">Enregistrer</button>
      </form>
    </section>
    <a class="bouton" href="/pro/deconnexion">Se déconnecter de ce téléphone</a>
    ${pied}`,
  });
}

export function pageMessage(titre, texte, fond = '#0d0d0c') {
  return page({ titre, fond, corps: `<div style="margin:auto 0"><h1>${echapper(titre)}</h1><p class="doux" style="margin-top:14px">${echapper(texte)}</p></div>${pied}` });
}

export function pageAdmin(resultat = '') {
  return page({
    titre: 'ECRU · administration',
    corps: `<span class="badge">Administration ECRU</span>
    ${resultat}
    <form method="post" action="/admin/cartes" class="champs bloc">
      <p class="petit">Créer des cartes</p>
      <div><label for="t1">Clé d’administration</label><input id="t1" name="jeton" type="password" required autocomplete="current-password"></div>
      <div><label for="c1">Commerce (handle Shopify, ex. client-123456)</label><input id="c1" name="commerce" required pattern="[a-z0-9-]+"></div>
      <div><label for="n1">Nombre de cartes</label><input id="n1" name="nombre" type="number" min="1" max="1000" value="100"></div>
      <button class="plein" type="submit">Télécharger les adresses (CSV)</button>
    </form>
    <form method="post" action="/admin/acces" class="champs bloc">
      <p class="petit">Accès commerçant</p>
      <div><label for="t2">Clé d’administration</label><input id="t2" name="jeton" type="password" required autocomplete="current-password"></div>
      <div><label for="c2">Commerce (handle Shopify)</label><input id="c2" name="commerce" required pattern="[a-z0-9-]+"></div>
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
