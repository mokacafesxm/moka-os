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
            { type: "text", text: `Tu es un assistant pour un café-restaurant à Saint-Martin (Antilles).
Analyse cette facture et extrait TOUS les produits.

Liste de nos produits en stock (noms français) :
${limitedStockNames.join(", ")}

RÈGLES DE MATCHING STRICTES :
- Cherche toujours un équivalent dans notre stock
- Traduis si nécessaire : blueberries→Myrtilles, pineapple→Ananas, strawberries→Fraises fraîches, mango→Mangue, passion fruit→Fruit de la passion, watermelon→Pastèque, banana→Banane, lime→Citron vert, lemon→Citron jaune, avocado→Avocat, spinach→Épinards, eggs→Oeufs, butter→Beurre salé, cream→Crème liquide, milk→Lait entier, cheese→Fromage, beef→Boeuf, chicken→Poulet, salmon→Saumon, tuna→Thon, shrimp→Crevettes, flour→Farine, sugar→Sucre, olive oil→Huile d'olive, salt→Sel
- Si le nom sur la facture correspond à un produit du stock même approximativement → mets confidence "high"
- Si traduction probable → confidence "medium"
- Si vraiment aucun match → name_stock: null, confidence "low"

Réponds UNIQUEMENT en JSON :
[{
  "name_facture": "nom sur facture",
  "name_stock": "nom exact dans notre liste ou null",
  "quantite": nombre,
  "unite": "kg|g|L|ml|pièce|sachet|carton",
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
