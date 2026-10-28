// ECRU Fidélité — Cloudflare Worker.
//   /c/<code>          la carte scannée : vue client (progression) ou vue commerçant (si son téléphone est connecté)
//   /pro               tableau de bord du commerçant ; /pro/connexion?commerce=…&cle=… ; /pro/reglages ; /pro/deconnexion
//   /admin             création des cartes (CSV d'adresses à encoder) et des liens de connexion commerçant
import { aleatoire, hacher, egal, creerSession, lireSession, lireCookie } from './securite.js';
import { lireCommerce } from './shopify.js';
import { pageClient, pagePro, pageTableau, pageSuspendue, pageInconnue, pageMessage, pageAdmin, pageConnexion, echapper, couleurValide } from './pages.js';

const COOKIE = 'ecru_pro';
const ANTI_DOUBLE = 8; // secondes : un double appui ne donne pas deux tampons

function html(corps, statut = 200, entetes = {}) {
  return new Response(corps, {
    status: statut,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
      ...entetes,
    },
  });
}

function rediriger(url, entetes = {}) {
  return new Response(null, { status: 303, headers: { Location: url, 'Cache-Control': 'no-store', ...entetes } });
}

function maintenantIso() {
  return new Date().toISOString();
}

// Cadeaux du mode points : 6 au plus, triés du moins cher au plus cher
function lireCadeaux(brut) {
  let l = [];
  try {
    l = typeof brut === 'string' ? JSON.parse(brut || '[]') : brut || [];
  } catch (e) {
    l = [];
  }
  return (Array.isArray(l) ? l : [])
    .map((x) => ({ nom: String((x && x.nom) || '').trim().slice(0, 60), points: Math.min(100000, Math.max(1, parseInt(x && x.points, 10) || 0)) }))
    .filter((x) => x.nom && x.points)
    .sort((a, b) => a.points - b.points)
    .slice(0, 6);
}

function lireTaux(v) {
  const t = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(t) && t > 0 ? Math.min(100, Math.round(t * 100) / 100) : 1;
}

// Tout est choisi par le commerçant dans son espace ; la fiche du commerce ne donne que les valeurs de départ
async function reglageDe(env, c) {
  const r = (await env.DB.prepare('SELECT * FROM reglages WHERE commerce = ?').bind(c.handle).first()) || {};
  return {
    mode: r.mode === 'points' ? 'points' : 'tampons',
    seuil: Math.min(30, Math.max(3, r.seuil || c.seuil || 10)),
    recompense: (r.recompense != null ? r.recompense : c.recompense) || '',
    apres: r.apres === 'termine' ? 'termine' : 'recommence',
    taux: lireTaux(r.taux ?? 1),
    cadeaux: lireCadeaux(r.cadeaux),
    // Couleur de la page : celle de la fiche du commerce, que le commerçant change depuis son espace
    couleur: couleurValide(c.couleur) || '#0d0d0c',
  };
}

async function sessionPro(env, requete) {
  return lireSession(env.SESSION_SECRET, lireCookie(requete, COOKIE));
}

// Une action vient bien du site (formulaire de la page), pas d'un autre site
function memeOrigine(requete, url, env) {
  const o = requete.headers.get('Origin');
  if (!o) return true;
  if (o === url.origin) return true;
  try {
    return o === new URL(env.PUBLIC_URL).origin;
  } catch (e) {
    return false;
  }
}

async function carte(env, code) {
  return env.DB.prepare('SELECT * FROM cartes WHERE code = ?').bind(code).first();
}

async function scanCarte(env, requete, url, code) {
  const k = await carte(env, code);
  if (!k) return html(pageInconnue(), 404);
  const c = await lireCommerce(env, k.commerce);
  if (!c || !c.actif) return html(pageSuspendue(c), c ? 200 : 404);
  const reglage = await reglageDe(env, c);
  const pro = (await sessionPro(env, requete)) === k.commerce;

  if (requete.method === 'POST') {
    if (!pro || !memeOrigine(requete, url, env)) return html(pageMessage('Action refusée', 'Seul le téléphone du commerce peut ajouter des tampons.'), 403);
    const f = await requete.formData();
    const action = f.get('action');
    const maintenant = maintenantIso();
    let message = '';
    const ajouter = async (valeur, texte) => {
      const recent = await env.DB.prepare("SELECT a FROM evenements WHERE carte = ? AND type = 'tampon' ORDER BY id DESC LIMIT 1").bind(code).first();
      if (recent && Date.now() - Date.parse(recent.a) < ANTI_DOUBLE * 1000) return reglage.mode === 'points' ? 'Points déjà ajoutés à l’instant.' : 'Tampon déjà ajouté à l’instant.';
      await env.DB.prepare('UPDATE cartes SET tampons = tampons + ?, visites = visites + 1, derniere_visite = ? WHERE code = ?').bind(valeur, maintenant, code).run();
      await env.DB.prepare("INSERT INTO evenements (carte, commerce, type, a, valeur) VALUES (?, ?, 'tampon', ?, ?)").bind(code, k.commerce, maintenant, valeur).run();
      return texte;
    };
    const retirer = async (valeur, texte) => {
      await env.DB.prepare('UPDATE cartes SET tampons = MAX(tampons - ?, 0) WHERE code = ?').bind(valeur, code).run();
      await env.DB.prepare("INSERT INTO evenements (carte, commerce, type, a, valeur) VALUES (?, ?, 'retrait', ?, ?)").bind(code, k.commerce, maintenant, valeur).run();
      return texte;
    };
    const offrir = async (cout, texte) => {
      await env.DB.prepare('UPDATE cartes SET tampons = tampons - ?, recompenses = recompenses + 1, terminee = ? WHERE code = ?')
        .bind(cout, reglage.mode === 'tampons' && reglage.apres === 'termine' ? 1 : 0, code).run();
      await env.DB.prepare("INSERT INTO evenements (carte, commerce, type, a, valeur) VALUES (?, ?, 'recompense', ?, ?)").bind(code, k.commerce, maintenant, cout).run();
      return texte;
    };

    if (reglage.mode === 'points') {
      if (action === 'achat') {
        const montant = Math.min(10000, Math.max(0, Number(String(f.get('montant') || '').replace(',', '.')) || 0));
        const points = Math.floor(montant * reglage.taux);
        message = points > 0 ? await ajouter(points, `+ ${points} point${points > 1 ? 's' : ''} : ${k.tampons + points} au total.`) : 'Indiquez le montant de l’achat.';
      } else if (action === 'offrir') {
        const cadeau = reglage.cadeaux[parseInt(f.get('cadeau'), 10)];
        if (cadeau && k.tampons >= cadeau.points) message = await offrir(cadeau.points, `${cadeau.nom} : offert. Il reste ${k.tampons - cadeau.points} points.`);
      } else if (action === 'corriger') {
        const n = Math.min(k.tampons, Math.max(0, parseInt(f.get('points'), 10) || 0));
        if (n) message = await retirer(n, `${n} point${n > 1 ? 's' : ''} retiré${n > 1 ? 's' : ''}.`);
      }
    } else if (action === 'tampon' && !k.terminee) {
      message = await ajouter(1, `Tampon ajouté : ${k.tampons + 1} / ${reglage.seuil}.` + (k.tampons + 1 >= reglage.seuil ? ' Récompense due !' : ''));
    } else if (action === 'retrait' && k.tampons > 0) {
      message = await retirer(1, 'Tampon retiré.');
    } else if (action === 'recompense' && k.tampons >= reglage.seuil) {
      message = await offrir(reglage.seuil, reglage.apres === 'termine' ? 'Récompense remise. La carte est complète.' : 'Récompense remise. La carte repart pour un tour.');
    } else if (action === 'relancer' && k.terminee) {
      await env.DB.prepare('UPDATE cartes SET terminee = 0 WHERE code = ?').bind(code).run();
      message = 'La carte repart pour un tour.';
    }
    return rediriger(`/c/${code}?ok=${encodeURIComponent(message)}`);
  }

  if (pro) {
    const k2 = await carte(env, code);
    return html(pagePro(c, k2, reglage, url.searchParams.get('ok') || ''));
  }
  // Vue client : on note le passage (au plus une fois par heure et par carte) pour les statistiques
  const derniere = await env.DB.prepare("SELECT a FROM evenements WHERE carte = ? AND type = 'vue' ORDER BY id DESC LIMIT 1").bind(code).first();
  if (!derniere || Date.now() - Date.parse(derniere.a) > 3600 * 1000) {
    await env.DB.prepare("INSERT INTO evenements (carte, commerce, type, a) VALUES (?, ?, 'vue', ?)").bind(code, k.commerce, maintenantIso()).run();
  }
  return html(pageClient(c, k, reglage));
}

async function listeCommerces(env) {
  const r = await env.DB.prepare(
    'SELECT c.handle, c.nom, c.actif, (SELECT COUNT(*) FROM cartes k WHERE k.commerce = c.handle) AS cartes FROM commerces c ORDER BY c.nom'
  ).bind().all();
  return r.results || [];
}

function debutMois(decalage = 0) {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + decalage, 1)).toISOString();
}

async function statistiques(env, commerce) {
  const m0 = debutMois(0);
  const m1 = debutMois(-1);
  const un = async (sql, ...args) => ((await env.DB.prepare(sql).bind(...args).first()) || {}).n || 0;
  const visitesMois = await un("SELECT COUNT(*) AS n FROM evenements WHERE commerce = ? AND type = 'tampon' AND a >= ?", commerce, m0);
  const visitesMoisPrec = await un("SELECT COUNT(*) AS n FROM evenements WHERE commerce = ? AND type = 'tampon' AND a >= ? AND a < ?", commerce, m1, m0);
  const recompensesMois = await un("SELECT COUNT(*) AS n FROM evenements WHERE commerce = ? AND type = 'recompense' AND a >= ?", commerce, m0);
  const clientsMois = await un("SELECT COUNT(DISTINCT carte) AS n FROM evenements WHERE commerce = ? AND type = 'tampon' AND a >= ?", commerce, m0);
  const cartes = await un('SELECT COUNT(*) AS n FROM cartes WHERE commerce = ?', commerce);
  const cartesActives = await un('SELECT COUNT(*) AS n FROM cartes WHERE commerce = ? AND visites > 0', commerce);
  const fideles = await un('SELECT COUNT(*) AS n FROM cartes WHERE commerce = ? AND visites > 1', commerce);
  return {
    visitesMois,
    visitesMoisPrec,
    recompensesMois,
    clientsMois,
    cartes,
    cartesActives,
    tauxRetour: cartesActives ? Math.round((fideles / cartesActives) * 100) : 0,
  };
}

async function routesPro(env, requete, url) {
  const chemin = url.pathname;
  if (chemin === '/pro/connexion') {
    const commerce = url.searchParams.get('commerce') || '';
    const cle = url.searchParams.get('cle') || '';
    const acces = await env.DB.prepare('SELECT cle_hash FROM acces_pro WHERE commerce = ?').bind(commerce).first();
    if (!acces || !egal(acces.cle_hash, await hacher(cle))) return html(pageMessage('Lien invalide', 'Ce lien de connexion n’est pas valable. Demandez-en un nouveau à ECRU.'), 403);
    const jeton = await creerSession(env.SESSION_SECRET, commerce);
    return rediriger('/pro', {
      'Set-Cookie': `${COOKIE}=${encodeURIComponent(jeton)}; Path=/; Max-Age=${365 * 86400}; HttpOnly; Secure; SameSite=Lax`,
    });
  }
  if (chemin === '/pro/deconnexion') {
    return rediriger('/pro', { 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` });
  }
  const commerce = await sessionPro(env, requete);
  if (!commerce) return html(pageConnexion(env.SITE_URL), 401);
  const c = await lireCommerce(env, commerce);
  if (!c) return html(pageInconnue(), 404);

  if (chemin === '/pro/reglages' && requete.method === 'POST') {
    if (!memeOrigine(requete, url, env)) return html(pageMessage('Action refusée', 'Requête refusée.'), 403);
    const f = await requete.formData();
    const avant = await reglageDe(env, c);
    const mode = f.get('mode') === 'points' ? 'points' : 'tampons';
    const seuil = Math.min(30, Math.max(3, parseInt(f.get('seuil'), 10) || 10));
    const recompense = String(f.get('recompense') || '').trim().slice(0, 80);
    const apres = f.get('apres') === 'termine' ? 'termine' : 'recommence';
    const taux = lireTaux(f.get('taux'));
    const cadeaux = lireCadeaux([0, 1, 2, 3, 4, 5].map((i) => ({ nom: f.get(`cadeau_nom_${i}`), points: f.get(`cadeau_points_${i}`) })));
    const couleur = couleurValide(f.get('couleur') === 'libre' ? f.get('couleur_libre') : f.get('couleur')) || avant.couleur;
    await env.DB.prepare(
      `INSERT INTO reglages (commerce, seuil, recompense, mode, apres, taux, cadeaux, modifie) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(commerce) DO UPDATE SET seuil = excluded.seuil, recompense = excluded.recompense, mode = excluded.mode, apres = excluded.apres,
         taux = excluded.taux, cadeaux = excluded.cadeaux, modifie = excluded.modifie`
    ).bind(commerce, seuil, recompense, mode, apres, taux, JSON.stringify(cadeaux), maintenantIso()).run();
    if (couleur !== avant.couleur) await env.DB.prepare('UPDATE commerces SET couleur = ? WHERE handle = ?').bind(couleur, commerce).run();
    // Tampons et points ne se comptent pas pareil : changer de système remet les cartes à zéro
    let ok = 'Réglages enregistrés.';
    if (mode !== avant.mode) {
      await env.DB.prepare('UPDATE cartes SET tampons = 0, terminee = 0 WHERE commerce = ?').bind(commerce).run();
      ok = mode === 'points' ? 'Passage aux points : les cartes repartent de zéro.' : 'Passage aux tampons : les cartes repartent de zéro.';
    } else if (apres === 'recommence') {
      await env.DB.prepare('UPDATE cartes SET terminee = 0 WHERE commerce = ? AND terminee = 1').bind(commerce).run();
    }
    return rediriger('/pro?ok=' + encodeURIComponent(ok));
  }
  if (chemin === '/pro') {
    return html(pageTableau(c, await statistiques(env, commerce), await reglageDe(env, c), url.searchParams.get('ok') || '', env.SITE_URL));
  }
  return html(pageInconnue(), 404);
}

async function routesAdmin(env, requete, url) {
  // Statut d'abonnement depuis une automatisation (ex. Shopify Flow, « Send HTTP request ») :
  // POST /admin/statut  Authorization: Bearer <ADMIN_TOKEN>  {"commerce":"client-123","actif":false}
  if (url.pathname === '/admin/statut' && requete.method === 'POST' && (requete.headers.get('Content-Type') || '').includes('json')) {
    const auth = requete.headers.get('Authorization') || '';
    if (!env.ADMIN_TOKEN || !egal(auth, `Bearer ${env.ADMIN_TOKEN}`)) return new Response('Non autorisé', { status: 401 });
    const corps = await requete.json().catch(() => ({}));
    const commerce = String(corps.commerce || '');
    if (!/^[a-z0-9-]{1,80}$/.test(commerce)) return new Response('Commerce invalide', { status: 400 });
    const r = await env.DB.prepare('UPDATE commerces SET actif = ?, modifie = ? WHERE handle = ?').bind(corps.actif ? 1 : 0, maintenantIso(), commerce).run();
    return new Response(JSON.stringify({ ok: r.meta.changes > 0 }), { status: r.meta.changes > 0 ? 200 : 404, headers: { 'Content-Type': 'application/json' } });
  }
  if (requete.method !== 'POST') return html(pageAdmin('', await listeCommerces(env)));
  const f = await requete.formData();
  const liste = await listeCommerces(env);
  if (!env.ADMIN_TOKEN || !egal(String(f.get('jeton') || ''), env.ADMIN_TOKEN)) return html(pageAdmin('<p class="flash">Clé d’administration incorrecte.</p>', liste), 403);
  const commerce = String(f.get('commerce') || '').trim();
  if (!/^[a-z0-9-]{1,80}$/.test(commerce)) return html(pageAdmin('<p class="flash">Identifiant de commerce invalide (minuscules, chiffres, tirets).</p>', liste), 400);

  if (url.pathname === '/admin/commerce') {
    const t = (k, n = 200) => String(f.get(k) || '').trim().slice(0, n) || null;
    const couleur = /^#[0-9a-f]{6}$/i.test(t('couleur') || '') ? t('couleur') : '#0d0d0c';
    const seuil = Math.min(30, Math.max(3, parseInt(f.get('seuil'), 10) || 10));
    await env.DB.prepare(
      `INSERT INTO commerces (handle, nom, actif, couleur, logo, accroche, recompense, seuil, lien_menu, lien_avis, lien_reseaux, lien_site, modifie)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(handle) DO UPDATE SET nom = excluded.nom, actif = excluded.actif, couleur = excluded.couleur, logo = excluded.logo,
         accroche = excluded.accroche, recompense = excluded.recompense, seuil = excluded.seuil, lien_menu = excluded.lien_menu,
         lien_avis = excluded.lien_avis, lien_reseaux = excluded.lien_reseaux, lien_site = excluded.lien_site, modifie = excluded.modifie`
    ).bind(commerce, t('nom', 60) || commerce, f.get('actif') ? 1 : 0, couleur, t('logo', 500), t('accroche', 120), t('recompense', 80), seuil,
      t('lien_menu', 500), t('lien_avis', 500), t('lien_reseaux', 500), t('lien_site', 500), maintenantIso()).run();
    return html(pageAdmin(`<p class="flash">Commerce « ${echapper(commerce)} » enregistré${f.get('actif') ? '' : ' (arrêté : ses cartes affichent le message de fin)'}.</p>`, await listeCommerces(env)));
  }

  if (url.pathname === '/admin/cartes') {
    const nombre = Math.min(1000, Math.max(1, parseInt(f.get('nombre'), 10) || 1));
    const maintenant = maintenantIso();
    const lignes = ['numero,code,adresse'];
    for (let i = 1; i <= nombre; i++) {
      const code = aleatoire(10);
      await env.DB.prepare('INSERT INTO cartes (code, commerce, creee) VALUES (?, ?, ?)').bind(code, commerce, maintenant).run();
      lignes.push(`${i},${code},${env.PUBLIC_URL}/c/${code}`);
    }
    return new Response(lignes.join('\n') + '\n', {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="cartes-${commerce}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }
  if (url.pathname === '/admin/acces') {
    const cle = aleatoire(24);
    await env.DB.prepare(
      'INSERT INTO acces_pro (commerce, cle_hash, creee) VALUES (?, ?, ?) ON CONFLICT(commerce) DO UPDATE SET cle_hash = excluded.cle_hash, creee = excluded.creee'
    ).bind(commerce, await hacher(cle), maintenantIso()).run();
    const lien = `${env.PUBLIC_URL}/pro/connexion?commerce=${encodeURIComponent(commerce)}&cle=${cle}`;
    // E-mail prêt à envoyer au commerçant (ouvre la messagerie de l'administrateur)
    const objet = 'Votre espace commerçant ECRU';
    const corps = `Bonjour,\n\nVoici votre lien de connexion personnel à votre espace ECRU :\n${lien}\n\nOuvrez-le une fois sur le téléphone du comptoir : il reste connecté un an. Pour un collègue, ouvrez le même lien sur son téléphone.\nGardez ce lien pour vous : il donne accès à votre programme de fidélité.\n\nÀ bientôt,\nECRU`;
    const mailto = `mailto:?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`;
    return html(pageAdmin(`<div class="bloc"><p class="petit">Lien de connexion (l’ancien ne marche plus)</p><p style="word-break:break-all;margin-top:8px">${echapper(lien)}</p><a class="bouton plein" style="margin-top:14px" href="${echapper(mailto)}">Envoyer par e-mail</a></div>`, liste));
  }
  return html(pageInconnue(), 404);
}

export default {
  async fetch(requete, env) {
    const url = new URL(requete.url);
    try {
      const m = url.pathname.match(/^\/c\/([a-z0-9]{6,32})\/?$/);
      if (m) return await scanCarte(env, requete, url, m[1]);
      if (url.pathname === '/pro' || url.pathname.startsWith('/pro/')) return await routesPro(env, requete, url);
      if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) return await routesAdmin(env, requete, url);
      if (url.pathname === '/') return rediriger(env.SITE_URL || 'https://ecru.fr');
      return html(pageInconnue(), 404);
    } catch (e) {
      console.error(e);
      return html(pageMessage('Un instant', 'La page ne répond pas pour le moment. Réessayez dans quelques secondes.'), 503);
    }
  },
};
