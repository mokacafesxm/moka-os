export async function POST(req) {
  try {
    const { imageBase64, mediaType } = await req.json();
    if (!imageBase64) return Response.json({ error: "Image manquante" }, { status: 400 });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType || "image/jpeg",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `Tu es un assistant de restaurant. Analyse ce Z de caisse et extrais toutes les ventes.
Réponds UNIQUEMENT en JSON valide, sans texte avant ou après, avec cette structure exacte :
{
  "date": "date du Z si visible, sinon null",
  "total_ventes": nombre total en euros si visible sinon null,
  "nb_transactions": nombre de transactions si visible sinon null,
  "produits": [
    {
      "nom": "nom exact du produit tel qu'il apparaît sur le Z",
      "quantite": nombre vendu (integer),
      "prix_unitaire": prix unitaire en euros si visible sinon null,
      "total": total en euros pour ce produit si visible sinon null,
      "categorie": "Food" ou "Beverage" ou "Autre" selon le contexte
    }
  ],
  "resume": "résumé en 1-2 phrases de ce Z de caisse"
}
Si tu ne peux pas lire certaines informations, mets null. Ne jamais inventer de données.`,
            },
          ],
        }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("[scan-z] Erreur Claude:", JSON.stringify(data));
      return Response.json({ error: data.error?.message || "Erreur API" }, { status: 500 });
    }

    const text = data.content?.[0]?.text || "";
    let parsed;
    try {
      const clean = text.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error("[scan-z] Parse JSON échoué:", text);
      return Response.json({ error: "Impossible de parser la réponse", raw: text }, { status: 500 });
    }

    return Response.json({ success: true, data: parsed });
  } catch (err) {
    console.error("[scan-z] Exception:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
