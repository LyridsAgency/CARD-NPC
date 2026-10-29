// Mode sans jeton Shopify : les commerces sont gérés dans la page /admin du serveur.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';

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

const BASE = 'https://carte.ecru.test';
let env;
beforeEach(() => {
  env = { DB: new D1(), PUBLIC_URL: BASE, SESSION_SECRET: 'secret-de-test-tres-long', ADMIN_TOKEN: 'admin-test' };
  globalThis.fetch = async () => {
    throw new Error('Shopify ne doit pas être appelé sans jeton');
  };
});

function form(obj) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, String(v));
  return f;
}
const appel = (chemin, { method = 'GET', body, headers = {} } = {}) =>
  worker.fetch(new Request(BASE + chemin, { method, body, headers, redirect: 'manual' }), env);

async function enregistrer(champs) {
  return appel('/admin/commerce', { method: 'POST', body: form({ jeton: 'admin-test', ...champs }) });
}

test('fiche du commerce créée dans /admin, puis carte lisible', async () => {
  const r = await enregistrer({ commerce: 'maison-lune', nom: 'Maison Lune', couleur: '#b8975a', recompense: 'Le dessert offert', seuil: 5, lien_menu: 'https://exemple.fr/menu', actif: 1 });
  assert.equal(r.status, 200);
  assert.match(await r.text(), /enregistré/);
  const csv = await (await appel('/admin/cartes', { method: 'POST', body: form({ jeton: 'admin-test', commerce: 'maison-lune', nombre: 1 }) })).text();
  const code = csv.trim().split('\n')[1].split(',')[1];
  const page = await (await appel(`/c/${code}`)).text();
  assert.match(page, /Maison Lune/);
  assert.match(page, /<span>\/ 5<\/span>/);
  assert.match(page, /Voir le menu/);
  assert.match(page, /background:#b8975a;color:#121211/); // la page prend la couleur du commerce, texte foncé sur fond clair
  const liste = await (await appel('/admin')).text();
  assert.match(liste, /maison-lune · 1 carte · actif/);
});

test('arrêt depuis /admin : cartes arrêtées', async () => {
  await enregistrer({ commerce: 'atelier', nom: 'Atelier', actif: 1 });
  const code = (await (await appel('/admin/cartes', { method: 'POST', body: form({ jeton: 'admin-test', commerce: 'atelier', nombre: 1 }) })).text()).trim().split('\n')[1].split(',')[1];
  await enregistrer({ commerce: 'atelier', nom: 'Atelier' }); // case « actif » décochée
  assert.match(await (await appel(`/c/${code}`)).text(), /n’est plus actif/);
});

test('statut par automatisation (Flow) : clé requise, arrêt puis réactivation', async () => {
  await enregistrer({ commerce: 'club', nom: 'Club', actif: 1 });
  const code = (await (await appel('/admin/cartes', { method: 'POST', body: form({ jeton: 'admin-test', commerce: 'club', nombre: 1 }) })).text()).trim().split('\n')[1].split(',')[1];
  const json = (corps, cle = 'admin-test') => appel('/admin/statut', { method: 'POST', body: JSON.stringify(corps), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cle}` } });
  assert.equal((await json({ commerce: 'club', actif: false }, 'mauvaise')).status, 401);
  assert.equal((await json({ commerce: 'club', actif: false })).status, 200);
  assert.match(await (await appel(`/c/${code}`)).text(), /n’est plus actif/);
  assert.equal((await json({ commerce: 'club', actif: true })).status, 200);
  assert.doesNotMatch(await (await appel(`/c/${code}`)).text(), /n’est plus actif/);
  assert.equal((await json({ commerce: 'inconnu', actif: true })).status, 404);
});

test('liens non http refusés (pas de javascript:)', async () => {
  await enregistrer({ commerce: 'x', nom: 'X', actif: 1, lien_menu: 'javascript:alert(1)' });
  const code = (await (await appel('/admin/cartes', { method: 'POST', body: form({ jeton: 'admin-test', commerce: 'x', nombre: 1 }) })).text()).trim().split('\n')[1].split(',')[1];
  assert.doesNotMatch(await (await appel(`/c/${code}`)).text(), /javascript:/);
});

test('la page prend la couleur du commerce, texte lisible (crème sur foncé, noir sur clair)', async () => {
  await enregistrer({ commerce: 'sombre', nom: 'Sombre', couleur: '#1b2440', actif: 1 });
  const code = (await (await appel('/admin/cartes', { method: 'POST', body: form({ jeton: 'admin-test', commerce: 'sombre', nombre: 1 }) })).text()).trim().split('\n')[1].split(',')[1];
  const page = await (await appel(`/c/${code}`)).text();
  assert.match(page, /background:#1b2440/);
  assert.match(page, /\.tampons li\.plein\{background:#e9e4d8/);
  await enregistrer({ commerce: 'clair', nom: 'Clair', couleur: '#e9e4d8', actif: 1 });
  const code2 = (await (await appel('/admin/cartes', { method: 'POST', body: form({ jeton: 'admin-test', commerce: 'clair', nombre: 1 }) })).text()).trim().split('\n')[1].split(',')[1];
  const page2 = await (await appel(`/c/${code2}`)).text();
  assert.match(page2, /background:#e9e4d8/);
  assert.match(page2, /\.tampons li\.plein\{background:#121211/);
});

test('le patron choisit la couleur de sa page depuis son espace', async () => {
  await enregistrer({ commerce: 'cafe', nom: 'Café', couleur: '#0d0d0c', actif: 1 });
  const code = (await (await appel('/admin/cartes', { method: 'POST', body: form({ jeton: 'admin-test', commerce: 'cafe', nombre: 1 }) })).text()).trim().split('\n')[1].split(',')[1];
  const r = await appel('/admin/acces', { method: 'POST', body: form({ jeton: 'admin-test', commerce: 'cafe' }) });
  const lien = (await r.text()).match(/\/pro\/connexion\?commerce=[^<"\s]+/)[0].replace(/&amp;/g, '&');
  const cookie = (await appel(lien)).headers.get('Set-Cookie').split(';')[0];
  const reglages = (champs) => appel('/pro/reglages', { method: 'POST', body: form({ seuil: 10, recompense: 'Un café', ...champs }), headers: { cookie, origin: BASE } });
  // Une couleur du nuancier
  await reglages({ couleur: '#1f3a2e' });
  assert.match(await (await appel(`/c/${code}`)).text(), /background:#1f3a2e/);
  // Une couleur libre, claire : le texte passe en noir
  await reglages({ couleur: 'libre', couleur_libre: '#F2C94C' });
  assert.match(await (await appel(`/c/${code}`)).text(), /background:#f2c94c;color:#121211/);
  // Valeur invalide : la couleur précédente est gardée
  await reglages({ couleur: 'red;}' });
  assert.match(await (await appel(`/c/${code}`)).text(), /background:#f2c94c/);
  // Le tableau de bord montre les deux nuanciers
  const tableau = await (await appel('/pro', { headers: { cookie } })).text();
  assert.match(tableau, /Fond de votre page/);
  assert.match(tableau, /Couleur des tampons/);

  // Seconde couleur : les tampons, la barre et le bouton prennent l'accent
  await reglages({ couleur: '#0d0d0c', accent: '#c2a165' });
  let page = await (await appel(`/c/${code}`)).text();
  assert.match(page, /background:#0d0d0c/);
  assert.match(page, /\.tampons li\.plein\{background:#c2a165/);
  assert.match(page, /button\.plein,\.bouton\.plein\{background:#c2a165;border-color:#c2a165;color:#121211/);
  // Accent trop proche du fond : remplacé par la couleur du texte, toujours visible
  await reglages({ couleur: '#0d0d0c', accent: 'libre', accent_libre: '#1b2440' });
  assert.match(await (await appel(`/c/${code}`)).text(), /\.tampons li\.plein\{background:#e9e4d8/);
  // L'admin modifie la fiche : la couleur des tampons choisie par le patron est gardée
  await reglages({ couleur: '#0d0d0c', accent: '#c2a165' });
  await enregistrer({ commerce: 'cafe', nom: 'Café', couleur: '#1f3a2e', actif: 1 });
  page = await (await appel(`/c/${code}`)).text();
  assert.match(page, /background:#1f3a2e/);
  assert.match(page, /\.tampons li\.plein\{background:#c2a165/);
  // Taille du logo : 150 %, plafonnée à 170 %, gardée quand on change seulement les couleurs
  await reglages({ couleur: '#1f3a2e', accent: '#c2a165', taille_logo: 150 });
  assert.match(await (await appel(`/c/${code}`)).text(), /\.logo\{display:block;max-width:min\(300px,100%\);max-height:165px/);
  await reglages({ couleur: '#1f3a2e', accent: '#c2a165', taille_logo: 400 });
  assert.match(await (await appel(`/c/${code}`)).text(), /max-width:min\(340px,100%\);max-height:187px/);
  await reglages({ couleur: '#1f3a2e', accent: '#c2a165' });
  assert.match(await (await appel(`/c/${code}`)).text(), /max-width:min\(340px,100%\)/);
  await enregistrer({ commerce: 'cafe', nom: 'Café', couleur: '#1f3a2e', actif: 1 });
  assert.match(await (await appel(`/c/${code}`)).text(), /max-width:min\(340px,100%\)/);
  assert.match(await (await appel('/pro', { headers: { cookie } })).text(), /Taille de votre logo/);
  // « Automatique » : retour à la couleur du texte
  await reglages({ couleur: '#1f3a2e', accent: 'auto' });
  assert.match(await (await appel(`/c/${code}`)).text(), /\.tampons li\.plein\{background:#e9e4d8/);
});

test('page de liens : une carte à plusieurs liens ouvre la page du commerce, à ses couleurs', async () => {
  const r = await enregistrer({ commerce: 'atelier-lea', nom: 'Atelier Léa', couleur: '#e9e4d8', actif: 0, lien_menu: 'https://lea.fr/menu', lien_avis: 'https://g.page/lea/review', lien_site: 'https://lea.fr' });
  assert.match(await r.text(), /\/l\/atelier-lea/);
  const page = await (await appel('/l/atelier-lea')).text();
  assert.match(page, /Atelier Léa/);
  assert.match(page, /href="https:\/\/lea\.fr\/menu"/);
  assert.match(page, /href="https:\/\/g\.page\/lea\/review"/);
  assert.match(page, /background:#e9e4d8;color:#121211/);
  assert.doesNotMatch(page, /n’est plus actif/); // ouverte même sans abonnement fidélité
  assert.equal((await appel('/l/inconnu')).status, 404);
  await enregistrer({ commerce: 'sans-liens', nom: 'Sans liens', actif: 1 });
  assert.equal((await appel('/l/sans-liens')).status, 404);
});
