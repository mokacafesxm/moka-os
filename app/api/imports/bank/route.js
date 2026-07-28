import Anthropic from "@anthropic-ai/sdk";
import { DB, corsHeaders, queryDatabase, createPage, getDate, getTitle, getNumber, getSelect, titleProp, dateProp, numberProp, selectProp, textProp } from "../../_notion";
import { detectFileTypeFromBuffer } from "../../../../lib/importer/detect";
import { extractContentFromBuffer } from "../../../../lib/importer/extract";

export const dynamic = "force-dynamic";

const CLAUDE_MODEL = "claude-opus-4-6";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function parseClaudeJson(rawText) {
  const stripped = String(rawText || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(stripped);
}

const EXTRACTION_PROMPT =
  "Tu analyses un relevé bancaire (Crédit Mutuel). Extrais les informations avec précision. " +
  "Ne jamais inventer une valeur illisible — mets null dans ce cas.\n\n" +
  "Réponds UNIQUEMENT en JSON valide, sans texte avant ou après, avec exactement cette structure :\n" +
  "{\n" +
  '  "solde_initial": nombre en euros ou null,\n' +
  '  "solde_final": nombre en euros ou null,\n' +
  '  "transactions": [\n' +
  '    {"date": "YYYY-MM-DD", "libelle": "texte exact du libellé", "montant": nombre positif en euros, "type": "crédit" ou "débit"}\n' +
  "  ]\n" +
  "}";

// Claude Vision extrait les transactions d'un PDF de relevé bancaire —
// jamais réutilisé pour AddicTill (lib/importer/parsers/bank-statement.js
// reste le parseur regex existant, calibré sur de vrais PDF Crédit Mutuel,
// mais n'écrit aujourd'hui aucune ligne de transaction nulle part). Cette
// route est additive : elle persiste les transactions dans une base neuve
// (MOKA_Banque), sans toucher au pipeline pilotage existant.
async function extractViaClaudeVision(buffer, mimeType) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const base64 = buffer.toString("base64");
  const isPdf = mimeType === "application/pdf";

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          isPdf
            ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
            : { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
          { type: "text", text: EXTRACTION_PROMPT },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return parseClaudeJson(textBlock ? textBlock.text : "");
}

function headerIndex(headerRow, candidates) {
  const normalized = headerRow.map((c) => String(c || "").toLowerCase().trim());
  for (const name of candidates) {
    const i = normalized.findIndex((h) => h.includes(name));
    if (i !== -1) return i;
  }
  return -1;
}

// Relevé Excel — pas de vision nécessaire, extraction générique par en-têtes
// (Date/Libellé/Montant) plutôt qu'un mapping figé, les exports bancaires
// variant d'une banque à l'autre.
function extractFromXlsx(extraction) {
  const sheet = extraction.sheets[0];
  if (!sheet || !sheet.rows.length) return { solde_initial: null, solde_final: null, transactions: [] };

  const header = sheet.rows[0];
  const dateIdx = headerIndex(header, ["date"]);
  const libelleIdx = headerIndex(header, ["libell", "description", "intitul"]);
  const montantIdx = headerIndex(header, ["montant", "amount"]);

  const transactions = sheet.rows.slice(1).map((row) => {
    const montantRaw = montantIdx >= 0 ? row[montantIdx] : null;
    const montant = typeof montantRaw === "number" ? montantRaw : parseFloat(String(montantRaw || "0").replace(",", "."));
    return {
      date: dateIdx >= 0 ? row[dateIdx] : null,
      libelle: libelleIdx >= 0 ? String(row[libelleIdx] || "") : "",
      montant: Math.abs(montant || 0),
      type: montant < 0 ? "débit" : "crédit",
    };
  }).filter((t) => t.libelle && t.montant);

  return { solde_initial: null, solde_final: null, transactions };
}

export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return Response.json({ success: false, error: "multipart/form-data attendu" }, { status: 400, headers: corsHeaders });
    }
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return Response.json({ success: false, error: "Fichier requis" }, { status: 400, headers: corsHeaders });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detection = detectFileTypeFromBuffer(buffer, file.name || "releve.pdf");

    let extracted;
    if (detection.file_type === "pdf") {
      extracted = await extractViaClaudeVision(buffer, "application/pdf");
    } else if (detection.file_type === "image") {
      extracted = await extractViaClaudeVision(buffer, detection.mime_type || "image/jpeg");
    } else if (detection.file_type === "xlsx") {
      const extraction = await extractContentFromBuffer(buffer, "xlsx");
      extracted = extractFromXlsx(extraction);
    } else {
      return Response.json({ success: false, error: "Format non supporté — PDF, image ou Excel attendu" }, { status: 400, headers: corsHeaders });
    }

    const transactions = Array.isArray(extracted.transactions) ? extracted.transactions : [];
    const importedAt = new Date().toISOString();

    const created = [];
    for (const t of transactions) {
      if (!t.date || !t.montant) continue;
      const page = await createPage(DB.BANQUE, {
        Libelle: titleProp(t.libelle || "Transaction"),
        Date: dateProp(t.date),
        Montant: numberProp(t.montant),
        Type: selectProp(t.type === "débit" ? "Débit" : "Crédit"),
        Fichier_Nom: textProp(file.name || ""),
        Date_Import: dateProp(importedAt),
      });
      created.push(page.id);
    }

    return Response.json(
      {
        success: true,
        soldeInitial: extracted.solde_initial ?? null,
        soldeFinal: extracted.solde_final ?? null,
        transactionsImportees: created.length,
        transactionsIgnorees: transactions.length - created.length,
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("[POST imports/bank]", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

// Dernier import + solde courant (somme crédits - débits) — alimente le
// badge ManagerHome ET la KPI "Trésorerie".
export async function GET() {
  try {
    const pages = await queryDatabase(DB.BANQUE, null, [{ property: "Date", direction: "descending" }], 500);

    const rows = pages.map((page) => ({
      date: getDate(page.properties, "Date"),
      dateImport: getDate(page.properties, "Date_Import"),
      montant: getNumber(page.properties, "Montant"),
      type: getSelect(page.properties, "Type"),
      libelle: getTitle(page.properties, "Libelle"),
    }));

    const solde = rows.reduce((sum, r) => sum + (r.type === "Débit" ? -r.montant : r.montant), 0);
    const lastImport = rows.reduce((max, r) => (!max || (r.dateImport || "") > max ? r.dateImport : max), null);

    return Response.json({ lastDate: lastImport, solde, count: rows.length }, { headers: corsHeaders });
  } catch (err) {
    console.error("[GET imports/bank]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
