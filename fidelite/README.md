# ECRU Fidélité : le serveur des cartes

Un petit service (Cloudflare Workers + base D1) qui fait vivre les cartes Fidélité :

- **Le client scanne sa carte** → il voit sa progression (tampons, récompense, liens du commerce).
- **Le commerçant scanne la même carte avec son téléphone** → il voit le niveau du client et ajoute un tampon,
  en retire un, ou note la récompense remise.
- **Tableau de bord du commerçant** (`/pro`) : visites du mois, récompenses, clients revenus, réglage de la récompense.
- **Abonnement arrêté** (fiche Shopify « Commerce ECRU » avec *Abonnement actif* décoché, par Shopify Flow) :
  toutes les cartes du commerce affichent « Ce programme n'est plus actif », en moins d'une minute.

Deux façons de gérer les commerces :
- **Sans Shopify (par défaut, gratuit)** : les fiches des commerces (nom, logo, couleur, récompense, liens,
  actif / arrêté) se gèrent dans la page `/admin` du serveur. Pour arrêter un commerce qui résilie :
  décocher « Abonnement actif » dans sa fiche.
- **Avec Shopify (plus tard, forfait payant)** : avec un jeton Storefront API (application Headless), le serveur
  lit la fiche Shopify « Commerce ECRU », que Shopify Flow active ou arrête automatiquement.
  Flow peut aussi appeler directement `POST /admin/statut` (voir plus bas).

## Coût
Le niveau gratuit de Cloudflare suffit pour démarrer (100 000 scans par jour, base de 5 Go).
Il faut seulement un compte Cloudflare (gratuit) et votre nom de domaine.

## Mise en ligne (une fois, ~20 minutes)
1. Créer un compte sur cloudflare.com. Ajouter votre domaine (ex. `ecru.fr`) à Cloudflare
   ou au moins pouvoir créer un sous-domaine `carte.ecru.fr`.
2. Dans ce dossier : `npm install`, puis `npx wrangler login`.
3. Créer la base : `npx wrangler d1 create ecru-fidelite` → recopier l'identifiant affiché dans `wrangler.toml`
   (`database_id`), puis `npx wrangler d1 execute ecru-fidelite --remote --file=schema.sql`.
   Base déjà créée avant les points : `npx wrangler d1 execute ecru-fidelite --remote --file=migrations/0002_points.sql` (une seule fois, déjà fait sur la base actuelle).
4. (Facultatif, plus tard) Jeton Shopify : application **Headless** → jeton public Storefront API,
   puis `npx wrangler secret put SHOPIFY_STOREFRONT_TOKEN`. Sans lui, les commerces se gèrent dans /admin.
5. Secrets :
   - `npx wrangler secret put SESSION_SECRET` (une longue phrase aléatoire)
   - `npx wrangler secret put ADMIN_TOKEN` (votre mot de passe pour la page /admin)
6. Vérifier `PUBLIC_URL`, `SITE_URL` et `SHOP_DOMAIN` dans `wrangler.toml`, puis `npx wrangler deploy`.
7. Dans Cloudflare : Workers → ecru-fidelite → Domaines → ajouter `carte.ecru.fr`.

## Pour chaque nouveau commerçant Fidélité
1. Sur `https://carte.ecru.fr/admin`, « Fiche du commerce » : identifiant (ex. `maison-lune`), nom, couleur,
   logo (adresse d'une image en ligne, par ex. celle du fichier envoyé à la commande), récompense, liens.
2. Toujours sur `/admin` :
   - « Créer des cartes » : handle du commerce (ex. `client-123456`) + nombre → un fichier CSV avec une adresse
     **unique par carte**. L'envoyer au fournisseur pour l'encodage (une adresse par puce), puces verrouillées.
   - « Accès commerçant » : génère le lien de connexion à envoyer au commerçant. Il l'ouvre une fois sur le
     téléphone de la caisse (et ceux de son équipe) : ce téléphone devient « commerçant » pour ses cartes.
3. Tester une carte avant l'envoi : scanner avec un téléphone client, puis avec le téléphone du commerce.

## Récompenses : c'est le commerçant qui décide
Dans son tableau de bord (`/pro`), le commerçant choisit :
- **Tampons** : nombre de tampons, récompense, et si la carte **recommence** ou **s'arrête** après la récompense
  (il la relance en la scannant) ;
- **Points** : points par euro dépensé et jusqu'à 6 cadeaux avec leur prix en points. Au scan, il tape le montant
  de l'achat ; les cadeaux atteints s'affichent avec un bouton « Offrir ».
Changer de système remet les compteurs des cartes à zéro. La récompense saisie dans /admin n'est qu'une valeur de départ.

## Arrêt automatique (avec un forfait Shopify)
Dans Shopify Flow, sur « Subscription contract updated » : action **Send HTTP request**
- `POST https://carte.ecru.fr/admin/statut`
- en-têtes : `Content-Type: application/json`, `Authorization: Bearer <ADMIN_TOKEN>`
- corps : `{"commerce":"<identifiant>","actif":false}` (ou `true` pour réactiver)

## Sécurité
- Seul un téléphone connecté au commerce peut ajouter un tampon ; le client ne voit que sa progression.
- Codes de carte aléatoires (10 caractères), sessions commerçant signées, actions vérifiées (même origine),
  double appui ignoré (8 s), textes échappés.
- Une puce NFC simple (NTAG213/215) peut être copiée : un client pourrait dupliquer sa carte, mais pas
  s'ajouter de tampons. Pour aller plus loin : puces NTAG 424 DNA (adresse signée à chaque scan).

## Tests
`npm test` : 19 tests de bout en bout (base simulée, Shopify simulé ou absent).
Essai local : `npx wrangler dev` avec un fichier `.dev.vars` (voir les secrets ci-dessus).
