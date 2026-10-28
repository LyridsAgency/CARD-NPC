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
