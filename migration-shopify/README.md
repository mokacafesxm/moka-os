# Migration Shopify → Notion (MOKA OS)

Récupère le catalogue produits actifs depuis Shopify, ré-héberge les photos sur
Vercel Blob, puis crée une page par produit dans la base Notion "Produits".

## 1. Identifiants requis

Copie `.env.example` en `.env` et remplis les valeurs suivantes.

| Variable | Où la trouver |
|---|---|
| `SHOPIFY_STORE` | Le domaine `xxxx.myshopify.com` de la boutique (visible dans l'URL de l'admin Shopify, ou Réglages → Général). |
| `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET` | Admin Shopify → Réglages → Apps et canaux de vente → Développer des apps → (créer une app) → Configuration API → activer le scope `read_products` → Installer l'app → onglet "Identifiants API" → "Client ID" et "Client secret". Le script échange ces identifiants contre un access token via le client credentials grant (valable 24h, renouvelé automatiquement) — Shopify ne délivre plus de token Admin API statique pour les apps créées via le Dev Dashboard. |
| `BLOB_READ_WRITE_TOKEN` | Dashboard Vercel → ton projet → Storage → Blob → onglet ".env.local" ou "Tokens" (ou `vercel env pull` si le store Blob est déjà lié au projet). |
| `NOTION_TOKEN` | https://www.notion.so/my-integrations → ta intégration interne MOKA OS → "Internal Integration Secret". Si tu n'en as pas, "New integration", puis partage la base "Produits" avec cette intégration (bouton "..." → "Connexions" sur la page de la base). |
| `NOTION_PRODUCTS_DB_ID` | Ouvre la base "Produits" en plein écran dans Notion, copie l'ID dans l'URL : `notion.so/<workspace>/<DB_ID>?v=...` (32 caractères, tirets optionnels). |

## 2. Installation

```bash
cd migration-shopify
npm install
```

## 3. Étapes

```bash
# 1. Récupère les produits actifs de Shopify -> data/products.json
npm run 1:fetch

# 2. Télécharge chaque image et l'upload sur Vercel Blob
npm run 2:images

# 3. Avant de créer quoi que ce soit dans Notion : liste les propriétés
#    exactes de la base "Produits" (noms + types)
npm run 3:inspect

# -> Édite notion-mapping.json avec les noms EXACTS retournés à l'étape 3

# 4. Crée les pages Notion (idempotent : les produits déjà présents,
#    identifiés par titre, sont ignorés)
npm run 4:migrate
```

Ou tout enchaîner (1, 2, 4 — l'étape 3 reste manuelle car son but est
d'ajuster `notion-mapping.json` avant migration) :

```bash
npm run all
```

## 4. Mapping Notion

`notion-mapping.json` associe chaque champ Shopify à une propriété Notion.
Le script lit le type réel de chaque propriété (title, rich_text, number,
select, checkbox, files, url...) et construit la valeur en conséquence — tu
n'as donc besoin de fournir que le **nom exact** de la propriété.

```json
{
  "nom": "Nom",
  "description": "Description",
  "prix": "Prix",
  "variantes": "Variantes",
  "categorie": "Catégorie",
  "photo": "Photo",
  "disponible": "Disponible"
}
```

Mets une valeur à `null` pour ignorer un champ qui n'existe pas dans ta base.

## 5. Rapport final

`npm run all` affiche : produits trouvés, images ré-hébergées, produits
migrés, produits déjà présents (ignorés), produits sans image, et la liste
des erreurs.
