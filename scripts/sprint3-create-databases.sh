#!/usr/bin/env bash
# Sprint 3 — creates the 3 priority MOKA OS v2 Notion databases via the
# Notion API. Run manually, in order, from a shell where NOTION_API_KEY and
# PARENT_PAGE_ID are exported first — this script is NOT executed by Claude.
#
# PARENT_PAGE_ID: an existing Notion page shared with your integration
# (Notion's API cannot create a page at the workspace root — see setup
# below). Create an empty page in Notion, share it with your integration
# (••• menu > Connections > your integration), then export its ID here.
#
#   export NOTION_API_KEY="secret_xxx"
#   export PARENT_PAGE_ID="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
#
# Each block below prints the created database's id. Export it into the
# next block's env var before running it — MOKA_Equipements and
# MOKA_Taches both relate to MOKA_Zones_Physiques.

set -euo pipefail

: "${NOTION_API_KEY:?export NOTION_API_KEY first}"
: "${PARENT_PAGE_ID:?export PARENT_PAGE_ID first (see comment above)}"

NOTION_VERSION="2022-06-28"

# ── 1. MOKA_Zones_Physiques ──────────────────────────────────────────────
# Run this first. Copy the returned "id" into ZONES_DB_ID before running
# the next two blocks (they relate to this database).

curl -s -X POST "https://api.notion.com/v1/databases" \
  -H "Authorization: Bearer ${NOTION_API_KEY}" \
  -H "Notion-Version: ${NOTION_VERSION}" \
  -H "Content-Type: application/json" \
  -d '{
    "parent": { "type": "page_id", "page_id": "'"${PARENT_PAGE_ID}"'" },
    "title": [{ "type": "text", "text": { "content": "MOKA_Zones_Physiques" } }],
    "properties": {
      "Nom":               { "title": {} },
      "Emoji":             { "rich_text": {} },
      "Responsable_Poste": { "select": { "options": [
        { "name": "Manager" }, { "name": "Barista" }, { "name": "Cuisine" },
        { "name": "Serveur" }, { "name": "Runner" }, { "name": "Plonge" }
      ] } },
      "Actif":       { "checkbox": {} },
      "Ordre":       { "number": {} },
      "Description": { "rich_text": {} }
    }
  }' | tee /tmp/moka-zones-physiques.json

echo
echo "▲ Copie le champ \"id\" ci-dessus dans: export ZONES_DB_ID=\"...\""
echo

# ── 2. MOKA_Equipements ──────────────────────────────────────────────────
# Requires: export ZONES_DB_ID="<id returned above>"

: "${ZONES_DB_ID:?export ZONES_DB_ID with the id returned by block 1 first}"

curl -s -X POST "https://api.notion.com/v1/databases" \
  -H "Authorization: Bearer ${NOTION_API_KEY}" \
  -H "Notion-Version: ${NOTION_VERSION}" \
  -H "Content-Type: application/json" \
  -d '{
    "parent": { "type": "page_id", "page_id": "'"${PARENT_PAGE_ID}"'" },
    "title": [{ "type": "text", "text": { "content": "MOKA_Equipements" } }],
    "properties": {
      "Nom":         { "title": {} },
      "Zone":        { "relation": { "database_id": "'"${ZONES_DB_ID}"'", "single_property": {} } },
      "Marque":      { "rich_text": {} },
      "Modele":      { "rich_text": {} },
      "Numero_Serie":{ "rich_text": {} },
      "Date_Achat":  { "date": {} },
      "Statut": { "select": { "options": [
        { "name": "Actif" }, { "name": "En panne" },
        { "name": "En maintenance" }, { "name": "Retraité" }
      ] } },
      "Criticite": { "select": { "options": [
        { "name": "Critique" }, { "name": "Majeur" },
        { "name": "Modéré" }, { "name": "Mineur" }
      ] } },
      "Dernier_Nettoyage":     { "date": {} },
      "Prochaine_Maintenance": { "date": {} },
      "Notes": { "rich_text": {} }
    }
  }' | tee /tmp/moka-equipements.json

echo
echo "▲ Copie le champ \"id\" ci-dessus si tu veux le référencer ailleurs."
echo

# ── 3. MOKA_Taches ───────────────────────────────────────────────────────
# Requires: export ZONES_DB_ID="<id returned by block 1>" (same as above)

: "${ZONES_DB_ID:?export ZONES_DB_ID with the id returned by block 1 first}"

curl -s -X POST "https://api.notion.com/v1/databases" \
  -H "Authorization: Bearer ${NOTION_API_KEY}" \
  -H "Notion-Version: ${NOTION_VERSION}" \
  -H "Content-Type: application/json" \
  -d '{
    "parent": { "type": "page_id", "page_id": "'"${PARENT_PAGE_ID}"'" },
    "title": [{ "type": "text", "text": { "content": "MOKA_Taches" } }],
    "properties": {
      "Nom":  { "title": {} },
      "Zone": { "relation": { "database_id": "'"${ZONES_DB_ID}"'", "single_property": {} } },
      "Poste": { "select": { "options": [
        { "name": "Manager" }, { "name": "Barista" }, { "name": "Cuisine" },
        { "name": "Serveur" }, { "name": "Plonge" }
      ] } },
      "Frequence": { "select": { "options": [
        { "name": "À chaque service" }, { "name": "Quotidien" },
        { "name": "Hebdomadaire" }, { "name": "Mensuel" }
      ] } },
      "Moment": { "select": { "options": [
        { "name": "Ouverture" }, { "name": "Pendant service" },
        { "name": "Fermeture" }, { "name": "Planifié" }
      ] } },
      "Priorite": { "select": { "options": [
        { "name": "Critique" }, { "name": "Haute" },
        { "name": "Normale" }, { "name": "Basse" }
      ] } },
      "Necessite_Photo":       { "checkbox": {} },
      "Necessite_Temperature": { "checkbox": {} },
      "Description": { "rich_text": {} },
      "SOP_Lien": { "url": {} },
      "Actif": { "checkbox": {} }
    }
  }' | tee /tmp/moka-taches.json
