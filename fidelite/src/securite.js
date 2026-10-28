// Outils de sécurité : aléa, hachage, signature des sessions commerçant (Web Crypto, Workers et Node).
const enc = new TextEncoder();
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // sans 0/o, 1/l/i : lisible si on le recopie

export function aleatoire(n) {
  const octets = crypto.getRandomValues(new Uint8Array(n));
  let s = '';
  for (const o of octets) s += ALPHABET[o % ALPHABET.length];
  return s;
}

function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hacher(texte) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(texte)));
}

async function cleHmac(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export async function signer(secret, valeur) {
  return hex(await crypto.subtle.sign('HMAC', await cleHmac(secret), enc.encode(valeur)));
}

// Comparaison en temps constant
export function egal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Session commerçant : « commerce.expiration.signature »
export async function creerSession(secret, commerce, jours = 365) {
  const exp = Math.floor(Date.now() / 1000) + jours * 86400;
  const corps = `${commerce}.${exp}`;
  return `${corps}.${await signer(secret, corps)}`;
}

export async function lireSession(secret, jeton) {
  if (!jeton) return null;
  const i = jeton.lastIndexOf('.');
  if (i < 0) return null;
  const corps = jeton.slice(0, i);
  const sig = jeton.slice(i + 1);
  if (!egal(sig, await signer(secret, corps))) return null;
  const j = corps.lastIndexOf('.');
  const commerce = corps.slice(0, j);
  const exp = Number(corps.slice(j + 1));
  if (!commerce || !(exp > Date.now() / 1000)) return null;
  return commerce;
}

export function lireCookie(requete, nom) {
  const c = requete.headers.get('Cookie') || '';
  for (const part of c.split(/;\s*/)) {
    const k = part.indexOf('=');
    if (k > 0 && part.slice(0, k) === nom) return decodeURIComponent(part.slice(k + 1));
  }
  return null;
}
