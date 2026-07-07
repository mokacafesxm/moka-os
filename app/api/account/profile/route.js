import { corsHeaders } from "../../_notion";
import { getPhoneFromRequest } from "../../_session";
import { findClientByPhone, updateClientProfile } from "../../_clients";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET(request) {
  try {
    const phone = getPhoneFromRequest(request);
    if (!phone) return Response.json({ error: "Non connecté." }, { status: 401, headers: corsHeaders });

    const client = await findClientByPhone(phone);
    if (!client) return Response.json({ error: "Session invalide, reconnecte-toi." }, { status: 401, headers: corsHeaders });

    return Response.json(
      { prenom: client.prenom || "", nom: client.nom || "", email: client.email || "", telephone: client.telephone },
      { headers: corsHeaders }
    );
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

// Phone is deliberately not editable here — it's the login identifier, so
// changing it would need a separate SMS re-verification flow. Email is
// optional (the app never requires it; the phone is the identity).
export async function POST(request) {
  try {
    const phone = getPhoneFromRequest(request);
    if (!phone) return Response.json({ error: "Non connecté." }, { status: 401, headers: corsHeaders });

    const client = await findClientByPhone(phone);
    if (!client) return Response.json({ error: "Session invalide, reconnecte-toi." }, { status: 401, headers: corsHeaders });

    const { prenom, nom, email } = await request.json();
    if (!prenom?.trim()) {
      return Response.json({ error: "Le prénom est requis." }, { status: 400, headers: corsHeaders });
    }
    const cleanEmail = (email || "").trim();
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return Response.json({ error: "Adresse email invalide." }, { status: 400, headers: corsHeaders });
    }

    await updateClientProfile(client.id, { prenom: prenom.trim(), nom: (nom || "").trim(), email: cleanEmail });
    return Response.json({ prenom: prenom.trim(), nom: (nom || "").trim(), email: cleanEmail }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
