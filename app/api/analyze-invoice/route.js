import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { base64, mediaType, stockNames } = await request.json();
    if (!base64) return NextResponse.json({ error: "No image" }, { status: 400 });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: base64 } },
            { type: "text", text: `Tu es un assistant pour un café-restaurant.
Analyse cette facture fournisseur et extrait tous les produits reçus.

Voici la liste exacte des produits dans notre stock :
${stockNames ? stockNames.join("\n") : ""}

Pour chaque produit de la facture, trouve le meilleur match dans notre liste de stock (même si les noms sont différents, ex: "blueberries" → "Myrtilles", "beef" → "Boeuf", "heavy cream" → "Crème liquide").

Réponds UNIQUEMENT en JSON valide, sans markdown :
[
  {
    "name_facture": "Nom exact sur la facture",
    "name_stock": "Nom exact dans notre stock (null si aucun match)",
    "quantite": 5,
    "unite": "kg",
    "confidence": "high|medium|low"
  }
]
Si tu ne vois pas de facture claire, retourne [].` }
          ]
        }]
      })
    });

    const data = await response.json();
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 500 });

    const text = data.content?.[0]?.text || "[]";
    let parsed;
    try { parsed = JSON.parse(text.replace(/```json|```/g, "").trim()); }
    catch { parsed = []; }

    return NextResponse.json({ results: parsed });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
