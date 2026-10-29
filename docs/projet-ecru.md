# Projet ECRU : note de projet

Dernière mise à jour : 2026-10-29

## La marque

ECRU vend des cartes NFC personnalisées aux commerçants locaux (restaurants, barbiers, boutiques) :
une carte qui ouvre un lien d'un simple contact du téléphone. Identité noir et crème, style futuriste.
Interface et textes en français. Vente en ligne sur la boutique Shopify.

## L'offre

| Produit | Prix | Minimum |
|---|---|---|
| Cartes simples (PVC noir ou blanc) | 2,50 € | 10 |
| Sur mesure PVC | 3,50 € | 100 |
| Sur mesure métal | 12,90 € | 100 |
| Option lien (par carte, par lien) | 0,20 € | |
| Option fidélité | 29 € / mois | |
| Livraison | 4,90 € | offerte dès 100 € |

Finitions métal du site : satiné, chromé, irisé. Le brossé existe dans les réglages de la carte d'accueil,
mais n'est pas proposé aux clients.

## Ce qui est en place

- **Site Shopify :** accueil avec la grande carte 3D (PVC ou métal, finitions, rotation), page produit avec
  configurateur (logo, couleurs, liens), page fidélité dédiée, compte client avec « Vos cartes » pour recommander.
- **Fidélité :** serveur Cloudflare Worker déployé (25 tests passent), pages de liens à plusieurs boutons,
  couleurs et taille du logo réglables par le commerçant.
- **Corrections récentes :** livraison France fonctionnelle, métal ajoutable au panier, carte 3D fluide,
  chiffres de vente sourcés (Spiegel, BrightLocal, HBR, Bain), bannière cookies.
- **Versions du thème :** « mise à jour 12 » en ligne ; « mise à jour 17 » prête mais **non publiée**.
- **Planche fournisseur :** `docs/fournisseur/ECRU-card-materials.pdf` (5 matières, dimensions, coloris).

## Fabrication des cartes (en cours)

Le suivi détaillé des fournisseurs est dans `docs/fournisseur/suivi-fournisseurs.md`.
En résumé : gamme métal en hybride inox 0,8 mm, puce NTAG215, plusieurs coloris par matériau.
Aucun fournisseur n'a encore confirmé les finitions satiné, brossé, chrome miroir et irisé avec des prix.

## Ce qui reste à faire de ton côté

Liste complète dans `docs/a-faire.md`. Les points bloquants :

1. **Publier le thème « mise à jour 17 »**, puis retirer le mot de passe de la boutique.
2. **Créer le plan d'abonnement Fidélité** (29 €/mois) dans Subscriptions.
3. **Habiller la page de connexion Shopify** aux couleurs ECRU.
4. **Pages légales** : CGV, mentions légales (nom, adresse, SIRET).
5. **Nom de domaine** (ex. ecru.fr) : indispensable avant d'encoder des cartes.
6. **Forfait Shopify** et **Shopify Payments**.
7. **Fournisseur de puces et de cartes** : choisir après les réponses des fournisseurs.
8. **Avis clients réels** : les ajouter un par un, la section reste cachée tant qu'elle est vide.

## Prospection

Mail prêt pour For Guys (Argentan) dans `docs/prospection/`. À envoyer seulement après avoir mis ton nom,
ton téléphone et une adresse mail sur ton domaine (avec SPF, DKIM et DMARC).

## Règles de travail

- Aucun chiffre ni avis client inventé : seulement des sources vérifiées.
- Pas de mise en ligne du thème ni de `shopify theme push` sans accord explicite.
- Les secrets (clé Cloudflare, lien de démo) restent hors du dépôt.
