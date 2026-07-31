import Anthropic from "@anthropic-ai/sdk";
import { corsHeaders } from "../_notion";

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

const EXTRACTION_PROMPT = `Tu es un assistant de restaurant. Analyse cette facture fournisseur
et extrais uniquement les produits avec leurs prix unitaires et totaux.
Réponds UNIQUEMENT en JSON :
{
  "fournisseur": "nom du fournisseur si visible",
  "date": "date de la facture YYYY-MM-DD si visible",
  "produits": [
    { "nom": "nom exact du produit", "quantite": nombre, "unite": "kg/L/pièce",
      "prix_unitaire": nombre, "prix_total": nombre, "devise": "EUR" }
  ],
  "total_facture": nombre ou null
}
Si tu ne peux pas lire une valeur, mets null. Ne jamais inventer.`;

// Extraction de PRIX uniquement — jamais le stock (voir receiveModal/
// /api/analyze-invoice pour le flux stock existant, totalement séparé).
// N'écrit rien dans Notion : le résultat est renvoyé pour vérification/
// édition côté client, la persistance se fait via POST /api/prix-ingredients
// une fois l'utilisateur satisfait de l'extraction.
export async function POST(request) {
  try {
    const { base64, mediaType } = await request.json();
    if (!base64) {
      return Response.json({ error: "base64 (image) requis" }, { status: 400, headers: corsHeaders });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: base64 } },
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
      return Response.json({ error: "Réponse illisible — réessaie avec une photo plus nette" }, { status: 502, headers: corsHeaders });
    }

    return Response.json(parsed, { headers: corsHeaders });
  } catch (err) {
    console.error("[scan-facture]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
