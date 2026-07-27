# Architecture — Importateur intelligent MÖKA

Ce document décrit l'architecture de `lib/importer` / `scripts/import.js` et
doit être respecté pour toute évolution future du module. Il complète (sans
le dupliquer) le prompt d'origine conservé dans `AGENTS.md`.

## Périmètre du dépôt (rappel)

- **Bases opérationnelles "Kamo AI"** (`app/api/_notion.js` : `STAFF`,
  `POINTAGES`, `INGREDIENTS`, `STOCK`, `PREPS`, `BESOINS`, `FOURNISSEURS`,
  `WEBSITE_PRODUCTS`, `CATEGORIES_WEBSITE`, `PROMOS`, `COMMANDES_CLIENTS`,
  `ROUE_CHANCE`, `CLIENTS`, `SPINS_ANONYMES`, `CARTES_ENREGISTREES`) —
  utilisées par l'app Next.js (OrderPad, commander, etc.). **L'importateur
  ne les touche jamais.**
- **Bases de pilotage MÖKA** (cible de l'importateur) : la liste ci-dessous
  était spéculative en PR1 (Établissements, Performance mensuelle,
  Fournisseurs, Prévision actions et dépenses, Investissements et projets,
  Produits/catégories de vente, Decision Board). **PR4 l'a remplacée** par 5
  bases concrètes réellement implémentées — voir "PR4 — Intégration Notion
  et interface MÖKA OS" plus bas pour la liste exacte, le schéma et la
  spécification de création manuelle. Établissements n'est **pas** une base
  Notion en PR4 (allowlist par variable d'environnement, voir cette même
  section) ; Performance mensuelle/Fournisseurs/Investissements/Decision
  Board restent hors périmètre (PR5+).

## Périmètre strict de l'importateur V1

CLI local uniquement. Pas de dossier watché, pas de déploiement Vercel, pas
de route Next.js. Types de documents V1 : relevé bancaire, export caisse
(AddicTill et L'Addition, traités comme deux sources distinctes), rapport de
performance mensuelle. Rien d'autre sans validation explicite.

## Pipeline

```
detect → [registry lookup] → extract → classify → parse+validate → dedupe → notion-router
  (PR1)      (PR1, lecture)   (PR1)      (PR1)   (bank ✅ PR2A, AddicTill ✅ PR3)  (PR4)   (PR4)
```

Chaque étape échoue de façon isolée : un fichier qui échoue à une étape ne
progresse jamais aux suivantes (voir "Garde-fous" ci-dessous).

### Modules (`lib/importer/`)

| Fichier | Rôle | PR |
|---|---|---|
| `schemas.js` | Schémas Zod partagés (détection, extraction, classification, rejet) + JSDoc typedefs | 1 |
| `detect.js` | Détection extension + signature magique (PDF/XLSX/CSV), rejette les incohérences | 1 |
| `extract.js` | Extraction brute normalisée (pdf-parse, exceljs, csv-parse) — aucun parsing métier | 1 |
| `classify.js` | Règles déterministes + repli Claude Haiku, seuils de confiance | 1 |
| `validate.js` | Validations génériques réutilisables (montants, dates) — pas de règles métier | 1 |
| `logger.js` | `import_run_id`, journal structuré par run | 1 |
| `registry.js` | Hash SHA-256, lecture/écriture `import-registry.json` (écriture non appelée avant PR4) | 1 (lecture), 4 (écriture) |
| `dedupe.js` | Déduplication métier par `import_key` (requête Notion) | 4 |
| `notion-client.js` / `notion-router.js` | CRUD Notion, upsert, vérification de schéma | 4 |
| `parsers/bank-statement.js` | Parsing relevé bancaire (registre de profils par banque) + validation solde | 2A ✅ |
| `parsers/pos-addictill.js` | Parsing synthèse quotidienne + palmarès produits AddicTill, en-têtes dynamiques | 3 ✅ |
| `parsers/recipe-mapping.js` | Product Mapping exact (clé AddicTill → clé MÖKA), local, jamais flou | 3 ✅ |
| `parsers/pos-laddition.js`, `parsers/monthly-performance.js` | Parsing L'Addition / performance mensuelle | PR séparée |

`parsers/pos-laddition.js` et `parsers/monthly-performance.js` n'existent pas
encore — hors périmètre PR3 (pas de fichier L'Addition réel disponible).

## Décisions techniques prises en PR1

1. **JavaScript, pas TypeScript.** Le dépôt est en JS pur malgré la présence
   de `tsconfig.json`/`jsconfig.json` (scaffolding inerte hérité de
   `create-next-app`). Zod fournit la validation runtime ; JSDoc documente
   les structures. CommonJS (`require`/`module.exports`) partout dans
   `lib/importer` et `scripts/`, cohérent avec l'absence de `"type"` dans
   `package.json` (donc CommonJS par défaut pour tout script exécuté par
   `node`). Seuls les fichiers `*.test.js` utilisent `import`/`export` ESM,
   parce que Vitest refuse explicitement d'être chargé via `require()` — Vite
   gère l'interop CJS→ESM pour importer nos modules `lib/importer/*.js`
   depuis ces fichiers de test sans problème.
2. **exceljs, pas xlsx.** `xlsx@0.18.5` (dernière version publiée sur le
   registre npm public) a deux failles non corrigées sur ce registre :
   prototype pollution ([GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6))
   et ReDoS ([GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9)),
   toutes deux exactement dans le chemin d'attaque visé ici (parsing de
   fichiers XLSX non fiables venant de tiers). SheetJS ne publie plus les
   versions corrigées que sur son propre CDN, hors registre npm. Décision
   utilisateur : `exceljs` à la place — pas de faille connue sur le chemin de
   lecture utilisé ici. `exceljs` tire `uuid@8.3.2` (faille modérée sur les
   bounds-checks de `uuid.v3/v5/v6`) en dépendance transitive, mais ce chemin
   de code n'est jamais atteint pour une lecture de fichier — accepté.
3. **Pas de librairie décimale.** Les montants sont parsés en **centimes
   entiers** (`lib/importer/validate.js::parseAmount`) plutôt qu'en
   flottants, pour la fiabilité numérique exigée par AGENTS.md, sans ajouter
   de dépendance (`decimal.js` n'était pas dans la liste validée).
   `node:crypto` (`randomUUID`, `createHash`) remplace `uuid` pour la même
   raison.
4. **Format du registre fixé dès PR1** : `{ "schema_version": "1.0", "files":
   [] }`. `readRegistry()` tolère un fichier absent ou corrompu (retourne un
   registre vide plutôt que de lever une exception). `writeRegistry()` /
   `upsertEntry()` existent et sont testés dès PR1, mais **aucun appelant
   n'écrit encore dans le registre** — la logique complète de déduplication
   (écriture d'entrées, déplacement vers `imports/duplicates/`) arrive avec
   les parseurs et l'intégration Notion (PR2–PR4).
5. **Aucun déplacement de fichier en PR1.** Tous les fichiers restent dans
   `imports/incoming/` quel que soit leur statut (`auto` / `review_required`
   / `rejected` / `duplicate`) — le déplacement physique et l'écriture des
   rapports `nom-original.rejection.json` individuels commencent en PR2/PR3,
   une fois qu'un parseur métier et une validation de totaux existent
   réellement pour justifier une décision de classement définitive. En PR1,
   seul le **journal de run agrégé** (`imports/logs/YYYY-MM-DD/<run-id>.json`)
   est écrit.
6. **Classification : déterministe en priorité.** Voir table de règles et
   pondérations documentée dans `lib/importer/classify.js` (`RULES`). Claude
   Haiku (`claude-haiku-4-5-20251001`, même modèle que
   `app/api/reports/chat/route.js`) n'est appelé que si **au moins deux**
   types de document restent plausibles après les règles locales — jamais
   pour confirmer un signal unique faible, jamais si un type dépasse déjà
   `CLASSIFICATION_AUTO_THRESHOLD` seul. L'absence de `ANTHROPIC_API_KEY` ne
   bloque jamais un document reconnu par les règles ; un document ambigu
   sans clé (ou avec une réponse Claude invalide/JSON malformé) reste sur le
   résultat déterministe, jamais une classification inventée.
7. **Distinction AddicTill / L'Addition dès la classification.** Un champ
   `pos_source_hint` (`addictill_export` | `laddition_export` | `unknown`)
   est dérivé d'un **hard match** sur le nom de marque, jamais d'une
   supposition de Claude — cohérent avec l'exigence de ne jamais réutiliser
   un parseur AddicTill pour un fichier L'Addition sans preuve de
   compatibilité de schéma. Aucun des deux formats réels n'a encore été vu
   (voir README_IMPORTER.md) ; ce champ reste donc non exploité par un
   parseur tant que PR3 n'a pas inspecté de vrais exports.

## PR2A — Parseur bancaire

Périmètre livré : `lib/importer/parsers/bank-statement.js` (parsing +
validation), extension de `schemas.js`/`validate.js`/`extract.js`, aperçu
dry-run dans `scripts/import.js`. **Aucune écriture registre, aucun
déplacement de fichier, aucun upsert Notion** — ces trois restent pour une
étape ultérieure (PR2B ou repris avec PR4), conformément au périmètre exact
demandé pour PR2A.

### Le profil `credit_mutuel` est calibré, pas un placeholder

Une première version a été écrite sans fichier réel (les 4 relevés
initialement demandés étaient introuvables) et supposait un format à colonne
de montant unique signée. **3 vrais relevés Crédit Mutuel VGEB & CO ont
ensuite été fournis** (EUR, compte `00021911203` : novembre 2025, janvier
2026, mars 2026 — 397 transactions au total) et le format réel s'est avéré
différent sur plusieurs points structurants ; le profil ci-dessous a été
entièrement reconstruit contre ces 3 fichiers, copiés localement (jamais
committés) dans `lib/importer/__tests__/fixtures/bank/real/`. Deux angles
restent non vérifiés faute d'exemple : un relevé **en découvert** (`SOLDE
DEBITEUR`) et le **compte USD** (`CPTE COURANT PROFESSIONNEL USD`).

### Ce que le vrai format a révélé (vs. l'hypothèse initiale)

- **Date d'émission en toutes lettres** ("28 novembre 2025"), pas de ligne
  "PERIODE DU X AU Y" explicite — `period_start`/`period_end` sont dérivés
  des dates accolées aux soldes d'ouverture/clôture, pas d'un champ dédié.
- **"SOLDE CREDITEUR AU <date>"** sert à la fois pour l'ouverture et la
  clôture (aucun libellé "NOUVEAU SOLDE" distinct) — résolu en prenant la
  première occurrence du texte comme ouverture et la dernière comme
  clôture (`Array.from(text.matchAll(...))`). `SOLDE DEBITEUR AU` bascule le
  montant en négatif — logique non vérifiée sur un vrai relevé en découvert.
- **Montants à séparateur de milliers "."** et décimale "," (ex.
  `20.000,00`), pas d'espace comme hypothèse initiale — `parseAmount` gérait
  déjà ce cas, aucun changement nécessaire.
- **Une ligne "Total des mouvements"** imprime les totaux débit/crédit de la
  période — exploitée comme un second contrôle indépendant de l'équation de
  solde (`printed_total_debits_cents`/`printed_total_credits_cents` sur
  `BankStatement`), exactement ce que demande la règle "recalculer les
  totaux et les comparer aux totaux affichés".
- **Références SEPA réelles = `RUM :`/`ICS :`**, pas "Réf. donneur d'ordre"
  (qui vient en fait de Caisse d'Épargne, vue pendant la recherche des
  fichiers) — `REFERENCE_PATTERNS` réordonné en conséquence.
- **Montants débit/crédit en colonnes séparées, jamais signés** — voir
  section dédiée ci-dessous, c'est le point le plus significatif.

### Débit/crédit non signé : pourquoi `getTable()` est nécessaire, et ses limites

`pdf-parse` (`extract.js`, méthode `getText()`) ne restitue que du texte à
plat par page, sans coordonnées de colonne — une case de tableau vide ne
laisse aucune trace dans le flux de texte. Le vrai relevé Crédit Mutuel a
deux colonnes **non signées** ("Débit EUROS" / "Crédit EUROS"), confirmé sur
les 3 fichiers réels : un nombre isolé en fin de ligne ne permet pas de
savoir dans quelle colonne il apparaît (ex. "VIR SEPA ..." sert aussi bien
pour un débit sortant que pour un crédit entrant — aucun mot-clé du libellé
ne distingue les deux de façon fiable).

**Solution retenue** : `extract.js::extractPdf` appelle aussi
`pdf-parse`'s `getTable()` (extraction positionnelle basée sur les lignes
réellement tracées dans le PDF), stockée dans `ExtractionResult.tables`
(une entrée par page). `buildColumnQueues()` en extrait, par page, la liste
ordonnée des montants Débit et Crédit. Pour chaque transaction trouvée dans
le texte à plat, `resolveDebitCreditAssignment()` cherche laquelle des deux
files (debit/crédit) produit un montant identique au prochain élément non
consommé.

**Limite découverte, réelle et documentée plutôt que masquée** : le PDF
Crédit Mutuel n'a pas de ligne de séparation entre transactions individuelles
(seulement les bordures de colonnes) — `getTable()` fusionne donc toutes les
transactions d'une page en une seule "méga-ligne" par colonne, sans
correspondance ligne-à-ligne fiable entre dates/libellés/montants au sein
d'une même page. Conséquence directe : **si deux transactions de la même
page partagent exactement le même montant dans des colonnes différentes**
(ex. deux virements de 3.000,00 €, l'un sortant l'un entrant), rien dans les
données ne permet de distinguer laquelle est laquelle — échanger les deux
ne change ni le total débit ni le total crédit, donc aucune vérification de
solde ne peut détecter l'erreur. `resolveDebitCreditAssignment()` résout
l'affectation deux fois (préférence débit, puis préférence crédit à chaque
ambiguïté) et **ne garde que les positions où les deux résolutions sont
d'accord** ; les transactions génuinement ambiguës sont exclues (jamais
devinées), avec un avertissement explicite, et l'écart qui en résulte sur
les totaux fait échouer la validation (`TOTAL_MISMATCH`) — comportement
volontairement conservateur pour des données financières.

Fréquence réelle observée : **2 transactions ambiguës sur 397** (0,5 %,
toutes deux dans le même relevé) — le reste (99,5 %) est résolu et validé
sans avertissement, y compris deux relevés entiers de 137 et 219
transactions à zéro erreur/avertissement.

**Piste pour lever cette limite** (non implémentée, hors scope PR2A) :
descendre au niveau des coordonnées de texte positionnées (`pdfjs-dist`,
dépendance transitive de `pdf-parse`, non exposée directement aujourd'hui)
pour reconstruire l'alignement ligne par ligne via la proximité verticale
réelle des éléments de texte plutôt que via le seul contenu des cellules
`getTable()`. Non fait ici : ajouterait `pdfjs-dist` comme dépendance directe
non validée, pour un gain qui ne concerne que 0,5 % des transactions
observées.

#### Roadmap — repli positionnel automatique sur ambiguïté (validé, pas encore implémenté)

Amélioration actée pour une prochaine itération de PR2/PR2B, à ne pas
oublier :

- Le moteur actuel (`getTable()` + résolution par file ordonnée) reste le
  chemin rapide par défaut pour tous les fichiers.
- **Seulement** quand `resolveDebitCreditAssignment` détecte une ambiguïté
  (positions où préférence-débit et préférence-crédit divergent), basculer
  automatiquement vers une extraction positionnelle (coordonnées x/y réelles
  du texte, via `pdfjs-dist` ou une bibliothèque équivalente) pour les
  transactions concernées uniquement — pas tout le document.
- Si le repli positionnel lève lui aussi l'ambiguïté (ou si la position
  n'est pas exploitable), produire une erreur de validation explicite
  (`VALIDATION_ERROR`/`TOTAL_MISMATCH`) plutôt que de deviner — le principe
  "jamais d'invention" reste inchangé, seul le nombre de cas résolus
  automatiquement doit augmenter.
- Implique de choisir et valider `pdfjs-dist` (ou équivalent) comme
  dépendance directe — actuellement seulement transitive via `pdf-parse` —
  avant de commencer.

### Architecture du moteur

```
lib/importer/parsers/bank-statement.js
  BANK_PROFILES = { credit_mutuel: { signaturePattern, fields, transactionLinePattern, boilerplatePatterns } }
  detectBankProfile(text)                     → id de profil reconnu, ou null (jamais deviné)
  buildColumnQueues(tables)                    → { debits: number[], credits: number[] } par page
  resolveDebitCreditAssignment(amounts, d, c)  → assignation par transaction, avec ambiguïtés explicites
  parseBankStatementFromText({text,pages,tables}) → { statement, validation }
  parseBankStatement(extractionResult)         → idem, à partir d'un ExtractionResult
  validateBankStatement(statement)             → { valid, errors, warnings }
  normalizeLabel / extractReference / buildTransactionImportKey
```

Le registre `BANK_PROFILES` reprend le principe déjà utilisé pour distinguer
AddicTill de L'Addition en PR1 (classify.js) : chaque banque a son propre
profil (signature, regex de champs d'en-tête, motif de ligne de transaction,
lignes de boilerplate à ignorer), le moteur générique ne change jamais —
**ajouter une banque = ajouter une entrée au registre**. Le moteur suppose
pour l'instant un montant unique non signé résolu via colonnes de tableau
(`credit_mutuel`) ; une banque future dont le format utilise une colonne
signée unique (comme Caisse d'Épargne, vue pendant la recherche de
fichiers) nécessiterait une petite extension ciblée, pas une réécriture.

### `pages` et `tables` dans `ExtractionResult`

`extract.js::extractPdf` peuple `pages: string[]` (texte par page) et
`tables: Array<Array<Array<string[]>>>` (sortie brute `getTable()` par
page) en plus de `text`. Tous deux nécessaires au parseur bancaire ; `null`
pour xlsx/csv.

### `import_key`

`sha256(compte|date|montant_cents|devise|libellé_normalisé|référence)` — voir
`buildTransactionImportKey`. Le calcul existe et est testé dès PR2A ; son
utilisation réelle pour la déduplication Notion (query par `import_key`)
reste pour PR4, comme `dedupe.js`.

### Totaux affichés vs. recalculés

`BankStatement.printed_total_debits_cents`/`printed_total_credits_cents`
portent les valeurs de la ligne "Total des mouvements" (`null` si le profil
n'a pas cette ligne). `validateBankStatement` compare ces deux totaux
imprimés aux sommes recalculées à partir de `transactions`, en plus de
l'équation de solde classique (ouverture + crédits − débits = clôture) — les
deux contrôles sont indépendants et doivent passer tous les deux.

### Fixtures et vrais fichiers

- `lib/importer/__tests__/fixtures/bank/real/` — gitignored (sauf
  `.gitkeep`) ; contient localement les 3 relevés réels ayant servi à
  calibrer le profil (jamais committés). `bank-statement.real-fixtures.test.js`
  scanne ce dossier automatiquement et vérifie, pour chaque fichier trouvé :
  banque/devise/compte/soldes détectés, au moins une transaction, et — si la
  validation échoue — que l'échec est bien la seule cause connue et
  acceptée (ambiguïté de montant dupliqué, jamais une erreur structurelle).
  Aucune valeur financière réelle n'est codée en dur dans ce test (seulement
  des propriétés structurelles) pour ne jamais faire fuiter de données
  réelles dans l'historique git.
- Il n'y a plus de PDF synthétiques Crédit Mutuel dans `fixtures/bank/` : le
  format réel dépend de `getTable()` (structure de tableau réelle dans le
  PDF), que le générateur de PDF texte fait main ne peut pas produire de
  façon crédible. Les tests unitaires (`bank-statement.test.js`) construisent
  directement des objets `{ text, pages, tables }` à la main pour couvrir
  chaque cas (solde nul, montants FR, libellés multi-lignes, pagination,
  total incohérent, devise/solde absents, ambiguïté débit/crédit).

### Observation classify.js (PR1, non modifiée dans PR2A)

Les relevés Crédit Mutuel réels n'atteignent qu'une confiance de ~0.50-0.65
dans `classify.js` (signaux `iban_keyword`/`bic_keyword`/`virement_keyword`
partiels — les formulations réelles ne correspondent pas exactement aux
mots-clés `RULES.bank_statement` de PR1, écrits avant d'avoir vu ce format).
`classify.js` n'a pas été modifié ici (hors périmètre PR2A) ; l'aperçu
bancaire s'affiche néanmoins dans la CLI quel que soit le statut de
classification. À revisiter lors d'un futur ajustement de `classify.js`.

## PR3 — Importateur AddicTill (Synthèse quotidienne + Palmarès produits)

Périmètre livré : `lib/importer/parsers/pos-addictill.js` (les deux
sous-types AddicTill), `lib/importer/parsers/recipe-mapping.js` (Product
Mapping exact uniquement), extension de `classify.js`/`schemas.js`, aperçu
dry-run dans `scripts/import.js`. **Aucune écriture Notion, aucun accès aux
bases Kamo AI (INGREDIENTS/STOCK/PREPS/CATEGORIES_WEBSITE/WEBSITE_PRODUCTS/
etc.), aucun décrément de stock, aucune création des bases de pilotage** —
décision explicite prise avant l'implémentation, voir "Séparation des
préoccupations" ci-dessous.

### Ce que les vrais fichiers ont révélé

Deux formats AddicTill inspectés (2 exports "Synthèse quotidienne", 1 export
"Palmarès produits") :

- **Synthèse quotidienne** : contrairement à l'hypothèse initiale ("un
  fichier = un jour"), le fichier couvre **toute une période** — une ligne
  par jour, plus une ligne de total final (colonne Date vide). L'en-tête
  s'étend sur 2 lignes : la ligne 1 ne porte les libellés de section
  ("Modes de ventes", "Encaissements", "Taxes", "Vendeurs") que sur la
  première colonne de chaque groupe fusionné (le reste est vide) ; la
  ligne 2 porte déjà le nom de colonne complet ("A EMPORTER / Total TTC").
  **L'ordre des colonnes "Encaissements" diffère entre les deux fichiers
  réels** (ESPECES avant CARTE BANCAIRE dans l'un, l'inverse dans l'autre)
  — confirmé, pas une hypothèse : chaque colonne est donc mappée par texte
  d'en-tête, jamais par position. Le nombre de colonnes "Taxes"/"Vendeurs"
  varie aussi (dépend des taux de TVA et du personnel actif ce mois-là).
- **Palmarès produits** : deux feuilles, "Produits" (plate, source
  primaire) et "Rubriques" (groupée par catégorie avec sous-totaux,
  utilisée uniquement pour recouper). **Le fichier n'encode jamais sa
  propre période** — seule une date de "Dernière vente" par produit existe,
  étalée sur plusieurs mois — la période n'est donc jamais déduite, voir
  "Gestion de la période" ci-dessous.
- **Constat classify.js** : aucun des deux fichiers réels ne contient le
  mot "addictill" — la détection par marque seule ne les aurait jamais
  reconnus. `RULES.pos_export` a été complété avec les phrases d'en-tête
  réelles et spécifiques ("Synthese quotidienne", "Encaissements", "Modes
  de ventes", "Codes barre", "Dernière vente", "Quantité décimale"),
  taguées `posSource: addictill_export` — les deux fichiers atteignent
  désormais une confiance de 1.00 sans appel Claude.

### Bug de conception trouvé et corrigé en cours de route

Le premier jet de `forwardFillSections` (report des libellés de section de
la ligne 1 sur les colonnes qu'ils couvrent visuellement) itérait sur la
longueur de la ligne 1 elle-même. Or ExcelJS tronque une ligne à sa dernière
cellule non vide, et le dernier libellé de section ("Vendeurs") ne coïncide
presque jamais avec la dernière colonne réelle (ligne 2) — la ligne 1 est
donc systématiquement *plus courte* que la ligne 2. Les colonnes finales
tombaient alors en section `undefined` (pas `null`), étaient prises pour des
colonnes de premier niveau, et **écrasaient silencieusement** `ticket_count`
et `total_ttc_cents` avec des valeurs d'une colonne "Vendeurs" sans rapport
(souvent 0, faute de ventes attribuées ce jour-là à ce vendeur). Corrigé en
forçant l'itération sur la longueur de la ligne 2 (autorité réelle sur le
nombre de colonnes). Un test de régression explicite existe pour ce cas
précis dans `pos-addictill.test.js`.

### Seuils de validation vérifiés empiriquement, pas supposés

Avant de coder les règles de validation, chaque hypothèse a été vérifiée
contre les 2 vrais fichiers "Synthèse quotidienne" (47 jours au total) :

| Contrôle | Résultat mesuré | Statut |
|---|---|---|
| Somme des modes de vente = Total TTC | 0 écart / 47 jours | Erreur bloquante |
| Total HT + somme des taxes = Total TTC | 0 écart / 47 jours | Erreur bloquante |
| Somme des jours = ligne de total | 0 écart / 2 fichiers | Erreur bloquante |
| Somme des encaissements = Total TTC | 15 écarts / 28 jours (un fichier) | **Avertissement seulement** |
| Somme des vendeurs = Total TTC | 6 écarts / 28 jours (un fichier) | **Avertissement seulement** |

Les écarts "encaissements"/"vendeurs" ne sont pas expliqués (probablement une
sémantique de rapprochement TROP PERÇU/CB MANUEL non documentée, ou une
attribution partielle des ventes par vendeur) — plutôt que d'inventer une
tolérance ou une explication, ces deux contrôles restent strictement
informatifs (avertissement), jamais bloquants. Documenté ici pour que
quiconque ajuste ces seuils plus tard comprenne pourquoi ils diffèrent des
trois autres.

### Constat réel sur le palmarès produits — incohérence confirmée, pas un bug

Sur le fichier réel testé, la somme des lignes "Produits" ne correspond pas
au "Total général" imprimé (43 214 unités recalculées contre 33 756
affichées), et plusieurs sous-totaux de catégorie dans "Rubriques" ne
correspondent pas non plus à la somme des produits qui leur sont rattachés.
Vérifié : ce n'est **ni un bug du parseur ni des doublons** (seulement 3
lignes de nom dupliqué, négligeable face à l'écart) — recalcul confirmé
identique via ExcelJS brut, sans passer par notre code. C'est une
incohérence réelle du fichier source (raison non déterminée — peut-être un
export généré pendant que les totaux et le détail évoluaient encore, ou une
règle d'agrégation AddicTill différente pour certaines catégories). Le
parseur la signale honnêtement (`TOTAL_MISMATCH`) plutôt que de la masquer —
c'est exactement le comportement voulu : ce genre de fichier doit être
examiné par une personne avant tout import réel, pas absorbé silencieusement.

### Gestion de la période (Palmarès produits)

Jamais déduite de "Dernière vente" (règle explicite, quel que soit l'écart
entre les dates observées). Deux options :
- `npm run importer -- --file palmares.xlsx --period-start YYYY-MM-DD --period-end YYYY-MM-DD` → `period_status: 'explicit'`.
- Sans ces options → `period_status: 'unknown'`, `period_start`/`period_end`
  restent `null`, avertissement explicite dans la CLI et le journal.

### Séparation des préoccupations (Product Mapping / Recipes / Recipe Lines)

Trois concepts distincts, un seul implémenté en PR3 :

1. **Product Mapping** (`lib/importer/parsers/recipe-mapping.js`, ✅ PR3) —
   clé AddicTill → clé produit MÖKA, correspondance **exacte** uniquement
   (normalisée casse/espaces), jamais floue. Source : fichier JSON local
   `lib/importer/config/product-mapping.json` (vide par défaut, committé,
   pas de données sensibles). Chaque produit d'un palmarès importé reçoit
   un `mapping_status` (`mapped`/`unmapped`) ; tout produit non mappé est
   listé dans `unmapped_products`, jamais deviné ni ignoré silencieusement.
2. **Recipes** (recette : identité + métadonnées) — **non implémenté**.
3. **Recipe Lines** (recette → ingrédient + quantité + unité) — **non
   implémenté**.

Aucun décrément de stock, aucun calcul de consommation d'ingrédients : ces
deux couches n'existent pas encore dans le code, seulement dans ce document
comme périmètre futur. Le mapping produit (couche 1) est une pré-condition
nécessaire mais pas suffisante à la déduction de stock — elle seule ne
calcule rien.

### Schéma Notion de pilotage proposé (documentation uniquement — rien créé, rien codé en Zod)

Conformément à la décision prise avant l'implémentation, **aucun schéma Zod
n'a été ajouté pour ces bases** — `lib/importer/schemas.js` ne contient que
des schémas pour des données réellement produites/validées par le parseur
en PR3. Le schéma ci-dessous reste une proposition documentaire, à valider
et implémenter réellement en PR4 contre les vraies bases Notion :

- **Daily Operations** : Établissement (relation), Date, Nombre de tickets,
  Ticket moyen TTC/HT, CA TTC/HT, Clients, CA/tickets à emporter et sur
  place, Devise, Source import (relation → Import Runs), Statut validation.
- **Payment Methods** : Établissement, Date, Moyen de paiement (select),
  Quantité, Montant, Source import.
- **Sales Categories** : Établissement, Catégorie, Période début/fin,
  Quantité, CA TTC/HT, Offerts, Source import.
- **Product Sales** : Établissement, Produit AddicTill (title), Catégorie,
  Période début/fin (nullable "unknown"), Quantité, CA TTC/HT, Offerts,
  Remises (nature encore à documenter, voir ci-dessous), PU, Dernière
  vente, Produit MÖKA (relation → Product Mapping, nullable), Source
  import.
- **Import Runs** : Nom, Type source, Date import, Fichier source, Hash,
  Statut validation, Nombre de lignes, `import_run_id`.
- **Product Mapping** (base Notion, distincte du fichier JSON local utilisé
  en PR3) : Produit AddicTill (title, clé naturelle), Produit MÖKA
  (relation), Statut mapping.

Aucune de ces bases ne référence une base Kamo AI existante. La
correspondance PR3→PR4 pour "Product Mapping" : le fichier JSON local sert
de solution de développement/test ; PR4 pourra soit continuer à le lire,
soit basculer sur une requête Notion — décision à prendre en PR4, pas ici.

### "Remises" — champ neutre, sémantique non vérifiée

La colonne "Remises" du palmarès produits n'est documentée nulle part
(compte de remises ? montant en euros ?) et rien dans les données ne permet
de trancher. Exposée sous deux champs neutres plutôt que de lui donner un
nom qui présuppose une réponse :
- `discounts_raw` : valeur telle qu'affichée (chaîne), jamais transformée.
- `discounts_value` : valeur numérique si la cellule était un nombre,
  sinon `null` — une conversion de type, pas une interprétation métier.

### Fixtures (PR3)

- `lib/importer/__tests__/fixtures/pos/real/` — gitignored (sauf
  `.gitkeep`), contient localement les 3 fichiers réels ayant servi à
  cette analyse (jamais committés). `pos-addictill.real-fixtures.test.js`
  les détecte automatiquement et vérifie des propriétés structurelles
  uniquement — aucune figure financière réelle codée en dur.
- `lib/importer/__tests__/fixtures/pos/synthetic/` — deux fichiers xlsx
  générés par `generate-fixtures.js` (`daily-summary-sample.xlsx`,
  `product-ranking-sample.xlsx`), entièrement inventés, totaux exacts.
  **Restent la source de test obligatoire en CI** — contrairement aux
  fixtures réelles (optionnelles, sautées proprement si absentes), ces
  deux fichiers sont committés et toujours présents.
- Les cas limites (total incohérent, période absente, ambiguïté de
  colonnes, ligne de total manquante) sont construits directement comme
  objets `{ sheets: [...] }` dans `pos-addictill.test.js`, sans passer par
  un fichier xlsx réel — plus rapide et plus précis pour isoler un seul
  comportement à la fois.

## Classification — seuils de confiance

```
CLASSIFICATION_AUTO_THRESHOLD=0.90     (défaut si non défini)
CLASSIFICATION_REVIEW_THRESHOLD=0.75   (défaut si non défini)
```

- `confidence >= 0.90` → `auto` (traitement automatique autorisé en dry-run)
- `0.75 <= confidence < 0.90` → `review_required`
- `confidence < 0.75` ou `document_type = unknown` → `rejected`

Ces seuils ne doivent pas être modifiés sans configuration explicite (voir
`lib/importer/classify.js`, constantes `AUTO_THRESHOLD` / `REVIEW_THRESHOLD`
lues depuis `process.env`).

## Garde-fous (ordre strict)

1. Type de fichier supporté (`detect.js`)
2. `file_hash` déjà traité (`registry.js`, lecture seule en PR1)
3. Extraction (`extract.js`)
4. Classification (`classify.js`)
5. Parsing métier (`parsers/bank-statement.js` ✅ PR2A ; caisse/performance PR3)
6. Validation métier (`validateBankStatement` ✅ PR2A ; caisse/performance PR3)
7. Validation des totaux (équation de solde ✅ PR2A ; totaux caisse PR3)
8. Déduplication par `import_key` — calcul prêt (PR2A), utilisation Notion PR4
9. Aperçu dry-run (inclut désormais l'aperçu bancaire ✅ PR2A)
10. Écriture Notion avec `--commit` — PR4

Aucune étape suivante ne s'exécute si une étape précédente échoue — voir
`scripts/import.js::analyzeFile`, qui retourne un statut `rejected` dès la
première étape en échec sans tenter les suivantes.

## Journal d'import

Chaque exécution génère un `import_run_id` (UUID v4, `node:crypto.randomUUID`)
et un fichier `imports/logs/YYYY-MM-DD/<import_run_id>.json` contenant heure
de début/fin, durée, mode (`dry-run` seul en PR1), liste des fichiers avec
leur statut, et compteurs `rows_created`/`rows_updated`/`rows_skipped` figés
à 0 jusqu'à PR4. Voir `lib/importer/logger.js`.

## PR4 — Intégration Notion et interface MÖKA OS

PR4 connecte le pipeline PR1–PR3 (jusque-là dry-run pur) à Notion et à l'app
Next.js elle-même, via une seule voie d'accès Notion partagée par la CLI et
le web (`lib/importer/notion/commit-pipeline.js`) — aucune règle métier
n'existe deux fois.

### Décision : API Notion classique (2022-06-28), pas le nouveau modèle Data Source

`lib/importer/notion/notion-client.js` utilise délibérément l'API Notion
classique `2022-06-28` (`database_id`, `GET/POST /v1/databases/{id}`), la
même version que `app/api/_notion.js` (l'intégration Kamo AI en production) —
et non le nouveau modèle Database/Data Source de Notion, malgré la
formulation initiale d'`AGENTS.md` qui évoquait des `data_source_id`.

**Pourquoi** : cohérence avec l'architecture existante (`_notion.js` n'est ni
migré ni touché — 15+ routes Kamo AI en dépendent), et aucune des 5 bases de
pilotage ne nécessite les fonctionnalités du nouveau modèle (multi-source par
base). Chaque cible Notion est identifiée par un nom neutre
(`targetIdEnvVar`, ex. `NOTION_DAILY_OPERATIONS_DB_ID`) et non `database_id`
dans la couche métier — voir `lib/importer/config/pilotage-targets.js` — pour
que la couche `lib/importer/notion/repository.js` seule ait besoin de
changer le jour d'une migration.

**Ce qui changerait lors d'une future migration vers le modèle Data Source** :
`lib/importer/notion/notion-client.js` (`getDatabase`/`queryDatabase`/
`createPage`/`updatePage` vers leurs équivalents `data_source_id`),
`lib/importer/notion/repository.js` (résolution `targetId` →
`dataSourceId`), et `lib/importer/config/pilotage-targets.js` (le nom des
variables d'environnement, si on choisit de les renommer). Aucune autre
couche (row-builders, business-keys, schema.js, commit-pipeline.js,
l'UI/API) ne référence `database_id` directement — elles ne verraient rien
du changement. Ni la création/migration de schéma ni ce changement d'API ne
sont dans le périmètre de PR4 — voir "Hors périmètre PR4" plus bas.

### Les 5 bases de pilotage

| Base | Rôle |
|---|---|
| **Import Runs** | Registre Notion faisant autorité pour "ce fichier exact a-t-il déjà été importé" — distinct du registre local `imports/import-registry.json` (PR1), qui ne couvre qu'une seule machine. |
| **Daily Operations** | Une ligne par (établissement, date, source_type) — issue d'une synthèse quotidienne AddicTill. |
| **Payment Methods** | Une ligne par (établissement, date, mode de paiement, source_type). |
| **Product Sales** | Une ligne par produit AddicTill sur une période (palmarès produits). |
| **Sales Categories** | Une ligne par catégorie/rubrique sur une période. |

Les relevés bancaires n'ont **aucune** table de pilotage dédiée dans cette
liste de 5 — un commit bancaire crée/maintient uniquement son enregistrement
Import Run (voir "Relevés bancaires et le schéma de pilotage" plus bas) ;
`lib/importer/notion/row-builders.js` n'a donc volontairement pas de
`buildBankStatementRows`.

### Spécification exacte de création manuelle (5 bases)

PR4 ne crée, ne renomme ni ne modifie aucune propriété Notion
(`importer:schema:sync` reste hors périmètre — voir plus bas). Chaque base
doit être créée à la main dans Notion selon ce schéma exact ; les noms de
propriété listés sont les noms **stables** que le code utilise pour lire/
écrire — les renommer côté Notion casse l'import.

**Import Runs** (`NOTION_IMPORT_RUNS_DB_ID`) — voir "Audit trail vs.
déduplication métier" plus bas pour le rôle exact de chaque propriété liée
au cycle de vie.

| Propriété | Type Notion | Notes |
|---|---|---|
| `Name` | Title | Libre — généré comme `<source_subtype> — <original_filename> (#<attempt_number>)`. |
| `import_run_id` | Rich text | Identifiant généré par le code, pas par Notion. |
| `source_type` | Select | Options : `bank_statement`, `pos_export`, `monthly_performance`. |
| `source_subtype` | Select | Options : `credit_mutuel`, `addictill_daily_summary`, `addictill_product_ranking`, `laddition_export`, `scanz_ocr_summary` (spec v3, source secondaire — voir "scan-z" plus bas), `unknown`. |
| `original_filename` | Rich text | |
| `file_hash_sha256` | Rich text | Clé de déduplication — un run au statut `committed` sur ce hash bloque tout nouveau commit du même fichier. |
| `imported_at` | Date | Horodatage de cette tentative précise (avec heure). |
| `period_start` | Date | Nullable (relevé/synthèse mono-jour). |
| `period_end` | Date | Nullable. |
| `validation_status` | Select | Options : `valid`, `invalid` — résultat de validation du document lui-même. |
| `warning_count` | Number | Format entier. |
| `error_count` | Number | Format entier. |
| `row_count` | Number | Format entier — nombre de lignes de pilotage écrites (hors relevés bancaires et tentatives bloquées, toujours 0). |
| `status` | Select | Options : `preview`, `committed`, `failed`, `partial_failure`, `retry`, `blocked` (spec v3 — refus par les règles métier du pipeline lui-même : validation, précédence de source, doublon, établissement non résolu ; distinct de `failed`, réservé aux problèmes techniques — voir "scan-z" plus bas) — cycle de vie de **cette tentative précise**, voir "Audit trail vs. déduplication métier". |
| `attempt_number` | Number | Format entier ≥ 1 — combien de tentatives (toutes confondues) existent déjà pour ce `file_hash_sha256`, celle-ci incluse. |
| `retry_of_import_run_id` | Rich text | Nullable — `import_run_id` de la tentative précédente pour ce même fichier, quand `attempt_number` > 1. |
| `failure_reason` | Rich text | Nullable — raisons de blocage/échec (`blocking_reasons` joints, ou détail des lignes en échec). Vide sur `committed`. |
| `initiated_via` | Select | Options : `cli`, `web`. |
| `initiated_by` | Rich text | Meilleur effort : utilisateur OS pour la CLI, identifiant Basic Auth soumis pour le web — **pas** une identité par membre du staff (voir "Limite connue : `initiated_by`" plus bas). |
| `parser_version` | Rich text | Version du parseur qui a réellement traité ce document (`bank-v1.0.0`, `addictill-v1.0.0`), ou `importer-v<IMPORTER_VERSION>` si aucun parseur spécifique n'a tourné (type de fichier inconnu, classification ambiguë/rejetée, source non supportée). Jamais vide. |
| `establishment_key` | Rich text | Clé stable (ex. `moka-sxm`), jamais le nom affiché ; vide (`''`) quand non résolu (ex. aperçu sans établissement choisi). |
| `audit_metadata` | Rich text | Ajouté spec v3 — chaîne JSON compacte (≤ 1900 caractères, voir "scan-z" plus bas) portant le contexte d'audit riche (résumé OCR, revue humaine, avertissements, réconciliation de précédence) — délibérément séparée de `failure_reason`, qui reste exclusivement réservée aux échecs réels. Vide (`''`) hors flux scan-z. |

**Daily Operations** (`NOTION_DAILY_OPERATIONS_DB_ID`)

| Propriété | Type | Notes |
|---|---|---|
| `Name` | Title | |
| `import_key` | Rich text | Clé métier déterministe (sha256), voir "Clés métier" plus bas. |
| `establishment_key` | Rich text | |
| `date` | Date | |
| `source_type` | Select | |
| `source_subtype` | Select | Ajouté spec v3 — mêmes options que sur **Import Runs**. Sert la précédence de source (voir "scan-z" plus bas) : une écriture entrante n'est acceptée que si son autorité ≥ celle de la ligne existante. |
| `ticket_count` | Number | Entier |
| `total_ttc` | Number | Devise (2 décimales) |
| `total_ht` | Number | Devise, nullable (spec v3 — jamais inventée ; toujours `null` pour scan-z). |
| `ca_ttc` | Number | Devise, nullable (spec v3 — même règle que `total_ht`). |
| `clients` | Number | Entier, nullable |
| `source_import` | Relation | Vers **Import Runs**, un seul lien (le run le plus récent ayant écrit/mis à jour cette ligne). |

**Payment Methods** (`NOTION_PAYMENT_METHODS_DB_ID`)

| Propriété | Type | Notes |
|---|---|---|
| `Name` | Title | |
| `import_key` | Rich text | |
| `establishment_key` | Rich text | |
| `date` | Date | |
| `source_type` | Select | |
| `source_subtype` | Select | Ajouté spec v3 — voir **Daily Operations** ci-dessus. |
| `payment_method` | Select | Options ouvertes — une nouvelle valeur (ex. nouveau mode de paiement AddicTill) est une **donnée**, jamais un changement de schéma bloquant. |
| `quantity` | Number | Entier |
| `amount` | Number | Devise |
| `source_import` | Relation | Vers **Import Runs**. |

**Product Sales** (`NOTION_PRODUCT_SALES_DB_ID`)

| Propriété | Type | Notes |
|---|---|---|
| `Name` | Title | |
| `import_key` | Rich text | |
| `establishment_key` | Rich text | |
| `period_start` | Date | |
| `period_end` | Date | |
| `addictill_product_key` | Rich text | Nom produit normalisé (casse/espaces), pas le nom brut. |
| `product_name_raw` | Rich text | Nom exact tel qu'affiché dans l'export. |
| `category_name` | Rich text | Nullable. |
| `quantity` | Number | |
| `revenue_ttc` | Number | Devise |
| `revenue_ht` | Number | Devise |
| `complimentary_qty` | Number | Entier |
| `discounts_raw` | Rich text | Nullable. |
| `discounts_value` | Number | Nullable. |
| `unit_price` | Number | Nullable — devise. |
| `last_sale_at` | Date | Nullable, avec heure. |
| `mapping_status` | Select | Options : `mapped`, `unmapped`. |
| `moka_product_key` | Rich text | Nullable — vide tant que `mapping_status = unmapped`, jamais deviné. |
| `source_import` | Relation | Vers **Import Runs**. |

**Sales Categories** (`NOTION_SALES_CATEGORIES_DB_ID`)

| Propriété | Type | Notes |
|---|---|---|
| `Name` | Title | |
| `import_key` | Rich text | |
| `establishment_key` | Rich text | |
| `period_start` | Date | |
| `period_end` | Date | |
| `category_key` | Rich text | Normalisé. |
| `category_name_raw` | Rich text | |
| `quantity` | Number | |
| `revenue_ttc` | Number | Devise |
| `revenue_ht` | Number | Devise |
| `complimentary_qty` | Number | Entier |
| `source_import` | Relation | Vers **Import Runs**. |

Les propriétés listées "nullable" sont une contrainte de **donnée**, pas de
**schéma** : `lib/importer/notion/schema.js` les exige toutes présentes dans
le schéma Notion réel (sinon Notion renvoie une erreur 400 dès qu'une
écriture référence une propriété absente) — seule leur *valeur* peut être
vide/nulle.

### scan-z — source secondaire par photo (spec v3, implémentée)

Une photo du "Z" de caisse, lue par OCR (Claude vision), utilisable en
complément d'AddicTill/L'Addition quand ceux-ci ne sont pas disponibles.
Entièrement derrière `IMPORTS_SCANZ_ENABLED` (défaut `false`) — flag vérifié
par `isScanZEnabled()` dans `lib/importer/notion/commit-pipeline.js` ; quand
il est désactivé, `runScanZPreflight`/`runScanZCommit` renvoient un motif de
blocage `SCANZ_DISABLED` propre, sans le moindre appel Notion ou Claude.

**Autorité de source (précédence).** `source_subtype` porte une autorité
numérique (`lib/importer/schemas.js`, `SOURCE_SUBTYPE_AUTHORITY`) :
`addictill_daily_summary` et `laddition_export` = 100, `scanz_ocr_summary` =
10, tout autre/inconnu = 0 (repli fail-closed). Une écriture de ligne de
pilotage (Daily Operations / Payment Methods) n'est acceptée que si
`autorité(entrante) ≥ autorité(existante)` (`checkAuthority` dans
`pilotage-writer.js`). En clair : scan-z ne peut jamais écraser une ligne
déjà posée par AddicTill/L'Addition — la tentative est bloquée
(`status: 'blocked_precedence'` au niveau ligne, `blocked` au niveau Import
Run), avec **zéro écriture**, à la fois au preview et au commit. **Il
n'existe aucun mécanisme d'override** — pas de paramètre caché, pas de
bouton "forcer" côté UI/CLI/API ; toute tentative de contournement (ex.
paramètres `force`/`override` envoyés à l'API) est ignorée sans effet.

**Jamais de total_ht/ca_ttc inventés.** Le parseur scan-z
(`lib/importer/parsers/scanz-ocr.js`) ne lit que ce que le Z affiche
réellement — `total_ht_cents`/`ca_ttc_cents`/`clients_count` sont **toujours
`null`**, jamais dérivés ou devinés. `DailyOperationsRowSchema.total_ht`/
`.ca_ttc` sont nullable pour cette raison précise ; l'UI (`ScanZPanel.js`)
laisse le champ HT vide par défaut, jamais pré-rempli avec 0 ou une copie du
TTC.

**Validation déterministe (bloquante) vs. confiance (non bloquante).**
`date`, `total_ttc` et `ticket_count` sont individuellement obligatoires,
numériques/entiers et positifs — l'absence ou l'invalidité de l'un d'eux
bloque (`validation.errors`, jamais un import silencieusement partiel).
Tout le reste (libellés attendus manquants, qualité d'image, valeur répétée
incohérente, somme des lignes non réconciliée, nombre de tickets
inhabituellement élevé mais structurellement valide) ne bloque jamais la
donnée — cela réduit la confiance composite et peut déclencher
`requiresAcknowledgement` (case à cocher obligatoire côté UI avant de
pouvoir confirmer), sans jamais empêcher la confirmation elle-même.
Confiance composite = score auto-déclaré par Claude (`ocr_confidence`
high/medium/low → 0.95/0.80/0.50), plafonné indépendamment par chacun des
signaux dégradés ci-dessus. Seul un plafond statique
(`DEFAULT_TICKET_COUNT_CEILING = 500`) est implémenté pour le nombre de
tickets inhabituel — **écart assumé** par rapport à la mention v3 d'une
moyenne historique dynamique par établissement, jugée hors périmètre du
premier lot.

**Jeton de préview signé (HMAC-SHA256).** Claude vision n'est appelé
**qu'une seule fois**, au preview (`runScanZPreflight`) — jamais rejoué au
commit. Les valeurs OCR brutes vérifiées voyagent du preview au commit via
un jeton signé (`lib/importer/notion/preflight-token.js` :
`base64url(JSON) + '.' + base64url(HMAC-SHA256(JSON, IMPORTS_PREFLIGHT_TOKEN_SECRET))`,
comparaison en temps constant via `crypto.timingSafeEqual`), liant
`file_hash_sha256`, `source_subtype`, `establishment_key`, `ocr_raw_values`,
`issued_at` et `expires_at` (TTL par défaut 30 minutes). Le contenu n'est
**pas chiffré**, seulement signé — la même donnée est de toute façon déjà
montrée au relecteur authentifié. **Ce jeton n'est pas garanti à usage
unique** : c'est un choix assumé et documenté explicitement ici, pas un
oubli — un rejeu ne fait que répéter la même écriture idempotente déjà
validée (clé métier déterministe, vérification de précédence systématique à
chaque commit), donc un replay ne peut ni dupliquer une ligne ni contourner
la précédence de source.

Traitement des échecs de jeton, exactement comme demandé lors de la
conception :
- Signature invalide → **aucun** champ du payload n'est utilisé, quel qu'il
  soit ; l'événement est loggé côté serveur (`console.error`) ; un Import
  Run minimal en échec n'est créé que si ses champs sont dérivables
  indépendamment d'entrées de confiance (hash de fichier recalculé,
  utilisateur authentifié, contexte de requête validé) — jamais depuis le
  payload du jeton.
- Jeton valide mais expiré → son payload vérifié peut être utilisé pour
  créer un Import Run en échec avec le motif `PREFLIGHT_TOKEN_EXPIRED`.
- Incohérence de liaison (hash de fichier, établissement ou
  `source_subtype` ne correspondant pas au jeton) → échec
  (`PREFLIGHT_TOKEN_FILE_MISMATCH` / `_ESTABLISHMENT_MISMATCH` /
  `_SUBTYPE_MISMATCH`), zéro écriture.

**`audit_metadata` — taille bornée par construction.** Nouvelle propriété
Import Runs (`lib/importer/notion/audit-metadata.js`) : chaîne JSON
compacte, plafonnée à 1900 caractères, portant le résumé OCR, la revue
humaine (valeurs brutes vs. finales, champs corrigés, relecteur, horodatage),
les avertissements (max 3, 80 caractères chacun) et le contexte de
réconciliation de précédence. Séparée délibérément de `failure_reason`
(réservée exclusivement aux échecs réels). La fonction de compaction essaie
4 niveaux de réduction progressive puis un repli minimal borné puis un
dernier repli de taille fixe absolue — garantie par construction (et
vérifiée contre des entrées pathologiques/adverses dans les tests) de
toujours renvoyer un JSON valide ≤ 1900 caractères, sans jamais lever
d'exception ni faire échouer un commit par ailleurs réussi.

**`blocked` vs. `failed`.** `blocked` = les règles métier du pipeline
lui-même ont refusé la tentative à bon droit (validation, classification
ambiguë, établissement inconnu, fichier dupliqué, conflit de précédence de
source) ; `failed` = problème technique/infrastructure sans rapport avec la
validité métier du document (schéma Notion incohérent, jeton de preview
invalide/expiré/non correspondant, erreur d'écriture Notion).

**Écarts d'architecture assumés par rapport au texte de conception v1/v2/v3**
(documentés ici pour toute relecture future) :
- `runScanZPreflight`/`runScanZCommit` sont des fonctions **séparées** dans
  `commit-pipeline.js`, volontairement **non fusionnées** avec
  `runPreflight`/`runCommit` — justifié par la contrainte explicite de
  compatibilité ascendante et par des entrées/flux de commit structurellement
  différents (jeton signé, pas de re-parsing au commit).
- `classify.js` reste **entièrement inchangé** — scan-z ne passe jamais par
  le moteur de règles textuelles : `source_type`/`source_subtype` sont fixés
  directement dans `runScanZPreflight`, la classification étant triviale
  puisque l'utilisateur a explicitement choisi l'outil scan-z.
- Seul un plafond statique de nombre de tickets est implémenté (voir
  ci-dessus), pas la moyenne historique dynamique par établissement évoquée
  en v3.

**Portée explicitement hors scan-z** (rappel, comme pour PR4) : aucune
déduction de stock directe ou indirecte ; aucune écriture vers **Product
Sales** ni **Sales Categories** ; AddicTill et L'Addition restent seuls
prioritaires sur les lignes de pilotage.

### Checklist de mise en place (avant le premier import réel)

1. **Créer** les 5 bases ci-dessus dans Notion, dans l'espace de travail
   MÖKA, avec exactement les noms de propriété et types listés (l'ordre des
   colonnes et le nom de la base elle-même sont libres).
2. **Partager** chacune des 5 bases avec l'intégration Notion utilisée par
   l'importateur (menu "..." → "Connexions" → sélectionner l'intégration).
   Un oubli produit `NOT_SHARED_WITH_INTEGRATION` à `schema:check`/commit,
   jamais une erreur silencieuse.
3. **Récupérer l'ID** de chaque base : ouvrir la base en plein écran dans
   Notion, copier les 32 caractères hexadécimaux de l'URL juste avant `?v=`.
4. **Renseigner la variable d'environnement** correspondante
   (`NOTION_IMPORT_RUNS_DB_ID`, `NOTION_DAILY_OPERATIONS_DB_ID`,
   `NOTION_PAYMENT_METHODS_DB_ID`, `NOTION_PRODUCT_SALES_DB_ID`,
   `NOTION_SALES_CATEGORIES_DB_ID`) — voir `.env.example`.
5. **Vérifier avant tout import réel** :
   `npm run importer:schema:check` — lecture seule, ne modifie jamais
   Notion ; sort en code 1 si une base est manquante, non partagée,
   introuvable, ou n'a pas exactement les propriétés attendues.

### Clés métier et upsert idempotent

Notion n'offre aucune transaction multi-opérations — la cohérence vient
d'un upsert par ligne idempotent (`lib/importer/notion/pilotage-writer.js`),
jamais d'une prétention à l'atomicité. Chaque ligne a une clé métier
déterministe (`lib/importer/notion/business-keys.js`, sha256 des champs
identifiants — jamais un UUID aléatoire) :

- Daily Operations : `establishment_key + date + source_type`
- Payment Methods : `establishment_key + date + payment_method + source_type`
- Product Sales : `establishment_key + period_start + period_end + addictill_product_key`
- Sales Categories : `establishment_key + period_start + period_end + category_key`

Pour chaque ligne, `pilotage-writer.js` cherche une page existante par
`import_key` : absente → création ; présente mais différente (donnée ou
simplement `source_import` pointant vers un run différent) → mise à jour ;
présente et strictement identique (donnée **et** `source_import` déjà à
jour) → ignorée (aucun appel d'écriture Notion gaspillé). Un export corrigé
du même jour ne crée donc jamais de doublon — il met à jour l'enregistrement
existant.

### Audit trail vs. déduplication métier

Deux préoccupations distinctes, volontairement séparées (retour explicite
de relecture PR4) :

1. **Historique d'audit** — chaque tentative d'exécution, qu'elle soit un
   simple aperçu (`preview`), un commit bloqué, un échec, un échec partiel
   ou un succès complet, produit **son propre enregistrement Import Run**,
   jamais réutilisé ni écrasé. Rien n'est jamais perdu : on peut toujours
   répondre à "qui a importé, quand, avec quelle version de parseur, quel
   fichier, combien de tentatives, pourquoi ça a échoué, quelle tentative a
   fini par réussir" en listant tous les runs partageant le même
   `file_hash_sha256` et en lisant leurs `status`/`attempt_number`/
   `retry_of_import_run_id`/`failure_reason`.
2. **Déduplication métier** — les *lignes de pilotage* (Daily Operations,
   Payment Methods, Product Sales, Sales Categories) ne sont, elles,
   écrites que si rien ne bloque (voir "Règles de blocage" plus bas) ; et
   un nouveau commit du fichier exact est refusé seulement si un run
   antérieur pour ce `file_hash_sha256` a `status: 'committed'` — jamais
   sur la base du premier run trouvé, toujours sur l'ensemble des runs
   connus (`listImportRunsByFileHash` dans `import-runs.js`, pas un lookup
   à résultat unique).

Concrètement, `commit-pipeline.js` écrit un enregistrement Import Run à
**chaque** appel de `runPreflight` (statut `preview`, le fichier n'a encore
subi aucune tentative de commit) et à chaque appel de `runCommit` (un seul
enregistrement par tentative de commit — `runCommit` appelle `runPreflight`
en interne avec `writeAudit: false` pour ne jamais dupliquer l'écriture
d'audit d'une même action utilisateur). Cette écriture d'audit est toujours
best-effort : si Notion est injoignable (base non configurée en
développement, panne réseau), l'échec est capturé dans
`audit_write_error`/`duplicate_check_error` et **ne bloque jamais** le
retour d'un aperçu ou d'un résultat de commit à l'appelant.

Pour une tentative de commit qui n'est pas bloquée, l'enregistrement Import
Run est créé **avant** l'écriture des lignes de pilotage (pour que celles-ci
aient un id de page réel à référencer via `source_import`), avec un statut
provisoire pessimiste — `retry` si c'est la tentative n°2+ pour ce fichier,
`failed` sinon — puis corrigé en `committed`/`partial_failure`/`failed` une
fois le résultat réel connu. En cas de crash entre les deux,
l'enregistrement reste sur son statut provisoire : un signal honnête ("une
tentative a eu lieu, résultat inconnu"), jamais trompeur, et qui ne bloque
jamais une nouvelle tentative (seul `committed` bloque).

**Limite connue : `initiated_by`.** Ce champ est du meilleur effort, pas
une vraie identité par membre du staff : pour la CLI, c'est le nom
d'utilisateur du système d'exploitation (`os.userInfo().username`) ; pour
le web, c'est l'identifiant Basic Auth effectivement soumis — mais comme
`IMPORTS_AUTH_USERNAME`/`IMPORTS_AUTH_PASSWORD` sont un identifiant unique
partagé (voir "Authentification" plus haut), cette valeur ne distingue
généralement pas deux personnes différentes utilisant la même
identification staff. Une vraie attribution "qui a importé" nécessite le
futur système d'authentification par rôle déjà documenté — ce jour-là, seul
`lib/auth/imports-basic-auth.js` (et la façon dont `initiated_by` est
alimenté) change, jamais `lib/importer/**`.

### Règles de blocage — lignes de pilotage uniquement (jamais l'audit)

Ces règles ne gouvernent que l'écriture des **lignes de pilotage**
(Daily Operations/Payment Methods/Product Sales/Sales Categories) —
l'enregistrement Import Run d'audit, lui, est toujours écrit (voir
ci-dessus). Une tentative est bloquée — **aucune ligne de pilotage
écrite** — si l'une de ces conditions est vraie :

1. Le document a des erreurs de validation bloquantes (`validation.errors`
   non vide — ex. `TOTAL_MISMATCH`). Les avertissements non bloquants
   (`validation.warnings`, ex. l'écart encaissements/vendeurs déjà non
   bloquant en PR3) **ne bloquent jamais** une synthèse quotidienne par
   ailleurs valide.
2. Le document n'est pas classifié `auto` (ambigu ou rejeté).
3. `establishment_key` est absent ou hors de l'allowlist
   (`UNKNOWN_ESTABLISHMENT`) — jamais déduit du nom de fichier, du contenu,
   ou d'un état de session.
4. Le fichier exact a déjà un run `committed` enregistré
   (`DUPLICATE_FILE_ALREADY_COMMITTED`).
5. Le schéma Notion réel d'au moins une des cibles concernées ne correspond
   pas au contrat attendu (`SCHEMA_MISMATCH`) — vérifié à chaque commit,
   jamais mis en cache.

Un « Palmarès produits » dont les totaux ne se recoupent pas (produits vs.
total général, ou Rubriques vs. Produits) est bloqué par défaut via la même
règle 1 — pas de traitement spécial.

### Établissement — allowlist de configuration, pas une base Notion

`establishment_key` est obligatoire pour tout commit (CLI : `--establishment`
; UI : sélecteur requis ; API : champ `establishmentKey` du payload) —
jamais déduit. En PR4, la résolution passe par une allowlist en variable
d'environnement (`IMPORTS_ESTABLISHMENTS=cle:Nom Affiché,cle2:Nom2`, voir
`lib/importer/notion/establishments.js`), pas par une base "Établissements"
(explicitement hors périmètre PR4). Les clés métier n'utilisent que
`establishment_key`, jamais le nom affiché, précisément pour qu'une future
base Établissements puisse remplacer cette allowlist sans toucher aux
parseurs, aux clés métier, à la logique Import Run, ni aux contrats UI/API.

### Authentification — Basic Auth temporaire

`/imports` et `/api/imports/*` sont protégés par HTTP Basic Auth
(`lib/auth/imports-basic-auth.js`, branché dans `middleware.js`) :
identifiants uniquement via `IMPORTS_AUTH_USERNAME`/`IMPORTS_AUTH_PASSWORD`
(jamais exposés côté client), échec fermé (401) si absents, et un opt-out de
développement **explicite uniquement** (`IMPORTS_AUTH_DISABLED=true` —
jamais déduit de `NODE_ENV`). Couche volontairement temporaire : un futur
système de rôles/staff pourra la remplacer sans toucher à
`lib/importer/**` — cette dernière ne connaît d'ailleurs même pas
l'existence de l'authentification.

### Contrainte de runtime Edge découverte en PR4

Next.js 16.2.6 bundle encore `middleware.js` (convention dépréciée,
remplacée par `proxy.js`) pour le **runtime Edge par défaut** — seule la
nouvelle convention `proxy.js` bascule sur Node.js par défaut. `node:crypto`
n'est pas disponible dans ce bundle Edge (`next build` échoue avec
`Cannot find module 'node:crypto'` si on l'utilise depuis un module importé
par `middleware.js`). `lib/auth/imports-basic-auth.js` n'utilise donc que
des primitives Web/Edge-safe (`crypto.subtle.digest`, `atob`, `TextDecoder`)
— identiques et disponibles aussi bien sous Node que sous Edge, donc ce
fichier se comporte à l'identique quel que soit le runtime qui le charge.
Migrer `middleware.js` vers `proxy.js` (et donc vers le runtime Node.js par
défaut) reste possible plus tard sans repasser sur `node:crypto` — les deux
fonctionnent déjà.

`pdf-parse` (utilisé par `lib/importer/extract.js`) entraîne une dépendance
native (`@napi-rs/canvas`) que Turbopack ne peut pas empaqueter pour les
routes serveur — `next.config.mjs` déclare `serverExternalPackages:
['pdf-parse', '@napi-rs/canvas']` pour laisser Node les résoudre nativement
au runtime ; sans cela, `next build` échoue sur
`ReferenceError: DOMMatrix is not defined` en collectant les données de page
de `/api/imports/*`.

### Flux d'upload sans état (stateless)

Le fichier uploadé n'est **jamais persisté côté serveur** — ni sur disque,
ni en session. `lib/importer/extract.js`/`detect.js`/`registry.js` exposent
désormais une variante `*FromBuffer` à côté de la variante historique par
chemin de fichier (`extractContentFromBuffer`, `detectFileTypeFromBuffer`,
`computeFileHashFromBuffer`), et `commit-pipeline.js` accepte indifféremment
`filePath` (CLI) ou `buffer` (upload web) — tout le reste du pipeline
(classification, parsing, validation, upsert) est ensuite strictement
identique. L'UI (`app/imports/_components/ImportsClient.js`) garde le
`File` sélectionné en mémoire côté client et le renvoie tel quel à chaque
étape (`/api/imports/preflight` puis `/api/imports/commit`).

### Hors périmètre PR4 (rappel explicite)

- **`importer:schema:sync`** (création/modification automatique de
  propriétés Notion) — volontairement absent. `schema:check` ne fait que
  lire et comparer, jamais écrire. Une future PR dédiée à la création/
  migration de schéma nécessitera une approbation et un audit trail
  explicites, séparés de ce PR.
- **Base "Établissements"** — allowlist de configuration à la place (voir
  plus haut).
- **Migration vers le modèle Data Source de Notion** — voir la section API
  ci-dessus.
- **Recipes / Recipe Lines / décrément de stock** — inchangé depuis PR3,
  toujours non implémenté.

## Feuille de route — Importateur asynchrone (Future PR, non implémenté)

Le pipeline actuel (`commit-pipeline.js`) est **entièrement synchrone** :
une requête CLI ou API HTTP fait tout le travail (extraction, classification,
parsing, validation, écritures Notion séquentielles au débit imposé par le
throttle ~340 ms) dans le même appel, du début à la fin. Cela reste
volontairement le comportement actuel — **rien de ce qui suit n'est
implémenté**, c'est uniquement une feuille de route pour une future PR, à
n'entreprendre qu'après validation explicite, comme toutes les autres.

**Pourquoi ce serait nécessaire un jour** : un import synchrone est borné
par la durée d'une requête HTTP (`maxDuration` de la route `/api/imports/
commit`, aujourd'hui 60s) et par le débit Notion (~3 req/s) — un gros
palmarès produits (des centaines de lignes) ou plusieurs imports simultanés
finiraient par dépasser ce budget. Le pipeline actuel n'a jamais été testé
au-delà des volumes réels vus en PR2A/PR3 (quelques centaines de
transactions/lignes) — rien n'indique un problème imminent, mais la
limite existe.

**Architecture suggérée (Future PR) — moteur d'import basé sur une file
d'attente** :

- **BullMQ** (ou équivalent) comme gestionnaire de file d'attente de jobs.
- **Redis** comme backend de la file (déjà le choix standard pour BullMQ).
- **Workers en arrière-plan** — processus séparés de la requête HTTP,
  consommant la file et exécutant le pipeline `commit-pipeline.js` existant
  (celui-ci resterait la logique métier réutilisée telle quelle — seul son
  mode d'invocation changerait, d'un appel direct synchrone à un job
  poussé en file).
- **File de retry** — reprise automatique d'un job en `partial_failure`/
  `failed`, au lieu d'une reprise manuelle (`--commit` relancé à la main
  aujourd'hui).
- **Dead-letter queue** — jobs ayant épuisé leurs tentatives de retry
  automatiques, mis de côté pour investigation manuelle plutôt que
  silencieusement abandonnés.
- **Suivi de progression** — état d'un job exposé en temps réel (ex. via
  polling ou websocket) à l'UI `/imports`, pour un gros fichier dont le
  traitement prend plusieurs minutes.
- **Imports concurrents multiples** — plusieurs fichiers/établissements
  traités en parallèle par plusieurs workers, au lieu d'un seul à la fois.
- **Imports planifiés** — déclenchement automatique récurrent (ex. import
  quotidien programmé), plutôt qu'un déclenchement manuel systématique.
- **Traitement de gros lots** — fichiers ou volumes de lignes dépassant ce
  qu'une seule requête HTTP/exécution CLI peut raisonnablement traiter.

**Ce qui ne changerait pas** : `commit-pipeline.js` (analyse/validation/
upsert), les clés métier, le schéma des 5 bases de pilotage, et l'audit
trail Import Runs (chaque job resterait une "tentative" auditée avec son
propre statut). Ce qui changerait : uniquement la couche d'orchestration
autour de ce pipeline — d'un appel direct (CLI ou route HTTP) à un
déclenchement asynchrone via job de file d'attente.

## Stock safety patch — idempotence des réceptions

Suite à l'Architecture Ownership Audit (revue read-only, hors périmètre
importateur), un correctif ciblé a été apporté à **Current Stock** — le
module opérationnel `app/page.js`/`app/api/stock/*`/`app/api/supplier-orders/*`,
totalement distinct des bases analytiques de l'importateur (Daily
Operations, Payment Methods, Product Sales, Sales Categories, Import Runs —
**aucune n'est modifiée par ce correctif**). Objectif unique : empêcher
qu'une même livraison physique n'augmente Current Stock plus d'une fois.
Ce n'est **pas** l'implémentation de Stock Movements — Current Stock reste
une valeur mutée directement (voir "Stade intérimaire" plus bas).

### Exigence d'idempotence

Toute mutation additive du stock (`mode: "add"`/`"upsert"` sur
`POST /api/stock/update`) exige désormais un `idempotencyKey` — voir
`lib/stock/idempotency.js`. Sans clé, ou avec une clé malformée/trop longue,
la requête est rejetée (`status: "rejected"`), jamais silencieusement
acceptée ni dotée d'une clé générée côté serveur. `mode: "replace"`
(comptage physique / correction manuelle complète) est **inchangé** — un
recomptage reste une correction absolue, volontaire et non répétable par
nature, donc non gardé par clé d'idempotence.

Formats de clé (préfixe obligatoire, format `préfixe:segment:segment`) :

| Origine | Format |
|---|---|
| Réception de commande fournisseur | `supplier-receipt:{supplierOrderPageId}:{ingredientPageId}` |
| Réception via facture scannée | `invoice-receipt:{invoiceHash}:{ingredientPageId}` |
| Réception manuelle rapide | `manual-receipt:{clientGeneratedOperationId}:{ingredientPageId}` |

Un horodatage seul n'est jamais un identifiant valide. La clé "réception
manuelle" est générée côté **client** une seule fois à l'ouverture du modal
(`openStockReceive`) et réutilisée telle quelle sur toute nouvelle tentative
— le serveur ne fabrique jamais de clé lui-même.

Chaque ligne Stock porte désormais un **grand livre borné** des clés déjà
appliquées (`Applied_Receipts_Ledger`, JSON compact ≤ 1900 caractères, même
philosophie de troncature bornée que `audit_metadata` côté importateur mais
implémentée indépendamment — les deux domaines restent volontairement
découplés). Une clé déjà présente renvoie `already_applied` avec la
quantité déjà obtenue précédemment, sans réappliquer le delta.

**Limite assumée** : Notion (API classique) n'offre ni transaction ni
compare-and-swap. Un verrou en mémoire process (`lib/stock/apply-addition.js`)
sérialise les requêtes concurrentes visant la même ligne de stock — ce qui
ferme la fenêtre de course pour un double-tap ou un retry rapide sur la
**même** instance serverless, mais ne garantit pas l'exclusion mutuelle
entre deux instances distinctes démarrées à froid au même instant. La clé
d'idempotence reste la protection principale, efficace pour le cas
dominant en pratique : une requête répétée séquentiellement (retry réseau,
double clic).

### Saga de réception fournisseur

`POST /api/supplier-orders/receive` (`lib/stock/supplier-receiving.js`)
remplace les deux appels indépendants et non coordonnés qui existaient
auparavant (`POST /api/stock/update` puis `PATCH /api/supplier-orders`).
L'UI (`confirmReceiveStep` dans `app/page.js`) appelle cette route une fois
par étape confirmée, avec l'ensemble des lignes confirmées jusqu'ici et
`isFinal: true` sur la dernière étape :

1. Chaque ligne reçoit une clé déterministe
   `supplier-receipt:{orderId}:{ingredientId}` et est appliquée via
   `applyIdempotentStockAddition` — donc déjà protégée individuellement.
2. Le résultat par ligne (`applied`/`already_applied`/`rejected`) est
   fusionné dans le grand livre de la commande (`Receiving_Ledger` sur
   `BESOINS`, fusion par clé — un retry ne fait jamais grossir le
   grand livre, il remplace l'entrée existante).
3. La commande n'est marquée `Statut: "Reçu"` que si l'appel est `isFinal`
   **et** qu'aucune ligne n'est `rejected`.

Notion n'offrant pas de transaction multi-bases, ceci est une **saga
récupérable**, pas une opération atomique : si le process s'interrompt
après avoir traité 2 lignes sur 3, un retry renvoyant les 3 lignes
retrouve les 2 premières en `already_applied` (aucune double application)
et ne traite réellement que la 3ᵉ, avant de marquer la commande reçue.

### Réception par facture scannée

L'OCR de prévisualisation (`POST /api/analyze-invoice`) est inchangé — il
ne persiste toujours rien. La confirmation (`POST /api/analyze-invoice/confirm`,
`lib/stock/invoice-receipt.js`) recalcule le hash sha256 de l'image
**côté serveur** (jamais fait confiance à un hash fourni par le client) et
dérive une clé `invoice-receipt:{invoiceHash}:{ingredientId}` par ligne —
une confirmation répétée de la même photo ne peut pas ajouter le stock une
deuxième fois.

**Facture scannée et réception de commande fournisseur sont aujourd'hui
deux origines de réception alternatives et indépendantes** — ce correctif
n'implémente **aucun** rapprochement automatique facture ↔ commande. Si un
appelant futur fournit `supplierOrderId` (aucune UI actuelle ne le fait), la
confirmation est routée vers la même saga canonique que la réception de
commande, avec la clé `supplier-receipt:...` — pour qu'une facture liée à
une commande ne puisse jamais créditer le stock sous une clé différente de
celle de la commande elle-même.

### Différence entre les 4 types de réception

| Type | Déclenché par | Clé | Effet sur `Statut` de commande |
|---|---|---|---|
| Réception de commande fournisseur | `confirmReceiveStep` | `supplier-receipt:...` | Oui — `Reçu` si toutes les lignes finales réussissent |
| Facture scannée (non liée) | `saveInvoiceToStock` | `invoice-receipt:...` | Non |
| Facture scannée (liée à une commande, futur) | — | `supplier-receipt:...` (délégué à la saga) | Oui, mêmes règles |
| Réception manuelle rapide | `saveStockReceive` (mode add) | `manual-receipt:...` | Non — ne touche jamais BESOINS |
| Comptage/correction physique | `saveInventoryAdjust`, `saveStockReceive` (mode replace) | Aucune (non gardé) | Non |

### Stade intérimaire — ce qui NE change PAS

Current Stock reste une valeur **directement mutée** (`Quantite_stock` sur
`DB.STOCK`) — ce correctif ajoute l'idempotence et la consolidation de la
réception, il n'introduit pas de journal d'écritures immuable ni de vue
matérialisée. Restent inchangés et hors périmètre : aucune vente POS ne
déduit le stock (AddicTill/scan-z), aucune préparation ne déduit le stock,
`Product Sales`/`Daily Operations`/`Payment Methods`/`Sales Categories`/
`Import Runs` ne sont ni lus ni écrits par ce correctif. Le plan cible
(non implémenté) est une base **Stock Movements** append-only comme seule
écrivaine de Current Stock — voir la matrice d'ownership de l'Architecture
Ownership Audit pour le détail des règles prévues (réceptions fournisseur
et ventes POS validées comme mouvements positifs/négatifs, scan-z jamais
autorisé à créer de mouvement, clé d'idempotence par mouvement).

### Étape manuelle Notion requise avant mise en production

Ce correctif ajoute deux propriétés à des bases **existantes** (aucune
nouvelle base Notion) :

| Base | Nouvelle propriété | Type |
|---|---|---|
| Stock (`DB.STOCK`) | `Applied_Receipts_Ledger` | Rich text |
| Commandes fournisseurs / BESOINS (`DB.BESOINS`) | `Receiving_Ledger` | Rich text |

Tant que ces deux propriétés n'existent pas réellement dans Notion, toute
écriture qui les référence échoue avec une erreur Notion 400 explicite (pas
un échec silencieux) — à créer manuellement avant le premier déploiement de
ce correctif, exactement comme les propriétés ajoutées par le PR4/scan-z.

### Script de pointages mis en quarantaine

`create_pointages.js` (racine, non suivi par git) écrivait directement dans
la base Pointages de production avec l'id de base codé en dur (identique à
`DB.POINTAGES`), sans lien avec `/api/clock`. Il a été déplacé vers
`scripts/manual-migrations/backfill-pointages-2026-06.js` : id de base
requis via variable d'environnement dédiée (jamais réutilisé en dur),
dry-run par défaut, écriture réelle seulement avec `--confirm`. Voir
`scripts/manual-migrations/README.md`. Aucune donnée Pointages de
production n'a été modifiée par ce travail.

## Architecture cleanup — Phase 1 (consolidation des écritures, pas de changement métier)

Suite à l'Architecture Ownership Audit, cette phase consolide les
implémentations d'écriture dupliquées identifiées pour Supplier Orders,
Ingredients, Staff, Suppliers et le bootstrap de ligne Stock. **Cette phase
change l'architecture du code, pas le comportement métier** : mêmes champs,
mêmes statuts, mêmes règles de blocage, mêmes flux UI. Un bug réel a été
corrigé au passage (ci-dessous), documenté explicitement plutôt que noyé
dans le reste.

### Prérequis schéma Notion — vérifié avant implémentation

Les deux propriétés requises par le "Stock safety patch" (voir plus haut)
ont été vérifiées en direct sur l'espace de travail Notion de production,
avec une autorisation explicite limitée à cette seule opération de schéma
(lecture du schéma + création de propriété uniquement — aucune ligne créée,
aucune quantité modifiée, aucune autre base touchée) :

| Base | Propriété | Résultat |
|---|---|---|
| STOCK (`DB.STOCK`) | `Applied_Receipts_Ledger` (rich_text) | Absente → créée → **vérifiée présente, type rich_text** |
| BESOINS (`DB.BESOINS`) | `Receiving_Ledger` (rich_text) | Absente → créée → **vérifiée présente, type rich_text** |

Toute la suite de cette phase (implémentation, tests) s'est ensuite
déroulée exclusivement contre l'infrastructure Notion mockée — aucun autre
appel Notion ou Anthropic en direct.

### Propriétaire canonique par domaine

| Domaine | Base | Service canonique | Adaptateurs (délèguent, ne dupliquent plus) |
|---|---|---|---|
| Supplier Orders | BESOINS | `lib/ops/supplier-orders-service.js` | `app/api/supplier-orders` (POST/PATCH), `app/api/orders/send` (POST) |
| Ingredient Catalogue | INGREDIENTS | `lib/ops/ingredients-service.js` | `app/api/settings/products` (POST/PATCH/DELETE — seule route utilisée par l'UI), `app/api/products/create`, `app/api/products/update`, `app/api/settings` (resource=products) |
| Staff | STAFF | `lib/ops/staff-service.js` | `app/api/settings/staff` (GET/POST/PATCH/DELETE — seule route utilisée par l'UI), `app/api/settings` (resource=staff) |
| Suppliers | FOURNISSEURS | `lib/ops/suppliers-service.js` | `app/api/settings/suppliers` (GET/POST/PATCH/DELETE — seule route utilisée par l'UI), `app/api/settings` (resource=suppliers) |
| Stock-row bootstrap | STOCK (création uniquement, jamais la quantité d'une ligne existante) | `lib/stock/ensure-stock-row.js` | Appelé par `lib/ops/ingredients-service.js` (création d'ingrédient), `app/api/admin/sync-stock` (backfill), `lib/stock/apply-addition.js` (réception d'un ingrédient encore inconnu du Stock) |

### Bug corrigé : `Quantité suggérée` sur `/api/orders/send`

`/api/orders/send` écrivait `groupItems.length` (nombre d'articles distincts
dans le panier groupé par fournisseur) au lieu de la quantité réellement
commandée. La règle canonique, désormais unique dans
`lib/ops/supplier-orders-service.js::createSupplierOrder`, est : `Quantité
suggérée`/`Unité` ne sont renseignées QUE pour une commande à un seul
article et hors source groupée ("Commandes"/"Composer" ne les renseigne
jamais, quel que soit le nombre d'articles — règle inchangée, basée sur la
source, pas sur le nombre d'articles). Pour un groupe à un seul article, la
valeur écrite est maintenant la quantité réelle de cet article.

### Différences de comportement identifiées et comment elles ont été traitées

- **`/api/products/update` avait un mode "full overwrite"** (efface
  `Fournisseur par defaut` si aucun fournisseur ne se résout, écrit tous les
  champs même absents) alors que `/api/settings/products` (la seule route
  réellement utilisée par l'UI) fait une **mise à jour partielle** (un champ
  omis reste inchangé). Les deux comportements sont préservés explicitement
  via un paramètre `mode: 'partial' | 'full'` sur le service partagé — pas
  unifiés silencieusement, puisque `/api/products/update` n'est appelée par
  aucune UI actuelle et qu'on ne peut pas garantir qu'un futur appelant ne
  dépend pas de l'un ou l'autre comportement.
- **`app/api/settings` (route générique) supposait un schéma STAFF erroné**
  (`Rôle` en select, `Téléphone` en rich_text) alors que le schéma réel
  (confirmé par introspection, utilisé par `/api/settings/staff`) est `Rôle`
  en rich_text et `Téléphone` en phone_number. Cette route générique n'étant
  appelée par aucune UI actuelle pour `resource=staff/suppliers/products`
  (`app/page.js` route toujours ces ressources vers les routes dédiées), la
  déléguer au service canonique corrige ce schéma au passage — sans risque,
  puisqu'aucun comportement live n'en dépendait.
- **L'archivage "staff" de la route générique faisait un soft-disable**
  (`Actif:false`, page conservée) alors que la route dédiée `/api/settings/staff`
  fait un **vrai archivage** Notion. Convergé vers le vrai archivage
  (comportement de la route réellement utilisée) — la route générique étant
  morte, ce choix ne change aucun comportement observé aujourd'hui.
- **`ensureStockRowForIngredient` vérifie l'existence par relation ET par
  nom**, alors que l'ancien `admin/sync-stock` ne vérifiait que la relation
  — un gap qui pouvait, en théorie, créer une ligne Stock dupliquée pour un
  ingrédient déjà présent par nom mais jamais lié par relation. Corrigé par
  construction dans le service partagé.

### Routes conservées mais non appelées par l'UI actuelle (candidates à une suppression future, pas supprimées ici)

`app/api/products/create`, `app/api/products/update`, et les branches
`resource=suppliers|staff|products` de `app/api/settings` (POST) ne sont
appelées par aucun flux actuel de `app/page.js` — confirmé par recherche
exhaustive des points d'appel avant cette consolidation. Elles délèguent
désormais aux mêmes services canoniques plutôt que d'être supprimées
silencieusement, conformément à la consigne de ne retirer une route
qu'après migration ET test de tous les appelants clients — aucun appelant
n'existant aujourd'hui, elles restent en l'état comme filet de sécurité
pour un éventuel appelant externe non documenté.

### Chemins de lecture dupliqués restants (non traités dans cette phase)

- `app/api/settings/referentiels` (+ `/import`) garde ses 4 ids de bases
  codés en dur, indépendants de `DB` — hors périmètre nommé de cette phase
  (ni Supplier Orders, ni Ingredients/Staff/Suppliers, ni Stock-row
  bootstrap). Candidat pour une Phase 2 "Configuration and Mappings".
- `WEBSITE_PRODUCTS`/`CATEGORIES_WEBSITE`/`PROMOS` n'ont toujours aucun
  chemin d'écriture en application (seulement `migration-shopify/`) — non
  traité ici, hors périmètre.

### Ce qui N'A PAS changé (rappel explicite)

Stock Movements n'est pas implémenté ; aucune déduction automatique de
stock depuis une vente POS ; aucune UI redessinée ; aucune base Notion
créée au-delà des deux propriétés explicitement autorisées ; les bases
analytiques de l'importateur (Daily Operations, Payment Methods, Product
Sales, Sales Categories, Import Runs) ne sont ni lues ni écrites par cette
phase ; le comportement scan-z v3 est inchangé ; les flux commander/
customer-order sont inchangés.

## Recipe Catalogue foundation (lib/recipes) — **LIVE**

Fondation du domaine "recette" — connecte les produits vendus à leur
composition en ingrédients, préalable nécessaire à un futur Stock
Movements. **Ne modifie ni ne lit jamais Current Stock.**

**Statut : les deux bases Notion sont créées et configurées en production.**
`lib/recipes/config.js` résout désormais `NOTION_SOLD_PRODUCTS_DB_ID` et
`NOTION_RECIPE_LINES_DB_ID` (renseignées dans `.env.local`, jamais commitées
— `.env.example` reste volontairement vide, comme pour les 5 bases de
l'importateur, pour que chaque environnement configure ses propres ids).

| Base live | Nom Notion | Page parente | Rôle |
|---|---|---|---|
| Sold Product Catalogue | **MÖKA Sold Products** | Page "Recettes" (workspace MÖKA) | `lib/recipes/sold-products-service.js` |
| Recipe Lines | **MÖKA Recipe Lines** | Page "Recettes" (même page, à côté de l'ancien `MOKA_Recettes`) | `lib/recipes/recipes-service.js` |

### Bases existantes découvertes en direct — pourquoi elles n'ont pas été réutilisées

L'inspection live (recherche Notion, cette tâche) a révélé **deux bases
recette déjà existantes et non documentées dans le code** :
`MOKA_Recettes` (le vrai `RECETTES_DB`, déjà peuplé — 5+ lignes réelles :
`Plat` title, `Ingredient`/`Menu_lie` relations, `Quantite`, `Unite`) et
`MOKA_Preps_Recettes` (recettes de *préparations* internes — un concept
adjacent mais distinct : composition d'une préparation, pas d'un produit
vendu — piste d'intégration future, hors périmètre ici). Ni l'une ni
l'autre ne satisfont le schéma requis sans renommer chaque propriété et
répointer la relation principale vers une base différente — une migration
destructrice au sens de la consigne. **Les 5+ lignes existantes de
`MOKA_Recettes` n'ont pas été migrées** — c'est un travail de migration de
données distinct, hors périmètre de cette tâche de configuration de schéma.

`MOKA_Menu_Produits_Complet_V2` (le vrai `MENU_DB`) s'est révélée être une
base riche et activement utilisée pour la configuration Shopify/menu en
ligne (`Actif_Shopify`, `Prix_EUR`, `Add_ons_possibles`,
`Options_disponibles`) — un domaine différent de "produit vendu ↔ recette"
malgré le nom proche. Aucun champ `product_key` n'y existe. La réutiliser
aurait mélangé deux responsabilités distinctes plutôt que de simplement
compléter un schéma déjà adapté — donc pas réutilisée, conformément à la
même règle.

### Schéma live vérifié

**MÖKA Sold Products** : `Name`(title), `product_key`(rich_text),
`active`(checkbox), `requires_recipe`(checkbox), `category`(select),
`pos_aliases`(rich_text), `yield_unit`(rich_text),
`website_product`(relation → `website-product`/WEBSITE_PRODUCTS).

**MÖKA Recipe Lines** : `Name`(title), `sold_product`(relation → MÖKA Sold
Products), `ingredient`(relation → `MOKA_Ingredients_Master`/INGREDIENTS),
`quantity`(number), `unit`(select : g/kg/ml/l/pièce/unité),
`yield_factor`(number), `active`(checkbox), `notes`(rich_text),
`business_key`(rich_text). Relations vérifiées par re-fetch : les deux
pointent exactement vers les bons `database_id`. Aucun rollup ni formule
réciproque créé — le code n'en lit aucun.

### Vérification de compatibilité live (non destructive)

Exécutée avec les vrais services `lib/recipes/*` contre l'API Notion live
(lecture des catalogues vides, création d'un produit `TEST — Recipe
Catalogue verification` et d'une ligne de recette référençant un
ingrédient réel existant en lecture seule, rejet vérifié d'une ligne active
dupliquée et d'une unité incompatible, calcul de consommation théorique,
puis archivage des deux lignes de test). Confirmé : la page de l'ingrédient
référencé n'a **jamais été modifiée** (comparaison stricte des propriétés
avant/après) ; aucune écriture vers STOCK, Product Sales ou Daily
Operations à aucun moment. Les deux catalogues sont revenus à zéro ligne
active après nettoyage.

### Rapport d'inspection (résumé)

`RECETTES_DB`/`MENU_DB` (jamais câblés dans le code — seul
`create_recettes_notion.js`, script racine non suivi par git, les
référence) ne sont **pas réutilisables tels quels** : schéma réel
invérifiable sans accès Notion live (non autorisé pour cette tâche), et
même le schéma implicite du script de seed n'a ni `product_key`, ni statut
actif/archivé, ni clé métier, ni facteur de perte/rendement — tous requis
par l'architecture cible. `MENU_DB` (famille d'id `36xx512c…`, même lot que
INGREDIENTS/STOCK/PREPS) est distinct de `WEBSITE_PRODUCTS` (famille
`39xx512c…`, catalogue e-commerce Shopify pour `/commander` — `Prix`,
`Variantes`, `Extras`) : aucun recouvrement, deux catalogues différents.

### Propriétaire par domaine

| Domaine | Propriétaire | Notes |
|---|---|---|
| Sold Product Catalogue | `lib/recipes/sold-products-service.js` | Base live **MÖKA Sold Products** (`NOTION_SOLD_PRODUCTS_DB_ID`). `product_key` est la seule clé fiable vers `PRODUCT_SALES.moka_product_key` (chaîne, jamais une relation Notion). |
| Recipe Lines | `lib/recipes/recipes-service.js` | Base live **MÖKA Recipe Lines** (`NOTION_RECIPE_LINES_DB_ID`). Une ligne par ingrédient (relationnel, jamais un blob JSON) — plusieurs lignes actives par produit, au plus une ligne active par couple (produit, ingrédient) — `business_key` stocké pour audit, la garde anti-doublon réelle se fait par requête. |
| Validation | `lib/recipes/validation.js` | Produit/ingrédient manquant, quantité ≤ 0, ligne active dupliquée, unités incompatibles, ingrédient archivé — bloque l'écriture. Complétude de recette = calculée, jamais stockée/mise en cache (évite toute dérive). |
| Product Mapping | `lib/recipes/product-mapping-service.js` | Lecture seule sur PRODUCT_SALES — ne devine jamais un mapping absent ; une vente non mappée reste explicitement non mappée. |
| Conversion d'unités | `lib/recipes/units.js` | 3 familles seulement : masse (g/kg), volume (ml/l), compte (pièce/unité). Conversion refusée (jamais silencieuse) entre familles ou pour une unité inconnue. |
| Consommation théorique | `lib/recipes/consumption-service.js` | Pur — aucun accès Notion, aucune écriture. `quantité vendue × quantité recette × facteur de perte`, converti dans l'unité de stock de l'ingrédient quand connue, sinon signalé `unresolvedUnit`. |

### Relation avec INGREDIENTS / WEBSITE_PRODUCTS / PRODUCT_SALES

- **INGREDIENTS** reste l'unique source de vérité ingrédient — les
  services `lib/recipes/*` ne font que le **lire** (`getPage`/
  `queryDatabase`), jamais créer ni modifier un ingrédient.
- **WEBSITE_PRODUCTS** reste le catalogue e-commerce `/commander` — une
  relation `website_product` optionnelle existe sur un produit vendu, mais
  ce n'est jamais la clé de jointure ni un champ obligatoire.
- **PRODUCT_SALES** reste analytique et propriété exclusive de
  l'importateur — `lib/recipes/product-mapping-service.js` le lit en
  lecture seule via `moka_product_key`, n'y écrit jamais.

### Ce qui N'A PAS changé (rappel explicite)

Stock Movements n'est pas implémenté ; aucune quantité Current Stock n'est
jamais lue ni modifiée par `lib/recipes/**` (vérifié par un test structurel
qui scanne le code source, pas seulement par le comportement observé, ET
par une vérification live confirmant qu'un ingrédient référencé n'est
jamais modifié) ; aucune déduction automatique depuis une vente POS ; scan-z
reste totalement exclu (aucune référence, vérifié par le même test
structurel) ; l'importateur (PR1-PR4, scan-z v3) est inchangé — Product
Sales n'a été ni lu ni écrit par cette tâche, seules les deux nouvelles
bases recette et un ingrédient existant (lecture seule) ont été touchés en
direct ; la navigation principale n'a pas été redessinée (le panneau
Recettes est un tiroir dans Paramètres, pas une nouvelle icône de barre de
navigation).

## Recipe Data Population & Product Mapping

Peuplement réel du Recipe Catalogue à partir des données existantes —
migration read-only-sur-les-sources, écritures uniquement dans **MÖKA Sold
Products** et **MÖKA Recipe Lines**. Aucune base legacy modifiée.

### Sources de migration (lues, jamais modifiées)

| Base | Rôle dans la migration |
|---|---|
| `MOKA_Recettes` (53 lignes) | Source des lignes de recette legacy — un `Menu_lie` (relation directe) rattache chaque ligne à un plat |
| `MOKA_Menu_Produits_Complet_V2` (95 lignes) | Source du nom canonique, de la catégorie, et de l'ancrage "ce plat existe vraiment" |
| `MOKA_Ingredients_Master` (210 lignes) | Résolution des ingrédients — aucune correspondance approximative acceptée |
| `website-product` (57 lignes) | Cross-référence optionnelle `website_product`, par nom uniquement |
| `PRODUCT_SALES` (importateur) | **N'existe pas encore dans ce workspace** — aucune des 5 bases pilotage de l'importateur (Import Runs, Daily Operations, Payment Methods, Product Sales, Sales Categories) n'a jamais été créée en direct ; confirmé par recherche Notion live. L'audit de couverture PRODUCT_SALES (Phase 7) rapporte donc 0 produit distinct — pas une erreur, un état réel constaté. |

### Règles de correspondance et seuils de confiance

- **Recette → produit vendu** : toujours `exact`, car dérivée d'une relation Notion directe (`Menu_lie`), jamais d'une comparaison de noms.
- **Produit vendu → Website Product** (optionnel) : comparaison de noms normalisés (`lib/recipes/normalization.js` — accents, casse, ponctuation) via `lib/recipes/mapping-confidence.js`. Seuls `exact`/`high` sont écrits automatiquement ; `medium`/`low`/`unmapped` restent non écrits.
- **Seuil d'arrêt** : au-delà de 20 % de propositions medium/low, la migration s'arrête avant toute écriture. Résultat réel : 0 %.
- **Ingrédient introuvable** : la ligne est exclue et rapportée, jamais devinée ni créée automatiquement dans INGREDIENTS.
- **Unités incompatibles** : rejetées à l'écriture par la validation déjà existante (`lib/recipes/validation.js`), jamais converties silencieusement.

### Résultat de la migration (exécutée en direct, idempotente, vérifiée par un second run à vide)

- 53 lignes `MOKA_Recettes` → 7 lignes vides/corrompues (`INVALID`), 46 lignes réelles réparties sur 7 plats.
- 7 **MÖKA Sold Products** créés (confiance exacte) : `smashed-avocado`, `classic-bun`, `burrito-breakfast`, `lox-bagel`, `french-toast`, `mokas-caesar`, `mango-carpaccio`.
- 36 **MÖKA Recipe Lines** créées. 10 lignes exclues au total :
  - 4 ingrédients introuvables dans INGREDIENTS ("Dukkah", "Haricots", "Capres crispy", "Fromage à tartiner") — aucun équivalent, même approximatif, dans les 210 ingrédients actuels.
  - 6 rejetées pour **incompatibilité d'unité** entre la recette et le stock de l'ingrédient : "Citron vert / lime" et "Citron jaune / lemon" sont mesurés en `ml` (jus) dans la recette mais stockés en `pièce`/`kg` (fruit entier) ; "Chou rouge" mesuré en `g` mais stocké en `pièce`. Décision métier requise (mesurer le jus différemment, ou changer l'unité de stock) — non tranchée ici.
- **Note de transparence** : le script de migration ne pré-valide que { ingrédient résolu, quantité > 0, unité reconnue } avant écriture — la vérification fine de compatibilité d'unité (contre l'unité de stock réelle de l'ingrédient) n'est faite qu'une fois, dans `lib/recipes/validation.js`, au moment de l'écriture réelle via `recipesService.createRecipeLine` — jamais dupliquée dans le script. C'est pourquoi l'aperçu à sec annonçait 42 lignes valides mais seules 36 ont été effectivement créées ; les 6 restantes ont été correctement rejetées par la même validation qui protège l'application en production.
- Découverte incidente : le nom "BURITO BREAKFAST" dans `website-product` contient une faute de frappe (une lettre "R" manquante), ce qui a fait chuter sa correspondance avec "Burrito Breakfast" à `medium` plutôt qu'`exact` — correctement laissé non lié plutôt que deviné. `WEBSITE_PRODUCTS` étant en lecture seule pour cette tâche, la faute n'a pas été corrigée.
- 88 des 95 entrées de `MOKA_Menu_Produits_Complet_V2` n'ont aucune recette associée — décision explicite de ne PAS les créer automatiquement comme Sold Products cette phase (mélange hétérogène de vraies entrées Food/Dessert, d'options de personnalisation ("Option Sirop…", "Option Lait…") et de menus enfants composites — aucun signal fiable pour juger `requires_recipe`/`category` en masse sans revue humaine). Liste en file d'attente pour une revue manuelle future.
- `MOKA_Preps_Recettes` (1 ligne, entièrement vide) inspectée — aucune donnée réelle de préparation à séparer aujourd'hui ; le futur modèle "Prep Recipe" (recette d'une préparation interne réutilisée par plusieurs recettes de produit vendu) n'existe pas encore et le modèle actuel `Recipe Lines` (relation directe à INGREDIENTS uniquement) ne peut pas représenter une dépendance récursive recette→préparation→ingrédient — non implémenté, hors périmètre.
- Vérifié en direct : `MOKA_Recettes` inchangé (53 lignes avant/après), aucune écriture vers STOCK/PRODUCT_SALES/Daily Operations, aucune ligne active dupliquée, 3 aperçus de consommation théorique calculés correctement sur les données réelles.

### Prérequis restant avant Stock Movements

Le Recipe Catalogue est maintenant peuplé avec des données réelles pour 7
produits vendus, mais reste **partiel** : (1) 88 des 95 produits du menu
interne n'ont ni Sold Product ni recette — file d'attente de revue
manuelle ; (2) 10 lignes de recette identifiées mais non écrites (4
ingrédients introuvables à créer/renommer dans INGREDIENTS, 6 incompatibilités
d'unité à trancher côté métier) ; (3) aucune vente AddicTill réelle n'existe
encore dans ce workspace (`PRODUCT_SALES` inexistant), donc la connexion
"vente réelle → produit vendu → recette → consommation" ne peut pas encore
être vérifiée de bout en bout avec des données de vente authentiques —
seuls des aperçus de consommation théorique à quantité hypothétique ont pu
être calculés. Stock Movements nécessitera, dans cet ordre : un premier
import AddicTill réel (pour peupler `PRODUCT_SALES` et
`lib/importer/config/product-mapping.json`), puis la résolution des 88
produits en attente, puis la résolution des 10 lignes en attente.

## PR restantes (rappel)

- **PR2A — Parseur bancaire** ✅ fait (ce document) : moteur générique +
  profil `credit_mutuel` **calibré sur 3 relevés réels** (EUR, 397
  transactions), validation, aperçu dry-run. Pas de registre écrit, pas de
  déplacement, pas de Notion. Encore non vérifié : compte USD, relevé en
  découvert (`SOLDE DEBITEUR`).
- **PR2B (à valider)** : `dedupe.js` (import_key bancaire côté Notion),
  écriture du registre, déplacement des fichiers traités. Idéalement avec
  un exemple USD et un exemple en découvert pour lever les deux inconnues
  restantes du profil `credit_mutuel`.
- **PR3 — AddicTill** ✅ fait (ce document) : `pos-addictill.js` (synthèse
  quotidienne + palmarès produits, calibré sur 2+1 fichiers réels),
  `recipe-mapping.js` (Product Mapping exact uniquement), aperçu dry-run.
  Aucune écriture Notion, aucun accès Kamo AI, aucun décrément de stock.
  Schéma de pilotage documenté (pas codé en Zod) — à valider et implémenter
  en PR4. Pas de parseur L'Addition (aucun fichier réel disponible).
- **PR3B (à valider, hors scope actuel)** : Recipes + Recipe Lines (aucune
  des deux n'existe), calcul de consommation d'ingrédients, décrément de
  stock — nécessite d'abord que le schéma "Recipes"/"Recipe Lines" soit
  conçu et validé, puis un vrai fichier L'Addition pour le parseur restant.
- **PR4 — Notion et interface MÖKA OS** ✅ fait, avec son addendum audit
  trail ✅ fait (voir "PR4 — Intégration Notion et interface MÖKA OS" et
  "Audit trail vs. déduplication métier" plus haut) : `notion-client.js`
  (API classique 2022-06-28), `repository.js`/`schema.js` (lecture seule),
  `commit-pipeline.js` partagé CLI + web, upsert idempotent par clé métier,
  Import Runs comme historique d'audit complet (statuts
  `preview`/`committed`/`failed`/`partial_failure`/`retry`, compteur de
  tentatives, lien vers la tentative précédente, raison d'échec,
  `parser_version` réellement persisté par parseur), déduplication métier
  séparée (basée sur "au moins un run `committed`", jamais le premier trouvé),
  Basic Auth, `/imports` + `/api/imports/*`, `--commit`/`--establishment`/
  `--yes`, `npm run importer:schema:check` (lecture seule). `importer:schema:sync`
  reste hors périmètre — voir "Hors périmètre PR4". La feuille de route de
  l'importateur asynchrone (BullMQ/Redis/workers) est documentée mais
  **non implémentée** — voir "Feuille de route — Importateur asynchrone".
- **PR5 — Stabilisation (à définir)** : `importer:schema:sync` si souhaité
  (création/migration de schéma, approbation et audit trail séparés) ;
  remplacement de l'allowlist Établissements par une vraie base Notion ;
  migration éventuelle vers le modèle Data Source de Notion ; Recipes/Recipe
  Lines/décrément de stock (PR3B) ; parseur L'Addition (aucun fichier réel
  disponible à ce jour) ; documentation finale, tests end-to-end,
  nettoyage. Risques connus non résolus : le profil bancaire
  `credit_mutuel` reste non vérifié sur un compte USD ou un relevé en
  découvert (voir PR2A) ; le calcul de "période" pour le palmarès produits
  reste manuel (`--period-start`/`--period-end`, jamais déduit).

Ne pas commencer une PR sans validation explicite de la précédente.
