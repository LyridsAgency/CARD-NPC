// Tests de bout en bout du Worker : base D1 simulée avec SQLite (node:sqlite), Shopify simulé.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';
import { viderCache } from '../src/shopify.js';

class D1 {
  constructor() {
    this.db = new DatabaseSync(':memory:');
    this.db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  }
  prepare(sql) {
    const db = this.db;
    let args = [];
    return {
      bind(...a) {
        args = a;
        return this;
      },
      async first() {
        return db.prepare(sql).get(...args) ?? null;
      },
      async all() {
        return { results: db.prepare(sql).all(...args) };
      },
      async run() {
        const r = db.prepare(sql).run(...args);
        return { meta: { changes: r.changes } };
      },
    };
  }
}

let env;
let fiches;
const BASE = 'https://carte.ecru.test';

beforeEach(() => {
  viderCache();
  env = {
    DB: new D1(),
    PUBLIC_URL: BASE,
    SHOP_DOMAIN: 'boutique.myshopify.com',
    SHOPIFY_STOREFRONT_TOKEN: 'jeton',
    SESSION_SECRET: 'secret-de-test-tres-long',
    ADMIN_TOKEN: 'admin-test',
  };
  fiches = {
    'client-1': { nom: 'Maison Lune', actif: 'true', couleur: '#5a1a22', recompense: 'Le dessert offert', seuil: '3' },
    'client-2': { nom: 'Atelier Sel', actif: 'false', couleur: '#e9e4d8' },
  };
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /boutique\.myshopify\.com\/api\/.*graphql\.json/);
    assert.equal(init.headers['X-Shopify-Storefront-Access-Token'], 'jeton');
    const { variables } = JSON.parse(init.body);
    const f = fiches[variables.h.handle];
    const champ = (k) => (f && f[k] != null ? { value: f[k] } : null);
    const metaobject = f
      ? { handle: variables.h.handle, nom: champ('nom'), actif: champ('actif'), couleur: champ('couleur'), accroche: null, recompense: champ('recompense'), seuil: champ('seuil'), lien_menu: { value: 'https://exemple.fr/menu' }, lien_avis: null, lien_reseaux: null, lien_site: null, logo: null }
      : null;
    return new Response(JSON.stringify({ data: { metaobject } }), { headers: { 'Content-Type': 'application/json' } });
  };
});

function form(obj) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, String(v));
  return f;
}

async function appel(chemin, { method = 'GET', body, cookie, origin } = {}) {
  const headers = new Headers();
  if (cookie) headers.set('Cookie', cookie);
  if (origin) headers.set('Origin', origin);
  return worker.fetch(new Request(BASE + chemin, { method, body, headers, redirect: 'manual' }), env);
}

async function creerCartes(commerce, nombre) {
  const r = await appel('/admin/cartes', { method: 'POST', body: form({ jeton: 'admin-test', commerce, nombre }) });
  assert.equal(r.status, 200);
  const csv = await r.text();
  return csv.trim().split('\n').slice(1).map((l) => l.split(',')[1]);
}

async function connexionPro(commerce) {
  const r = await appel('/admin/acces', { method: 'POST', body: form({ jeton: 'admin-test', commerce }) });
  const lien = (await r.text()).match(/\/pro\/connexion\?commerce=[^<"\s]+/)[0].replace(/&amp;/g, '&');
  const c = await appel(lien);
  assert.equal(c.status, 303);
  return c.headers.get('Set-Cookie').split(';')[0];
}

test('admin : clé incorrecte refusée', async () => {
  const r = await appel('/admin/cartes', { method: 'POST', body: form({ jeton: 'faux', commerce: 'client-1', nombre: 5 }) });
  assert.equal(r.status, 403);
});

test('admin : crée des cartes uniques avec leur adresse', async () => {
  const r = await appel('/admin/cartes', { method: 'POST', body: form({ jeton: 'admin-test', commerce: 'client-1', nombre: 50 }) });
  const csv = await r.text();
  const lignes = csv.trim().split('\n');
  assert.equal(lignes[0], 'numero,code,adresse');
  assert.equal(lignes.length, 51);
  const codes = lignes.slice(1).map((l) => l.split(',')[1]);
  assert.equal(new Set(codes).size, 50);
  assert.ok(lignes[1].endsWith(`${BASE}/c/${codes[0]}`));
});

test('client : voit sa progression, ne peut pas ajouter de tampon', async () => {
  const [code] = await creerCartes('client-1', 1);
  const r = await appel(`/c/${code}`);
  assert.equal(r.status, 200);
  const page = await r.text();
  assert.match(page, /Maison Lune/);
  assert.match(page, /<b>0<\/b><span>\/ 3<\/span>/);
  assert.match(page, /premier tampon/);
  assert.doesNotMatch(page, /Mode commerçant/);
  const p = await appel(`/c/${code}`, { method: 'POST', body: form({ action: 'tampon' }) });
  assert.equal(p.status, 403);
});

test('commerçant : voit le niveau, ajoute un tampon, anti double appui, récompense', async () => {
  const [code] = await creerCartes('client-1', 1);
  const cookie = await connexionPro('client-1');
  let r = await appel(`/c/${code}`, { cookie });
  assert.match(await r.text(), /Mode commerçant/);

  r = await appel(`/c/${code}`, { method: 'POST', cookie, origin: BASE, body: form({ action: 'tampon' }) });
  assert.equal(r.status, 303);
  assert.match(decodeURIComponent(r.headers.get('Location')), /Tampon ajouté : 1 \/ 3/);
  // Double appui immédiat : ignoré
  r = await appel(`/c/${code}`, { method: 'POST', cookie, origin: BASE, body: form({ action: 'tampon' }) });
  assert.match(decodeURIComponent(r.headers.get('Location')), /déjà ajouté/);
  env.DB.db.prepare("UPDATE evenements SET a = '2020-01-01T00:00:00.000Z'").run();
  await appel(`/c/${code}`, { method: 'POST', cookie, origin: BASE, body: form({ action: 'tampon' }) });
  env.DB.db.prepare("UPDATE evenements SET a = '2020-01-01T00:00:00.000Z'").run();
  r = await appel(`/c/${code}`, { method: 'POST', cookie, origin: BASE, body: form({ action: 'tampon' }) });
  assert.match(decodeURIComponent(r.headers.get('Location')), /3 \/ 3\. Récompense due/);

  // Le client voit sa récompense
  const client = await (await appel(`/c/${code}`)).text();
  assert.match(client, /Récompense disponible/);
  assert.match(client, /Le dessert offert/);

  // Le commerçant la remet : la carte repart à zéro
  r = await appel(`/c/${code}`, { method: 'POST', cookie, origin: BASE, body: form({ action: 'recompense' }) });
  assert.match(decodeURIComponent(r.headers.get('Location')), /Récompense remise/);
  const k = env.DB.db.prepare('SELECT * FROM cartes WHERE code = ?').get(code);
  assert.equal(k.tampons, 0);
  assert.equal(k.visites, 3);
  assert.equal(k.recompenses, 1);
});

test('commerçant : action venant d’un autre site refusée', async () => {
  const [code] = await creerCartes('client-1', 1);
  const cookie = await connexionPro('client-1');
  const r = await appel(`/c/${code}`, { method: 'POST', cookie, origin: 'https://pirate.example', body: form({ action: 'tampon' }) });
  assert.equal(r.status, 403);
});

test('commerçant d’un autre commerce : vue client uniquement', async () => {
  const [code] = await creerCartes('client-1', 1);
  fiches['client-3'] = { nom: 'Autre', actif: 'true', couleur: '#000000' };
  const cookie = await connexionPro('client-3');
  const page = await (await appel(`/c/${code}`, { cookie })).text();
  assert.doesNotMatch(page, /Mode commerçant/);
  const r = await appel(`/c/${code}`, { method: 'POST', cookie, origin: BASE, body: form({ action: 'tampon' }) });
  assert.equal(r.status, 403);
});

test('abonnement arrêté : la carte affiche le message de fin', async () => {
  const [code] = await creerCartes('client-2', 1);
  const page = await (await appel(`/c/${code}`)).text();
  assert.match(page, /n’est plus actif/);
  assert.doesNotMatch(page, /aria-label="Vos tampons"/);
});

test('abonnement arrêté puis réactivé (Flow) : pris en compte après le cache', async () => {
  const [code] = await creerCartes('client-1', 1);
  assert.doesNotMatch(await (await appel(`/c/${code}`)).text(), /n’est plus actif/);
  fiches['client-1'].actif = 'false';
  viderCache();
  assert.match(await (await appel(`/c/${code}`)).text(), /n’est plus actif/);
});

test('carte inconnue : 404', async () => {
  const r = await appel('/c/abcdefghjk');
  assert.equal(r.status, 404);
});

test('session falsifiée refusée', async () => {
  const [code] = await creerCartes('client-1', 1);
  const r = await appel(`/c/${code}`, { cookie: 'ecru_pro=client-1.9999999999.deadbeef' });
  assert.doesNotMatch(await r.text(), /Mode commerçant/);
});

test('tableau de bord : statistiques et réglages de la récompense', async () => {
  const codes = await creerCartes('client-1', 3);
  const cookie = await connexionPro('client-1');
  for (const code of codes.slice(0, 2)) {
    await appel(`/c/${code}`, { method: 'POST', cookie, origin: BASE, body: form({ action: 'tampon' }) });
  }
  env.DB.db.prepare("UPDATE evenements SET a = '2020-01-01T00:00:00.000Z' WHERE carte = ?").run(codes[0]);
  await appel(`/c/${codes[0]}`, { method: 'POST', cookie, origin: BASE, body: form({ action: 'tampon' }) });

  let page = await (await appel('/pro', { cookie })).text();
  assert.match(page, /<b>2<\/b><p class="doux">visites/); // ce mois-ci (l'événement de 2020 ne compte pas)
  assert.match(page, /<b>50 %<\/b>/); // 1 carte sur 2 est revenue
  assert.match(page, /Cartes en circulation : 2 sur 3/);

  const r = await appel('/pro/reglages', { method: 'POST', cookie, origin: BASE, body: form({ seuil: 8, recompense: 'Un café offert' }) });
  assert.equal(r.status, 303);
  page = await (await appel('/pro', { cookie })).text();
  assert.match(page, /value="8"/);
  assert.match(page, /Un café offert/);
  const client = await (await appel(`/c/${codes[2]}`)).text();
  assert.match(client, /<span>\/ 8<\/span>/);

  // Le patron choisit la couleur de sa page : une couleur du nuancier, puis une couleur libre
  await appel('/pro/reglages', { method: 'POST', cookie, origin: BASE, body: form({ seuil: 8, recompense: 'Un café offert', couleur: '#1f3a2e' }) });
  assert.match(await (await appel(`/c/${codes[2]}`)).text(), /background:#1f3a2e/);
  await appel('/pro/reglages', { method: 'POST', cookie, origin: BASE, body: form({ seuil: 8, recompense: 'Un café offert', couleur: 'libre', couleur_libre: '#F2C94C' }) });
  assert.match(await (await appel(`/c/${codes[2]}`)).text(), /background:#f2c94c;color:#121211/);
  // Valeur invalide : la couleur précédente est gardée
  await appel('/pro/reglages', { method: 'POST', cookie, origin: BASE, body: form({ seuil: 8, recompense: 'Un café offert', couleur: 'red;}' }) });
  assert.match(await (await appel(`/c/${codes[2]}`)).text(), /background:#f2c94c/);
});

test('tableau de bord sans connexion : refusé', async () => {
  const r = await appel('/pro');
  assert.equal(r.status, 401);
});

test('lien de connexion invalide refusé', async () => {
  await connexionPro('client-1');
  const r = await appel('/pro/connexion?commerce=client-1&cle=mauvaise');
  assert.equal(r.status, 403);
});

test('textes du commerçant échappés (pas d’injection HTML)', async () => {
  fiches['client-1'].nom = '<script>alert(1)</script>';
  const [code] = await creerCartes('client-1', 1);
  const page = await (await appel(`/c/${code}`)).text();
  assert.doesNotMatch(page, /<script>alert/);
  assert.match(page, /&lt;script&gt;/);
});

test('en-têtes : la politique de référent laisse passer l’origine des formulaires', async () => {
  const [code] = await creerCartes('client-1', 1);
  const r = await appel(`/c/${code}`);
  assert.equal(r.headers.get('Referrer-Policy'), 'same-origin');
  assert.doesNotMatch(await r.text(), /content="no-referrer"/);
});

const vieillir = () => env.DB.db.prepare("UPDATE evenements SET a = '2020-01-01T00:00:00.000Z'").run();
async function poster(code, cookie, champs) {
  const r = await appel(`/c/${code}`, { method: 'POST', cookie, origin: BASE, body: form(champs) });
  assert.equal(r.status, 303);
  return decodeURIComponent(r.headers.get('Location'));
}
async function regler(cookie, champs) {
  const r = await appel('/pro/reglages', { method: 'POST', cookie, origin: BASE, body: form(champs) });
  assert.equal(r.status, 303);
  return decodeURIComponent(r.headers.get('Location'));
}

test('patron : choisit sa récompense, la carte s’arrête puis il la relance', async () => {
  const [code] = await creerCartes('client-1', 1);
  const cookie = await connexionPro('client-1');
  await regler(cookie, { mode: 'tampons', seuil: 3, recompense: 'La coupe offerte', apres: 'termine' });
  for (let i = 0; i < 3; i++) {
    await poster(code, cookie, { action: 'tampon' });
    vieillir();
  }
  assert.match(await poster(code, cookie, { action: 'recompense' }), /La carte est complète/);
  // Carte complète : plus de tampon, le client le voit
  assert.equal(await poster(code, cookie, { action: 'tampon' }), `/c/${code}?ok=`);
  assert.match(await (await appel(`/c/${code}`)).text(), /Carte complète/);
  assert.match(await (await appel(`/c/${code}`, { cookie })).text(), /Relancer la carte/);
  assert.match(await poster(code, cookie, { action: 'relancer' }), /repart pour un tour/);
  assert.match(await poster(code, cookie, { action: 'tampon' }), /Tampon ajouté : 1 \/ 3/);
});

test('patron : système de points, ses cadeaux à ses prix', async () => {
  const [code] = await creerCartes('client-1', 1);
  const cookie = await connexionPro('client-1');
  assert.match(
    await regler(cookie, { mode: 'points', taux: '2', cadeau_nom_0: 'Shampoing offert', cadeau_points_0: '300', cadeau_nom_1: 'Café offert', cadeau_points_1: '40' }),
    /Passage aux points/
  );
  let page = await (await appel('/pro', { cookie })).text();
  assert.match(page, /value="Café offert"/);
  // 25,50 € à 2 points par euro : 51 points
  assert.match(await poster(code, cookie, { action: 'achat', montant: '25,50' }), /\+ 51 points : 51 au total/);
  assert.match(await poster(code, cookie, { action: 'achat', montant: '10' }), /déjà ajoutés/);
  page = await (await appel(`/c/${code}`)).text();
  assert.match(page, /<b>51<\/b><span>points<\/span>/);
  assert.match(page, /Café offert/);
  assert.match(page, /plus que 249 points pour « Shampoing offert »/);
  // Cadeaux triés : le café (40) est le premier, et il est offrable
  page = await (await appel(`/c/${code}`, { cookie })).text();
  assert.match(page, /Offrir : Café offert · 40 pts/);
  assert.doesNotMatch(page, /Offrir : Shampoing/);
  assert.match(await poster(code, cookie, { action: 'offrir', cadeau: '0' }), /Café offert : offert\. Il reste 11 points/);
  assert.equal(await poster(code, cookie, { action: 'offrir', cadeau: '1' }), `/c/${code}?ok=`);
  assert.match(await poster(code, cookie, { action: 'corriger', points: '5' }), /5 points retirés/);
  assert.equal(env.DB.db.prepare('SELECT tampons FROM cartes WHERE code = ?').get(code).tampons, 6);
  // Retour aux tampons : les compteurs repartent de zéro
  assert.match(await regler(cookie, { mode: 'tampons', seuil: 5 }), /Passage aux tampons/);
  assert.equal(env.DB.db.prepare('SELECT tampons FROM cartes WHERE code = ?').get(code).tampons, 0);
});
