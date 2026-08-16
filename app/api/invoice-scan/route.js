import { corsHeaders } from "../_notion";
import { extractInvoiceLines } from "../_invoice_vision";
import { persistPriceLine } from "../_ingredient_matching";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Flux automatique déclenché juste après une réception (voir
// LivraisonsAujourdhuiCard) — le client n'attend JAMAIS cette réponse : il
// lance l'appel et ferme son écran tout de suite (la requête tourne quand
// même à son rythme côté serveur, indépendamment de si le client écoute la
// réponse). Extraction Vision + écriture (matching + garde-fou écart de
// prix, voir persistPriceLine) dans le même appel serveur, sans relecture
// humaine avant écriture — toute correction se fait après coup dans la file
// "Factures à valider" de /rapports. Voir /api/scan-facture pour l'ancien
// flux manuel avec relecture (toujours disponible, séparé).
//
// Dette connue (actée, pas à corriger maintenant) : pas de retry/queue ici —
// si cet appel échoue silencieusement (timeout, réseau), la ligne n'atterrit
// jamais dans "à valider" et personne ne le sait. Acceptable pour ce volume
// d'usage, à réévaluer si le volume de scans augmente.
export async function POST(request) {
  try {
    const { base64, mediaType, fournisseur, date, numeroFacture } = await request.json();
    if (!base64) {
      return Response.json({ error: "base64 (image) requis" }, { status: 400, headers: corsHeaders });
    }

    const extracted = await extractInvoiceLines(base64, mediaType);
    const produits = Array.isArray(extracted?.produits) ? extracted.produits : [];

    let count = 0;
    for (const p of produits) {
      const id = await persistPriceLine({
        nom: p.nom,
        fournisseur: fournisseur || extracted.fournisseur || "",
        prix_unitaire: p.prix_unitaire,
        quantite: p.quantite,
        unite: p.unite,
        date: date || extracted.date || undefined,
        source: "facture",
        numero_facture: numeroFacture || "",
      });
      if (id) count++;
    }

    return Response.json({ success: true, count }, { headers: corsHeaders });
  } catch (err) {
    console.error("[invoice-scan]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
