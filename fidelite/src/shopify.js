// Fiche du commerce, lue dans Shopify (métaobjet « Commerce ECRU ») via la Storefront API.
// Shopify reste la source unique : nom, logo, couleur, liens, et surtout « actif » (abonnement).
const CACHE = new Map();
const DUREE = 60 * 1000; // une minute : une résiliation est prise en compte très vite

const REQUETE = `query Commerce($h: MetaobjectHandleInput!) {
  metaobject(handle: $h) {
    handle
    nom: field(key: "nom") { value }
    actif: field(key: "actif") { value }
    couleur: field(key: "couleur") { value }
    accroche: field(key: "accroche") { value }
    recompense: field(key: "recompense") { value }
    seuil: field(key: "seuil") { value }
    lien_menu: field(key: "lien_menu") { value }
    lien_avis: field(key: "lien_avis") { value }
    lien_reseaux: field(key: "lien_reseaux") { value }
    lien_site: field(key: "lien_site") { value }
    logo: field(key: "logo") { reference { ... on MediaImage { image { url } } } }
  }
}`;

// Fiche gérée dans la base (page /admin) : utilisée quand aucun jeton Shopify n'est configuré
function lien(u) {
  return /^https?:\/\//.test(u || '') ? u : null;
}
export function normaliser(r) {
  if (!r) return null;
  return {
    handle: r.handle,
    nom: r.nom || 'Votre commerce',
    actif: !!r.actif,
    couleur: /^#[0-9a-f]{6}(;(#[0-9a-f]{6})?(;\d{2,3})?)?$/i.test(r.couleur || '') ? r.couleur : '#0d0d0c', // « fond;accent;taille du logo »
    accroche: r.accroche || '',
    recompense: r.recompense || '',
    seuil: Math.min(30, Math.max(3, parseInt(r.seuil, 10) || 10)),
    liens: [
      ['Voir le menu', lien(r.lien_menu)],
      ['Laisser un avis', lien(r.lien_avis)],
      ['Nous suivre', lien(r.lien_reseaux)],
      ['Notre site', lien(r.lien_site)],
    ].filter((l) => l[1]),
    logo: lien(r.logo) || '',
  };
}

export async function lireCommerce(env, handle, maintenant = Date.now()) {
  if (!env.SHOPIFY_STOREFRONT_TOKEN) {
    return normaliser(await env.DB.prepare('SELECT * FROM commerces WHERE handle = ?').bind(handle).first());
  }
  const memo = CACHE.get(handle);
  if (memo && maintenant - memo.t < DUREE) return memo.v;
  // SHOPIFY_API_URL : uniquement pour les essais en local (fausse boutique)
  const api = env.SHOPIFY_API_URL || `https://${env.SHOP_DOMAIN}/api/2025-01/graphql.json`;
  const rep = await fetch(api, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': env.SHOPIFY_STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query: REQUETE, variables: { h: { type: 'ecru_commerce', handle } } }),
  });
  if (!rep.ok) throw new Error(`Shopify ${rep.status}`);
  const json = await rep.json();
  const m = json.data && json.data.metaobject;
  const v = m
    ? {
        handle: m.handle,
        nom: m.nom?.value || 'Votre commerce',
        actif: m.actif?.value === 'true',
        couleur: /^#[0-9a-f]{6}$/i.test(m.couleur?.value || '') ? m.couleur.value : '#0d0d0c',
        accroche: m.accroche?.value || '',
        recompense: m.recompense?.value || '',
        seuil: Math.min(30, Math.max(3, parseInt(m.seuil?.value, 10) || 10)),
        liens: [
          ['Voir le menu', m.lien_menu?.value],
          ['Laisser un avis', m.lien_avis?.value],
          ['Nous suivre', m.lien_reseaux?.value],
          ['Notre site', m.lien_site?.value],
        ].filter((l) => /^https?:\/\//.test(l[1] || '')),
        logo: m.logo?.reference?.image?.url || '',
      }
    : null;
  CACHE.set(handle, { t: maintenant, v });
  return v;
}

export function viderCache() {
  CACHE.clear();
}
