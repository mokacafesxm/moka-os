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
    const contentType = request.headers.get("content-type") || "";
    let base64, mediaType, stockNames;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      base64 = formData.get("base64");
      mediaType = formData.get("mediaType") || "image/jpeg";
      const stockNamesRaw = formData.get("stockNames");
      stockNames = stockNamesRaw ? JSON.parse(stockNamesRaw) : [];
    } else {
      const json = await request.json();
      base64 = json.base64;
      mediaType = json.mediaType || "image/jpeg";
      stockNames = json.stockNames || [];
    }

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
            { type: "text", text: `Tu es un expert en lecture de factures pour un café-restaurant.

Analyse CHAQUE LIGNE de cette facture avec précision.

Nos produits en stock :
${limitedStockNames.join(", ")}

RÈGLE 1 - QUANTITÉ EXACTE :
- Lis le chiffre dans la colonne QTY/Qty/Quantité/Units
- "2 x 5kg" → quantite:10, unite:"kg"
- "1 carton de 12" → quantite:1, unite:"carton"
- Ne jamais mettre 1 par défaut si une quantité est lisible
- LB → kg (÷2.205), OZ → g (×28.35)
- EA/EACH/PC → "pièce", CS/CASE/CTN → "carton"

RÈGLE 2 - MATCHING FRANÇAIS :
blueberries→Myrtilles, pineapple→Ananas, strawberries→Fraises fraîches, mango→Mangue, watermelon→Pastèque, banana→Banane, lime→Citron vert, lemon→Citron jaune, avocado→Avocat, spinach→Épinards, iceberg lettuce→Salade iceberg, red cabbage→Chou rouge, parsley→Persil, carrot→Carotte, beet→Betterave, celery→Céleri, greek yogurt→Yaourt, eggs→Oeufs, butter→Beurre salé, heavy cream→Crème liquide, milk→Lait entier, oat milk→Lait avoine, almond milk→Lait amande, salmon→Saumon, pork→Porc, bacon→Bacon, flour→Farine, sugar→Sucre, olive oil→Huile d'olive, coffee→Café grains, matcha→Matcha poudre, sourdough→Sourdough toast, passion fruit→Fruit de la passion

RÈGLE 3 - CONFIDENCE :
- "high" = match certain dans notre stock
- "medium" = traduction probable
- "low" = aucun équivalent

Réponds UNIQUEMENT en JSON :
[{
  "name_facture": "nom exact sur facture",
  "name_stock": "nom exact dans notre stock ou null",
  "quantite": nombre,
  "unite": "unité",
  "confidence": "high|medium|low"
}]` }
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
