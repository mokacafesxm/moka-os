import { corsHeaders, updatePage, checkboxProp, textProp } from "../../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// One device confirms it saw the new order → every other device's alert
// (popup + looping sound) clears on its next /api/orders/pending tick.
export async function POST(request) {
  try {
    const { orderId, deviceName } = await request.json();
    if (!orderId) {
      return Response.json({ error: "orderId requis" }, { status: 400, headers: corsHeaders });
    }

    await updatePage(orderId, {
      "Accusé réception": checkboxProp(true),
      "Accusé par": textProp(deviceName || "Appareil inconnu"),
    });

    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
