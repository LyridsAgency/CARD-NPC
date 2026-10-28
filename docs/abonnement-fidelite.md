# Abonnement Fidélité : page commerçant liée à l'abonnement

## Principe
- Chaque commerçant Fidélité a une entrée **Commerce ECRU** (Contenu → Métaobjets), avec le handle `client-<ID client Shopify>`.
- Sa carte NFC ouvre `https://<domaine>/pages/carte/client-<ID>`.
- Champ **Abonnement actif** coché : la page du commerce s'affiche (logo, couleur, récompense, liens).
  Décoché : la carte affiche « Ce programme n'est plus actif ».
- Le commerçant résilie lui-même depuis son compte client (rubrique Abonnements, Shopify Subscriptions).
- Shopify Flow coche / décoche **Abonnement actif** automatiquement.

## Flux 1 : abonnement créé → page créée et active
1. Installer **Shopify Flow** (gratuit), créer un flux.
2. Déclencheur : **Subscription contract created**.
3. Action : **Send Admin API request** → mutation `metaobjectUpsert`, avec :
```json
{
  "handle": { "type": "ecru_commerce", "handle": "client-{{subscriptionContract.customer.legacyResourceId}}" },
  "metaobject": {
    "capabilities": { "publishable": { "status": "ACTIVE" } },
    "fields": [
      { "key": "nom", "value": "{{subscriptionContract.customer.displayName}}" },
      { "key": "actif", "value": "true" },
      { "key": "client_id", "value": "{{subscriptionContract.customer.id}}" },
      { "key": "adresse_carte", "value": "https://VOTRE-DOMAINE/pages/carte/client-{{subscriptionContract.customer.legacyResourceId}}" }
    ]
  }
}
```

## Flux 2 : abonnement modifié (résilié, en pause, réactivé) → page coupée ou rallumée
1. Déclencheur : **Subscription contract updated**.
2. Condition : `subscriptionContract.status` **est égal à** `ACTIVE`.
3. Branche « vrai » : **Send Admin API request** → `metaobjectUpsert` avec `{ "key": "actif", "value": "true" }`.
4. Branche « faux » : même action avec `{ "key": "actif", "value": "false" }`.
   (Même `handle` que ci-dessus, sans le champ `nom` pour ne pas écraser le nom du commerce.)

Remplacer `VOTRE-DOMAINE` par le domaine définitif (ex. `ecru.fr`), jamais par l'adresse en `.myshopify.com`.

## Espace pro
- Page `/pages/espace-pro` (lien dans le pied de page) : le commerçant se connecte avec l'e-mail de sa commande.
- Il voit le statut de son programme, l'adresse de ses cartes, sa page, et accède à son compte (factures, pause, résiliation).
- Les modifications de page passent par « Demander une modification » (formulaire), puis on met à jour sa fiche Commerce ECRU.

## À la réception d'une commande Fidélité
- Compléter l'entrée `client-<ID>` : logo (fourni à la commande, propriété « Logo »), couleur, récompense, liens.
- Programmer les cartes avec l'URL `/pages/carte/client-<ID>`.

## Exemples
- Page active : `/pages/carte/demo`
- Page suspendue : `/pages/carte/demo-suspendu`
