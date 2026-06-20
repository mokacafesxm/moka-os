const NOTION_KEY = () => process.env.NOTION_API_KEY;
const NOTION_VER = "2022-06-28";
const DB = "36b9512cf66a8069b4b3f0dcf9752892";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const nHeaders = () => ({
  "Authorization": `Bearer ${NOTION_KEY()}`,
  "Notion-Version": NOTION_VER,
  "Content-Type": "application/json",
});

// Schema confirmé par introspection API :
//   Nom        (title)       ← champ titre obligatoire
//   Prénom     (rich_text)   ← prénom affiché
//   Rôle       (rich_text)   ← PAS un select !
//   Téléphone  (phone_number)
//   Email      (email)
//   Actif      (checkbox)
//   Heures semaine (rich_text)
//   Photo      (files)

function mapPage(page) {
  const p = page.properties;
  const prenom = p["Prénom"]?.rich_text?.[0]?.plain_text || "";
  const nom    = p["Nom"]?.title?.[0]?.plain_text || "";
  const display = prenom || nom;
  return {
    id:        page.id,
    nom:       display,
    name:      display,
    prenom:    prenom,
    role:      p["Rôle"]?.rich_text?.[0]?.plain_text || "",
    categorie: p["Rôle"]?.rich_text?.[0]?.plain_text || "",
    telephone: p["Téléphone"]?.phone_number || "",
    email:     p["Email"]?.email || "",
    actif:     p["Actif"]?.checkbox ?? true,
  };
}

function buildProps(data) {
  const prenom = data?.nom || data?.name || data?.prenom || "";
  const props = {
    "Nom":    { title:     [{ text: { content: prenom } }] },
    "Prénom": { rich_text: [{ text: { content: prenom } }] },
    "Rôle":   { rich_text: [{ text: { content: data?.categorie || data?.role || "" } }] },
    "Actif":  { checkbox: data?.actif !== false },
  };
  const tel   = data?.telephone || "";
  const email = data?.email || "";
  if (tel)   props["Téléphone"] = { phone_number: tel };
  if (email) props["Email"]     = { email };
  return props;
}

async function notionQuery() {
  const res = await fetch(`https://api.notion.com/v1/databases/${DB}/query`, {
    method: "POST",
    headers: nHeaders(),
    body: JSON.stringify({ page_size: 200 }),
  });
  if (!res.ok) throw new Error(`Notion query ${res.status}`);
  const data = await res.json();
  return data.results || [];
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  try {
    const pages = await notionQuery();
    return Response.json(pages.map(mapPage), { headers: corsHeaders });
  } catch (err) {
    console.error("[GET staff]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req) {
  try {
    const data = await req.json();
    const properties = buildProps(data);
    console.log("[POST staff] properties:", JSON.stringify(properties));
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: nHeaders(),
      body: JSON.stringify({ parent: { database_id: DB }, properties }),
    });
    const result = await res.json();
    if (!res.ok) {
      console.error("[POST staff] Notion error:", JSON.stringify(result));
      return Response.json({ success: false, error: result.message }, { status: 500, headers: corsHeaders });
    }
    return Response.json({ success: true, id: result.id, item: mapPage(result) }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST staff] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });
    const properties = buildProps(data);
    console.log("[PATCH staff] id:", id, "properties:", JSON.stringify(properties));
    const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: "PATCH",
      headers: nHeaders(),
      body: JSON.stringify({ properties }),
    });
    const result = await res.json();
    if (!res.ok) {
      console.error("[PATCH staff] Notion error:", JSON.stringify(result));
      return Response.json({ success: false, error: result.message }, { status: 500, headers: corsHeaders });
    }
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[PATCH staff] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(req) {
  try {
    const { id } = await req.json();
    if (!id) return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });
    const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: "PATCH",
      headers: nHeaders(),
      body: JSON.stringify({ archived: true }),
    });
    const result = await res.json();
    if (!res.ok) {
      console.error("[DELETE staff] Notion error:", JSON.stringify(result));
      return Response.json({ success: false, error: result.message }, { status: 500, headers: corsHeaders });
    }
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[DELETE staff] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
