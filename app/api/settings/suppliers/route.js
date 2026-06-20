const NOTION_KEY = () => process.env.NOTION_API_KEY;
const NOTION_VER = "2022-06-28";
const DB = "3689512cf66a805e8330fe73f781d1a5";

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

// Schema: Fournisseur (title), Catégorie (select), Contact principal (rich_text),
//         Méthode contact (select: WhatsApp|Email), WhatsApp (phone_number),
//         Email (email), Actif (checkbox), Notes (rich_text)

function mapPage(page) {
  const p = page.properties;
  const nom = p["Fournisseur"]?.title?.[0]?.plain_text || "";
  return {
    id:            page.id,
    nom,
    name:          nom,
    fournisseur:   nom,
    categorie:     p["Catégorie"]?.select?.name || "",
    contact:       p["Contact principal"]?.rich_text?.[0]?.plain_text || "",
    methodeContact:p["Méthode contact"]?.select?.name || "",
    telephone:     p["WhatsApp"]?.phone_number || "",
    whatsapp:      p["WhatsApp"]?.phone_number || "",
    email:         p["Email"]?.email || "",
    actif:         p["Actif"]?.checkbox ?? true,
  };
}

function buildProps(data) {
  const props = {
    "Fournisseur": { title: [{ text: { content: data?.nom || data?.name || "" } }] },
    "Actif":       { checkbox: data?.actif !== false },
  };
  if (data?.categorie)
    props["Catégorie"] = { select: { name: data.categorie } };
  if (data?.contact !== undefined)
    props["Contact principal"] = { rich_text: [{ text: { content: data.contact || "" } }] };
  if (data?.methodeContact && ["WhatsApp", "Email"].includes(data.methodeContact))
    props["Méthode contact"] = { select: { name: data.methodeContact } };
  const tel = data?.telephone || data?.whatsapp || "";
  if (tel)         props["WhatsApp"] = { phone_number: tel };
  const email = data?.email || "";
  if (email)       props["Email"]    = { email };
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
    console.error("[GET suppliers]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req) {
  try {
    const data = await req.json();
    const properties = buildProps(data);
    console.log("[POST supplier] properties:", JSON.stringify(properties));
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: nHeaders(),
      body: JSON.stringify({ parent: { database_id: DB }, properties }),
    });
    const result = await res.json();
    if (!res.ok) {
      console.error("[POST supplier] Notion error:", JSON.stringify(result));
      return Response.json({ success: false, error: result.message }, { status: 500, headers: corsHeaders });
    }
    return Response.json({ success: true, id: result.id, item: mapPage(result) }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST supplier] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });
    const properties = buildProps(data);
    console.log("[PATCH supplier] id:", id, "properties:", JSON.stringify(properties));
    const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: "PATCH",
      headers: nHeaders(),
      body: JSON.stringify({ properties }),
    });
    const result = await res.json();
    if (!res.ok) {
      console.error("[PATCH supplier] Notion error:", JSON.stringify(result));
      return Response.json({ success: false, error: result.message }, { status: 500, headers: corsHeaders });
    }
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[PATCH supplier] Exception:", err.message);
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
      console.error("[DELETE supplier] Notion error:", JSON.stringify(result));
      return Response.json({ success: false, error: result.message }, { status: 500, headers: corsHeaders });
    }
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[DELETE supplier] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
