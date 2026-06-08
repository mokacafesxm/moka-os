import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request) {
  try {
    const { base64, mediaType, stockNames } = await request.json();
    if (!base64) return NextResponse.json({ error: "No image" }, { status: 400, headers: corsHeaders });
    console.log("API KEY present:", !!process.env.ANTHROPIC_API_KEY);

    // Limiter à 150 noms max pour ne pas dépasser le context
    const limitedStockNames = (stockNames || []).slice(0, 150);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: base64 } },
            { type: "text", text: `Tu es un assistant pour un café-restaurant.
Analyse ATTENTIVEMENT cette facture fournisseur ligne par ligne.

IMPORTANT : tu dois extraire ABSOLUMENT TOUS les produits visibles sur la facture, sans en sauter aucun. Même si tu n'es pas sûr, inclus le produit avec confidence "low".

Voici la liste exacte des produits dans notre stock :
${limitedStockNames.join("\n")}

Pour CHAQUE ligne produit de la facture (pas les totaux, taxes, frais de livraison) :
- Identifie le nom du produit
- Trouve la quantité et l'unité
- Cherche le meilleur match dans notre liste stock (cross-langue : blueberries→Myrtilles, beef→Boeuf, butter→Beurre, eggs→Oeufs, cream→Crème, etc.)

Réponds UNIQUEMENT en JSON valide, sans markdown, sans texte avant ou après :
[
  {
    "name_facture": "Nom exact sur la facture",
    "name_stock": "Nom exact dans notre stock ou null",
    "quantite": 5,
    "unite": "kg",
    "confidence": "high|medium|low"
  }
]

Si une ligne n'a pas de match dans le stock, mets name_stock: null mais inclus quand même la ligne.
Retourne [] seulement si l'image n'est pas une facture.` }
          ]
        }]
      })
    });

    const data = await response.json();
    console.log("Anthropic response status:", response.status);
    console.log("Anthropic data:", JSON.stringify(data).slice(0, 500));
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 500, headers: corsHeaders });

    const text = data.content?.[0]?.text || "[]";
    let parsed;
    try { parsed = JSON.parse(text.replace(/```json|```/g, "").trim()); }
    catch { parsed = []; }

    return NextResponse.json({ results: parsed }, { headers: corsHeaders });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
