// Extraction Vision d'une facture fournisseur — prix uniquement, jamais le
// stock (voir ReceiveModal pour le stock). Partagé entre /api/scan-facture
// (flux manuel avec relecture) et /api/invoice-scan (flux automatique
// non-bloquant déclenché après réception, sans relecture — voir
// LivraisonsAujourdhuiCard).

import Anthropic from "@anthropic-ai/sdk";

const CLAUDE_MODEL = "claude-opus-4-6";

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

export async function extractInvoiceLines(base64, mediaType) {
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
  return parseClaudeJson(textBlock ? textBlock.text : "");
}
