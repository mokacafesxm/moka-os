# Importateur intelligent MÖKA — README

Analyse et importe des relevés bancaires, exports de caisse (AddicTill) et
rapports de performance mensuelle vers les bases Notion de pilotage MÖKA —
via une CLI locale (`npm run importer`) et une interface web (`/imports`).
Voir `docs/ARCHITECTURE.md` pour l'architecture complète et les décisions
techniques ; voir `AGENTS.md` pour le prompt d'origine.

**État actuel : PR1 + PR2A + PR3 + PR4 (+ addendum audit trail) + scan-z
(spec v3).** Détection, extraction, classification, journalisation (PR1),
parsing/validation des relevés bancaires (PR2A) et des exports AddicTill
(PR3), et désormais (PR4) écriture Notion réelle avec confirmation
explicite : Import Runs, déduplication de fichier, upsert idempotent par
clé métier, interface `/imports`, API `/api/imports/*`, `--commit` en CLI,
`npm run importer:schema:check`. Le mode dry-run (aperçu, sans écriture)
reste le comportement par défaut partout. scan-z ajoute une source
secondaire par photo du Z de caisse (OCR), derrière `IMPORTS_SCANZ_ENABLED`
(défaut `false`), jamais prioritaire sur AddicTill/L'Addition — voir
"scan-z — source secondaire par photo" plus bas et
`docs/ARCHITECTURE.md`. **L'importateur ne lit ni n'écrit jamais dans les
bases Notion opérationnelles Kamo AI** (voir `docs/ARCHITECTURE.md`).

**Import Runs est un historique d'audit complet, distinct de la
déduplication métier** (voir `docs/ARCHITECTURE.md` "Audit trail vs.
déduplication métier") : chaque aperçu et chaque tentative de commit — même
bloquée ou en échec — produit son propre enregistrement Notion (statut
`preview`/`committed`/`failed`/`partial_failure`/`retry`, compteur de
tentatives, raison d'échec, version exacte du parseur utilisé) ; seule la
donnée de pilotage elle-même reste gouvernée par les règles de blocage
habituelles, et la déduplication ne se déclenche que sur un run
`committed` déjà enregistré pour ce fichier exact — jamais sur un simple
aperçu ou un échec antérieur.

## Installation

```bash
npm install
cp .env.example .env.local   # puis renseigner les valeurs réelles
```

Dépendances ajoutées par ce module : `zod`, `exceljs`, `pdf-parse`,
`csv-parse` (runtime), `vitest` (dev).

## Variables d'environnement

Voir `.env.example` pour la liste complète et prête à copier. Résumé :

| Variable | Requise | Rôle |
|---|---|---|
| `ANTHROPIC_API_KEY` | Non | Repli Claude Haiku pour les documents ambigus. Sans elle, les documents reconnus par les règles locales sont traités normalement ; les documents ambigus restent sur le résultat déterministe (jamais de classification inventée). |
| `CLASSIFICATION_AUTO_THRESHOLD` / `CLASSIFICATION_REVIEW_THRESHOLD` | Non (défauts `0.90`/`0.75`) | Seuils de confiance de classification. |
| `NOTION_API_KEY` | Oui pour tout accès Notion | Intégration Notion dédiée à l'importateur (distincte de celle de `app/api/_notion.js`). |
| `NOTION_IMPORT_RUNS_DB_ID`, `NOTION_DAILY_OPERATIONS_DB_ID`, `NOTION_PAYMENT_METHODS_DB_ID`, `NOTION_PRODUCT_SALES_DB_ID`, `NOTION_SALES_CATEGORIES_DB_ID` | Oui pour `--commit`/commit UI | ID des 5 bases de pilotage. Peuvent rester vides en développement — `schema:check`/`--commit` échouent alors clairement (`CONFIG_MISSING`), le parsing/aperçu continue de fonctionner. Voir docs/ARCHITECTURE.md "PR4" pour la spécification exacte de création manuelle. |
| `IMPORTS_ESTABLISHMENTS` | Oui pour `--commit`/commit UI | Allowlist `cle:Nom,cle2:Nom2` — jamais déduit du fichier. |
| `IMPORTS_AUTH_USERNAME` / `IMPORTS_AUTH_PASSWORD` | Oui en production | Basic Auth pour `/imports` et `/api/imports/*`. Absentes → 401 systématique (échec fermé), jamais un accès ouvert. |
| `IMPORTS_AUTH_DISABLED` | Non (opt-out dev explicite uniquement) | `true` désactive l'auth. Ne jamais déduire de `NODE_ENV` — ce n'est d'ailleurs pas le cas ici. |
| `IMPORTS_SCANZ_ENABLED` | Non (défaut `false`) | Active la source secondaire scan-z (photo du Z, OCR). Désactivée, `runScanZPreflight`/`runScanZCommit` renvoient `SCANZ_DISABLED` sans le moindre appel Notion/Claude. |
| `IMPORTS_PREFLIGHT_TOKEN_SECRET` | Oui si scan-z activé | Secret HMAC-SHA256 (≥ 32 octets) signant le jeton de préview scan-z. Absent → échec explicite (`CONFIG_MISSING`), jamais silencieux. Générer avec `openssl rand -base64 48`. |

## Utiliser la CLI

```bash
# Analyser tous les fichiers présents dans imports/incoming/ (dry-run, défaut)
npm run importer

# Analyser un seul fichier
npm run importer -- --file imports/incoming/exemple.pdf

# Palmarès produits AddicTill : préciser la période (jamais déduite du fichier)
npm run importer -- --file imports/incoming/palmares.xlsx \
  --period-start 2026-01-01 --period-end 2026-07-16

# Importer réellement vers Notion (PR4) — confirmation requise
npm run importer -- --file imports/incoming/synthese.xlsx \
  --commit --establishment moka-sxm

# Idem, sans prompt interactif (CI / script) — jamais activé par défaut
npm run importer -- --file imports/incoming/synthese.xlsx \
  --commit --establishment moka-sxm --yes

# Vérifier les schémas Notion avant tout import réel (lecture seule)
npm run importer:schema:check
```

Pour chaque fichier, la CLI affiche : type de fichier détecté, type de
document, score de confiance, méthode de classification (`rules` ou
`claude`), source POS détectée le cas échéant (`addictill_export` /
`laddition_export`), et le statut résultant (`auto` / `review_required` /
`rejected` / `duplicate`). Pour un relevé bancaire ou un export AddicTill
reconnu, un aperçu supplémentaire s'affiche (banque/type de rapport, devise,
soldes ou nombre de produits/catégories, résultat de la validation des
totaux, nombre de produits non mappés à une recette le cas échéant) —
lecture seule, sans impact sur le statut ni sur le classement du fichier. Un
journal structuré est écrit dans `imports/logs/YYYY-MM-DD/<import_run_id>.json`.

`--period-start`/`--period-end` (format `YYYY-MM-DD`) ne s'appliquent qu'au
palmarès produits AddicTill — sans eux, la période reste `unknown` (jamais
déduite de "Dernière vente").

`--commit` (PR4) requiert `--establishment <clé>` (jamais déduit) et re-passe
le fichier par l'intégralité de l'analyse (`lib/importer/notion/commit-pipeline.js`
— la même que l'API web, aucune règle dupliquée) avant d'écrire quoi que ce
soit. Sans `--yes`, une confirmation interactive est demandée (`[y/N]`) ; en
l'absence de terminal interactif (script, CI) et sans `--yes`, le fichier est
simplement ignoré — **jamais** importé sans confirmation explicite d'une
forme ou d'une autre. Un commit bloqué (erreurs de validation, établissement
inconnu, schéma Notion incompatible, fichier déjà importé avec succès)
n'écrit rien du tout, pas même l'enregistrement Import Run.

## Interface web `/imports` et API

`/imports` (protégé par Basic Auth) permet de sélectionner un établissement,
choisir un fichier, lancer un aperçu (`/api/imports/preflight`, lecture
seule) puis confirmer l'import (`/api/imports/commit`). Le fichier n'est
**jamais persisté côté serveur** — il reste en mémoire côté navigateur et
est renvoyé à chaque appel. Les mêmes règles de blocage que la CLI
s'appliquent strictement (même pipeline partagé).

`GET /api/imports/establishments` liste l'allowlist configurée (pour le
sélecteur de l'UI) — lecture seule, aucun accès Notion.

## scan-z — source secondaire par photo (spec v3)

Nécessite `IMPORTS_SCANZ_ENABLED=true` et `IMPORTS_PREFLIGHT_TOKEN_SECRET`
renseignés (voir tableau ci-dessus). Détail complet de la conception —
autorité de source, jeton de preview, `audit_metadata`, statut `blocked` —
dans `docs/ARCHITECTURE.md` "scan-z — source secondaire par photo".

```bash
# CLI — toujours interactif (le jeton de preview lie les valeurs OCR ; --yes
# n'est jamais honoré pour scan-z, même si passé)
npm run importer -- --scan-z imports/incoming/z-caisse.jpg --establishment moka-sxm
```

Dans `/imports`, l'onglet "Photo Z (scan-z)" permet d'envoyer une photo
(JPEG/PNG uniquement), de lancer l'analyse OCR (`POST
/api/imports/scan-z/preflight` — appelle Claude vision une seule fois),
de relire/corriger les champs extraits (date, total TTC, HT, nombre de
tickets — HT reste vide par défaut, jamais une valeur inventée), puis de
confirmer (`POST /api/imports/scan-z/commit` — ne rappelle jamais Claude
vision, revalide seulement les contrôles déterministes bon marché). Une
case d'acquittement obligatoire apparaît si la confiance composite de l'OCR
est dégradée. En cas de conflit de précédence avec une ligne AddicTill/
L'Addition déjà posée, l'écart est affiché en lecture seule — **aucun
bouton de forçage n'existe**, à aucun niveau.

## Fixtures et anonymisation

Les fixtures de test (`lib/importer/__tests__/fixtures/`) sont **100 %
synthétiques** — noms d'établissement inventés, montants à zéro, aucune
donnée bancaire ou de caisse réelle. Les PDF/XLSX binaires sont produits par
`lib/importer/__tests__/fixtures/generate-fixtures.js` (à relancer
manuellement si un fixture doit changer ; rien ne l'importe au moment des
tests).

**Aucun fichier bancaire ou de caisse réel n'est ni ne sera jamais committé
dans ce dépôt.** Les fichiers réels nécessaires pour développer et valider
PR2A/PR2B (relevés bancaires Crédit Mutuel) et une future PR L'Addition
seront fournis séparément, hors du dépôt git.

**Relevés bancaires** : déposer les vrais PDF (ou des versions anonymisées,
voir méthode ci-dessous) dans
`lib/importer/__tests__/fixtures/bank/real/` — ce dossier est gitignored
(sauf `.gitkeep`) et scanné automatiquement par
`bank-statement.real-fixtures.test.js`, qui exercera chaque fichier déposé
sans qu'aucune modification de code ne soit nécessaire. Le profil
`credit_mutuel` est désormais **calibré** sur 3 relevés EUR réels (voir
`docs/ARCHITECTURE.md` "PR2A") ; il reste deux angles non vérifiés faute
d'exemple : le compte USD et un relevé en découvert (`SOLDE DEBITEUR`). Si
un fichier de ce type est déposé et ne valide pas, comparer ses expressions
régulières (`BANK_PROFILES.credit_mutuel.fields` / `transactionLinePattern`)
au texte réel extrait — c'est le point d'ajustement attendu, pas un bug du
moteur générique.

**Exports AddicTill** : mêmes garanties dans
`lib/importer/__tests__/fixtures/pos/real/` (gitignored, sauf `.gitkeep`),
scanné par `pos-addictill.real-fixtures.test.js`. Le profil AddicTill est
**calibré** sur 2 exports "Synthèse quotidienne" et 1 export "Palmarès
produits" réels (voir `docs/ARCHITECTURE.md` "PR3") ; non vérifié : le
format L'Addition (aucun fichier réel disponible — traité comme une source
distincte, jamais un parseur AddicTill réutilisé pour lui sans preuve de
compatibilité de schéma, voir `AGENTS.md`).

Emplacement attendu pour les autres types de fichiers réels (performance
mensuelle) pendant le développement local : `imports/incoming/` (ignoré
par git — voir `.gitignore`). Avant de partager un export réel pour du
débogage ou une issue, anonymiser :

- remplacer les noms de clients, IBAN, numéros de carte et références de
  virement par des valeurs factices de même format ;
- remplacer les montants réels par des montants arbitraires en conservant
  les totaux cohérents (solde initial + crédits − débits = solde final) si
  le fichier doit servir à tester la validation des totaux ;
- conserver la structure exacte (en-têtes de colonnes, noms de feuilles,
  nombre de colonnes) — c'est ce qui a de la valeur pour écrire un parseur,
  pas les montants eux-mêmes.

## Ajouter une nouvelle banque au parseur bancaire

`lib/importer/parsers/bank-statement.js` utilise un registre `BANK_PROFILES`
(même principe que la distinction AddicTill/L'Addition en classification) :
chaque banque a son propre profil (signature, regex de champs d'en-tête,
motif de ligne de transaction). Pour ajouter une banque :

1. Inspecter le texte réel extrait par `pdf-parse` pour un relevé de cette
   banque (pas juste le PDF visuellement — le texte à plat, sans colonnes).
2. Ajouter une entrée dans `BANK_PROFILES` avec sa propre `signaturePattern`,
   ses `fields` (regex par champ d'en-tête) et son `transactionLinePattern`
   (4 groupes : date opération, date valeur, libellé, montant — sans signe).
   Le moteur résout aujourd'hui **uniquement** le cas deux-colonnes non
   signées (Débit/Crédit séparées, via `getTable()` —
   `buildColumnQueues`/`resolveDebitCreditAssignment`, voir
   `docs/ARCHITECTURE.md` "PR2A" pour le détail et ses limites). Une banque
   dont le format utilise une colonne de montant unique signée (`+`/`-`)
   nécessiterait une petite extension ciblée du moteur (un 5ème groupe de
   capture optionnel pour le signe, court-circuitant la résolution par
   tableau) — pas encore implémentée, pas nécessaire tant qu'aucune banque
   de ce type n'est dans le registre.
3. Ne jamais toucher au moteur générique (`parseBankStatementFromText`,
   `validateBankStatement`, l'accumulation des lignes de continuation) pour
   accommoder une banque spécifique — si le moteur ne suffit pas, c'est un
   signal qu'il faut l'étendre proprement pour toutes les banques, pas le
   contourner pour une seule.

## Ajouter une correspondance produit (Product Mapping)

`lib/importer/config/product-mapping.json` (committé, vide par défaut) fait
le lien entre un nom de produit AddicTill et une clé produit MÖKA :

```json
{
  "mappings": [
    { "addictill_product_key": "ICED COFFEE LATTE", "moka_product_key": "iced-coffee-latte" }
  ]
}
```

Correspondance **exacte uniquement** (casse et espaces normalisés,
`lib/importer/parsers/recipe-mapping.js::normalizeProductKey`) — jamais
floue. Un produit sans entrée est marqué `unmapped` et listé dans
`unmapped_products`, jamais deviné. Ce fichier ne contient **que** la
correspondance identité (clé AddicTill → clé MÖKA) — ni ingrédients, ni
quantités, ni logique de stock : voir `docs/ARCHITECTURE.md` "PR3"
"Séparation des préoccupations" pour pourquoi ces trois couches (Product
Mapping / Recipes / Recipe Lines) restent strictement séparées, et pourquoi
seule la première existe pour l'instant.

## Ajouter un nouveau parseur de type de document

1. Inspecter le format réel du fichier (colonnes, feuilles, agrégations)
   avant d'écrire quoi que ce soit — ne jamais supposer qu'un format est
   compatible avec un autre (voir la règle AddicTill/L'Addition dans
   `AGENTS.md` et `docs/ARCHITECTURE.md`).
2. Créer `lib/importer/parsers/<nom>.js`, consommant un `ExtractionResult`
   (voir `lib/importer/schemas.js`) et produisant un modèle normalisé propre
   au type de document.
3. Ajouter les validations métier spécifiques dans le parseur (totaux,
   soldes) — `lib/importer/validate.js` ne fournit que les briques
   génériques (montants, dates, équation de solde), pas les règles métier.
4. Brancher le routage dans `classify.js`/`scripts/import.js` uniquement une
   fois le parseur validé par des tests avec fixtures anonymisées réelles.

## Tests

```bash
npm test          # vitest run (une passe)
npm run test:watch
```

**Aucun test n'appelle jamais la vraie API Notion** — la couche Notion (PR4)
est entièrement testée via `lib/importer/__tests__/helpers/mock-notion-fetch.js`,
une fausse API Notion en mémoire (mêmes formes de requête/réponse que la
vraie, jamais un `fetch` réseau réel). Voir
`lib/importer/__tests__/notion/*.test.js` pour : schéma compatible/
incompatible (propriétés manquantes, type incompatible, propriétés en plus
non bloquantes, `CONFIG_MISSING`/`NOT_FOUND`/`NOT_SHARED_WITH_INTEGRATION`),
création/mise à jour/ignoré (upsert idempotent), échec partiel jamais
rapporté comme un succès silencieux, blocage sur erreur de validation,
fichier déjà importé bloqué, export corrigé du même jour mis à jour et non
dupliqué, palmarès produits invalide bloqué par défaut, synthèse quotidienne
avec avertissements non bloquants acceptée, retry sur 429 (jamais sur 5xx),
et conformité à l'API classique `2022-06-28`/endpoints `database_id`. La
suite couvre aussi l'addendum audit trail : un enregistrement `preview` est
écrit à chaque aperçu, un seul enregistrement (jamais deux) par tentative de
commit, `attempt_number`/`retry_of_import_run_id` incrémentés/liés
correctement sur des tentatives répétées du même fichier, `status: 'retry'`
comme statut provisoire, et `parser_version` vérifié comme réellement
persisté (`bank-v1.0.0`/`addictill-v1.0.0` selon le document, jamais vide).
`lib/auth/__tests__/imports-basic-auth.test.js` et
`__tests__/middleware.imports-auth.test.js` couvrent l'authentification :
accès page/API non autorisé bloqué, identifiants valides acceptés,
configuration de production manquante en échec sûr (401).

159 tests couvrent aujourd'hui : détection (types valides, extension
inconnue, incohérence extension/signature), extraction (PDF/XLSX/CSV virgule
et point-virgule, contenu accentué), classification (reconnaissance
déterministe sans appel Claude, non-invention sur absence de signal,
distinction AddicTill/L'Addition, ambiguïté avec Claude simulé — réponse
valide, invalide, indisponible), validations génériques (montants EUR/USD,
dates ISO/DD-MM/MM-DD avec détection d'ambiguïté, équation de solde), le
registre de hash (déduplication par contenu, tolérance à un fichier
absent/corrompu), le parseur bancaire (soldes initiaux nuls, montants
français à groupement de milliers, libellés multi-lignes y compris à
travers un saut de page, pagination, débit/crédit en colonnes séparées
résolues via `getTable()`, ambiguïté de montant dupliqué jamais devinée,
échec volontaire sur solde/devise/total incohérents ou absents — jamais
silencieux), et le parseur AddicTill (en-têtes dynamiques mappés par texte
quel que soit l'ordre des colonnes, régression sur le bug de
forward-fill row1/row2, somme dynamique de N modes de vente, encaissements/
vendeurs jamais bloquants, total incohérent et ligne de total absente sur
les deux exports, période jamais déduite de "Dernière vente", mapping
produit exact — jamais flou). Deux suites dynamiques
(`bank-statement.real-fixtures.test.js`, `pos-addictill.real-fixtures.test.js`)
scannent `fixtures/bank/real/` et `fixtures/pos/real/` (fichiers réels
actuellement présents en local, jamais committés) et vérifient chaque
fichier trouvé sans coder en dur la moindre valeur financière réelle — elles
sautent proprement si ces dossiers sont vides (voir "Fixtures et
anonymisation").

## Gestion des erreurs

Toute étape du pipeline qui échoue (type non supporté, erreur d'extraction,
erreur de classification) produit un statut `rejected` pour ce fichier sans
tenter les étapes suivantes — voir "Garde-fous" dans
`docs/ARCHITECTURE.md`. Les parseurs bancaire (PR2A) et AddicTill (PR3)
suivent la même logique côté validation : un solde/devise/période manquant,
un total incohérent (y compris une transaction au débit/crédit ou un
produit sans mapping recette — jamais deviné), produisent toujours une
erreur ou un avertissement explicite (`VALIDATION_ERROR`/`TOTAL_MISMATCH`)
dans l'aperçu, jamais une correction silencieuse. Ces statuts et erreurs
restent visibles uniquement dans la sortie CLI et le journal de run ; les
rapports de rejet individuels (`nom-original.rejection.json`) et le
déplacement physique des fichiers commencent avec PR2B/PR3B.
