# Ce qu'il reste à faire (ECRU)

## Avant d'ouvrir la boutique
1. **Devise en EUR** et fuseau Europe/Paris — Paramètres → Général.
2. **Nom de la boutique** « ECRU » — Paramètres → Général.
3. **Nom de domaine** (ex. ecru.fr) — Paramètres → Domaines. Indispensable avant d'encoder des cartes.
4. **Forfait Shopify** (Basic) — nécessaire pour retirer le mot de passe et encaisser.
5. **Paiements** : activer Shopify Payments — Paramètres → Paiements.
6. **Livraison** : zones et tarifs — Paramètres → Expédition et livraison.
7. **Pages légales** : CGV, remboursement, expédition — Paramètres → Politiques.
8. **Abonnement Fidélité** : dans Subscriptions, créer le plan mensuel (sans remise) avec le produit
   « Abonnement Fidélité » (29 €).
9. **Vérifier les prix** : simple PVC 2,50 € / métal 14,90 € ; sur mesure PVC 3,50 € / métal 17,90 € ;
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

## Prospection
17. **For Guys (Argentan)** : mail prêt dans `docs/prospection/` (HTML, texte, image, conseils anti-spam).
    Avant l'envoi : votre nom, téléphone, et une boîte mail sur votre domaine avec SPF/DKIM/DMARC.
