import { corsHeaders } from "../_notion";
import { extractInvoiceLines } from "../_invoice_vision";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Extraction de PRIX uniquement — jamais le stock (voir ReceiveModal pour le
// flux stock, totalement séparé). N'écrit rien dans Notion : le résultat est
// renvoyé pour vérification/édition côté client, la persistance se fait via
// POST /api/prix-ingredients une fois l'utilisateur satisfait de
// l'extraction. Flux manuel avec relecture — voir /api/invoice-scan pour le
// flux automatique non-bloquant déclenché après réception.
export async function POST(request) {
  try {
    const { base64, mediaType } = await request.json();
    if (!base64) {
      return Response.json({ error: "base64 (image) requis" }, { status: 400, headers: corsHeaders });
    }

    const parsed = await extractInvoiceLines(base64, mediaType);
    return Response.json(parsed, { headers: corsHeaders });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return Response.json({ error: "Réponse illisible — réessaie avec une photo plus nette" }, { status: 502, headers: corsHeaders });
    }
    console.error("[scan-facture]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
