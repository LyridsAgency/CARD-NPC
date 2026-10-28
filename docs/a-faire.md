# Ce qu'il reste à faire (ECRU)

## Avant d'ouvrir la boutique
1. **Devise en EUR** et fuseau Europe/Paris — Paramètres → Général. Format des prix : Paramètres → Marchés
   (ou Général → Devise → Modifier le format) : `{{amount_with_comma_separator}} €` pour afficher « 2,50 € »
   partout (certaines pages affichent encore « €2,50 »).
2. **Nom de la boutique** « ECRU » — Paramètres → Général.
3. **Nom de domaine** (ex. ecru.fr) — Paramètres → Domaines. Indispensable avant d'encoder des cartes.
4. **Forfait Shopify** (Basic) — nécessaire pour retirer le mot de passe et encaisser.
5. **Paiements** : activer Shopify Payments — Paramètres → Paiements.
6. **Livraison** : zones et tarifs — Paramètres → Expédition et livraison.
7. **Pages légales** : CGV, remboursement, expédition, mentions légales (nom, adresse, SIRET) —
   Paramètres → Politiques. Shopify propose des modèles à compléter.
7b. **Cookies** : Paramètres → Confidentialité des clients → Bannière de cookies : activer les régions
   (Union européenne, Royaume-Uni), puis « Plus d'actions → Retirer la bannière » pour utiliser celle d'ECRU,
   assortie au site. Sans cela, c'est la bannière de Shopify qui s'affiche (la nôtre s'efface alors).
8. **Abonnement Fidélité** : dans Subscriptions, créer le plan mensuel (sans remise) avec le produit
   « Abonnement Fidélité » (29 €).
9. **Vérifier les prix** : simple PVC 2,50 € / métal 9,90 € ; sur mesure PVC 3,50 € / métal 12,90 € ;
   option lien 0,20 € par carte et par lien (produit caché « Option lien ») ; option fidélité 29 €/mois.
   Le produit « Carte Fidélité » est passé en brouillon : la fidélité est maintenant une option du sur mesure
   (l'ancienne adresse redirige).
10. **Mettre à jour puis publier le thème** : demander à Claude d'envoyer la dernière version sur
    « ECRU — site complet », puis « Publier », puis retirer le mot de passe — Boutique en ligne → Préférences.
10b. **Mode d'emploi** : page `/pages/mode-emploi` (lien dans le pied de page) et PDF imprimable
    `docs/mode-emploi-ecru.pdf`, à glisser dans les colis.

## Serveur des cartes Fidélité (Cloudflare, en ligne)
11. **Remplacer la clé Cloudflare** envoyée dans le chat — My Profile → API Tokens.
12. **Brancher le domaine** : sous-domaine `carte.<domaine>` sur le Worker « ecru-fidelite », puis mettre à jour
   `PUBLIC_URL` (à demander à Claude).
13. **Tester** sur téléphone : /admin → fiche du commerce « demo » → « Accès commerçant » → scanner une carte.

## Fournisseur des puces
14. Puces **NTAG213/215/216** (ou NTAG 424 DNA pour empêcher la copie), **verrouillées** après encodage.
15. Cartes simples / sur mesure : une adresse par commerce. Cartes Fidélité : **une adresse différente par carte**
    (fichier CSV généré dans /admin).

## Plus tard (avec le forfait)
16. **Shopify Flow** : arrêt automatique des cartes quand un abonnement est résilié (voir
    `docs/abonnement-fidelite.md` et `fidelite/README.md`).
17. **Klaviyo** : synchroniser les inscrits « Restez dans le cercle ».
18. **Avis clients** (Judge.me) quand les premiers vrais avis arrivent.
19. Remplacer les noms d'exemple des modèles (Maison Lune, Club Marceau…) par de vrais clients, avec leur accord.

## Logo et page de connexion
19. **Logo** : fichiers dans `docs/logo/` (SVG, PNG crème, PNG noir, icône) et déjà dans Contenu → Fichiers.
20. **Page de connexion / création de compte** (hébergée par Shopify) : Paramètres → Paiement (Checkout)
    → Personnaliser → Image de marque : logo « ecru-logo-noir.png » (ou crème sur fond noir), couleurs noir #0d0d0c
    et crème #e9e4d8, coins arrondis, police proche (Inter). Cela habille aussi le paiement et les comptes clients.
    (Non modifiable par l'API avec les droits actuels.)

## Avis clients
18. **Avis réels uniquement** : section « Avis clients ECRU » sur l'accueil, cachée tant qu'elle est vide.
    Ajouter chaque avis reçu (Personnaliser → Accueil → Avis → Ajouter un bloc « Avis »), ou installer une
    application d'avis (ex. Judge.me, gratuite) et ajouter son bloc dans cette même section.

## Prospection
17. **For Guys (Argentan)** : mail prêt dans `docs/prospection/` (HTML, texte, image, conseils anti-spam).
    Avant l'envoi : votre nom, téléphone, et une boîte mail sur votre domaine avec SPF/DKIM/DMARC.

## Recommandes (cartes recommandées par un commerçant)
21. Le commerçant recommande depuis **Votre compte → Vos cartes** (ou « Commander à nouveau mes cartes » dans son
    espace pro). La commande reprend tout : matière, finition, couleurs, textes et polices (`_maquette`), logo
    (même fichier), liens, quantité.
22. **Client déjà abonné** : sur sur mesure, la fidélité est cochée par défaut et marquée « Option fidélité :
    Incluse dans mon abonnement (recommande de #…) » ; l'abonnement n'est pas ajouté au panier. S'il la décoche,
    ce sont des cartes simples et le lien principal devient obligatoire. Avant fabrication, **vérifiez que son abonnement est toujours actif**, puis
    programmez les nouvelles cartes sur sa page de fidélité existante (`/admin` → son commerce → cartes).
    Le site ne propose « Déjà abonné » qu'à un client connecté dont une commande passée contient l'abonnement.
