import { DB, corsHeaders, queryDatabase, withNotionCache, getTitle, getText, getSelect, getCheckbox } from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  try {
    const staff = await withNotionCache("staff", 60000, async () => {
    const pages = await queryDatabase(DB.STAFF, {
      property: "Actif",
      checkbox: { equals: true },
    });

    return pages.map((page) => {
      const p = page.properties;
      return {
        id: page.id,
        name: getTitle(p, "Prénom", "prenom", "Nom", "nom", "Name", "name", "Staff"),
        role: getSelect(p, "Rôle", "Role", "role", "Poste"),
        telephone: getText(p, "Téléphone", "telephone", "Phone"),
        email: getText(p, "Email", "email"),
        actif: getCheckbox(p, "Actif", "actif", "Active"),
      };
    });
    });

    return Response.json(staff, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
