# Product

## Register

product

## Users

Clients de MÖKA Café Saint-Martin qui commandent via `/commander`, dans deux contextes :
- En boutique, sur une tablette au comptoir (kiosque libre-service).
- À distance, sur leur propre mobile (avant de passer ou depuis leur table).

Le job à faire : parcourir le menu par catégorie, composer une commande (produits, variantes), gérer un panier, et passer commande rapidement sans friction — que ce soit debout au comptoir ou sur son téléphone.

## Product Purpose

Une interface de commande client pour un café de quartier, qui remplace la queue au comptoir par un parcours menu → panier → checkout fluide. Le succès se mesure à la vitesse et la clarté du parcours : un client doit pouvoir trouver son produit, choisir ses variantes et payer sans confusion, sur tablette comme sur mobile.

## Brand Personality

Chaleureux, artisanal, chic simple. MÖKA est un café de quartier haut de gamme mais accueillant — pas une chaîne, pas une plateforme. Le logo dessiné à la main et la police script (Dancing Script) portent cette identité ; la palette crème/brun/corail (voir `app/commander/_lib/theme.js`) est déjà établie et fait autorité.

Référence positive : la **clarté et la structure** de l'app Uber Eats (hiérarchie des cartes produits, organisation par catégories, lisibilité) — pas son style visuel générique de plateforme. La chaleur artisanale MÖKA doit rester dominante ; Uber Eats n'est une inspiration que pour l'architecture de l'information, jamais pour la palette ou le ton.

## Anti-references

- Le look générique "app de livraison de plateforme" (Uber Eats, Deliveroo, McDo) appliqué tel quel, avec ses couleurs et son ambiance — MÖKA ne doit jamais se lire comme une marque blanche de plateforme.
- Tout ce qui casse la chaleur artisanale : composants trop corporate, iconographie froide, absence de personnalité.

## Design Principles

- La clarté de parcours prime sur la décoration : un client pressé au comptoir doit comprendre l'écran en une seconde.
- La palette et la typographie MÖKA déjà en place font autorité — on ne les réinvente pas, on les applique avec plus de rigueur.
- Une seule interface doit bien fonctionner en kiosque tablette ET en mobile personnel — pas de version dégradée sur l'un ou l'autre.
- S'inspirer de la structure (hiérarchie, densité d'info) d'apps de commande éprouvées, jamais de leur identité visuelle.
- Chaque écran doit rester chaleureux et fait-main, jamais froid ou "plateforme".

## Accessibility & Inclusion

WCAG AA : contraste texte ≥4.5:1 (≥3:1 pour texte large), cibles tactiles ≥44px, navigation clavier fonctionnelle. Standard attendu pour une app de commande grand public utilisée par une clientèle variée (y compris âgée) sur tablette et mobile.
