import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { base64, mediaType } = await request.json();
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
            { type: "text", text: "Tu es un assistant pour un café-restaurant.\nAnalyse cette facture fournisseur et extrait tous les produits reçus.\nRéponds UNIQUEMENT en JSON valide, sans markdown, sans explication :\n[\n  {\"name\": \"Nom exact du produit\", \"quantite\": 5, \"unite\": \"kg\"}\n]\nUnités possibles : kg, g, L, ml, pièce, sachet, carton, bouteille, barquette, boîte.\nSi tu ne vois pas de facture claire, retourne []." }
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
