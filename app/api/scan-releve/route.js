import Anthropic from "@anthropic-ai/sdk";
import { corsHeaders } from "../_notion";
import { detectFileTypeFromBuffer } from "../../../lib/importer/detect";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

const EXTRACTION_PROMPT = `Tu es un assistant comptable de restaurant. Analyse ce relevé bancaire
et extrais toutes les transactions.
Réponds UNIQUEMENT en JSON :
{
  "banque": "nom de la banque",
  "compte": "numéro de compte masqué si visible (ex: ****1234)",
  "periode": { "debut": "YYYY-MM-DD", "fin": "YYYY-MM-DD" },
  "solde_initial": nombre ou null,
  "solde_final": nombre ou null,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "libelle": "libellé exact de la transaction",
      "montant": nombre (positif=crédit, négatif=débit),
      "type": "crédit" ou "débit",
      "categorie": "Fournisseur" ou "Salaires" ou "Charges" ou "Recettes" ou "Autre"
    }
  ],
  "total_credits": nombre,
  "total_debits": nombre
}
Catégoriser automatiquement selon le libellé :
- METRO, DIVICO, fournisseur connu → Fournisseur
- SALAIRE, VIREMENT EMPLOYE → Salaires
- EDF, EAU, LOYER, ASSURANCE → Charges
- CB, TPE, VIREMENT CLIENT → Recettes
- Autre → Autre
Ne jamais inventer de données.`;

// Extraction pour REVUE — n'écrit rien dans Notion (voir POST /api/banque
// pour la persistance après vérification/édition côté client). Route
// distincte de /api/imports/bank (existant, écrit directement sans étape de
// revue, sans catégorisation) : les deux restent indépendantes, toutes deux
// écrivent in fine dans la même base MOKA_Banque.
export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return Response.json({ error: "multipart/form-data attendu" }, { status: 400, headers: corsHeaders });
    }
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return Response.json({ error: "Fichier requis" }, { status: 400, headers: corsHeaders });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detection = detectFileTypeFromBuffer(buffer, file.name || "releve");
    if (detection.file_type !== "pdf" && detection.file_type !== "image") {
      return Response.json({ error: "Format non supporté — JPG, PNG ou PDF attendu" }, { status: 400, headers: corsHeaders });
    }

    const isPdf = detection.file_type === "pdf";
    const base64 = buffer.toString("base64");
    const mediaType = isPdf ? "application/pdf" : detection.mime_type || "image/jpeg";

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            isPdf
              ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
              : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    let parsed;
    try {
      parsed = parseClaudeJson(textBlock ? textBlock.text : "");
    } catch {
      return Response.json({ error: "Réponse illisible — réessaie avec un scan plus net" }, { status: 502, headers: corsHeaders });
    }

    return Response.json(parsed, { headers: corsHeaders });
  } catch (err) {
    console.error("[scan-releve]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
