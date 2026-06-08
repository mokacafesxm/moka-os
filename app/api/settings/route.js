import {
  DB, corsHeaders,
  queryDatabase, createPage, updatePage,
  getTitle, getText, getSelect, getCheckbox,
  titleProp, textProp, selectProp, checkboxProp,
} from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

async function listSuppliers() {
  const pages = await queryDatabase(DB.FOURNISSEURS);
  return pages.map((page) => {
    const p = page.properties;
    return {
      id: page.id,
      nom: getTitle(p, "Nom", "nom", "Name", "name"),
      name: getTitle(p, "Nom", "nom", "Name", "name"),
      categorie: getSelect(p, "Catégorie", "Categorie", "categorie"),
      contact: getText(p, "Contact", "contact"),
      telephone: getText(p, "Téléphone", "telephone", "Phone", "phone"),
      whatsapp: getText(p, "WhatsApp", "whatsapp", "Téléphone", "telephone"),
      email: getText(p, "Email", "email"),
      actif: getCheckbox(p, "Actif", "actif", "Active"),
    };
  });
}

async function listStaff() {
  const pages = await queryDatabase(DB.STAFF);
  return pages.map((page) => {
    const p = page.properties;
    return {
      id: page.id,
      nom: getTitle(p, "Prénom", "prenom", "Nom", "nom", "Name", "name"),
      name: getTitle(p, "Prénom", "prenom", "Nom", "nom", "Name", "name"),
      prenom: getTitle(p, "Prénom", "prenom", "Nom", "nom", "Name", "name"),
      role: getSelect(p, "Rôle", "Role", "role", "Poste"),
      telephone: getText(p, "Téléphone", "telephone", "Phone"),
      email: getText(p, "Email", "email"),
      actif: getCheckbox(p, "Actif", "actif", "Active"),
    };
  });
}

async function listFromIngredients(prop) {
  const pages = await queryDatabase(DB.INGREDIENTS, null, null, 200);
  const values = new Set();
  for (const page of pages) {
    const v = getSelect(page.properties, prop);
    if (v) values.add(v);
  }
  return [...values].sort().map((v) => ({ id: v, name: v }));
}

export async function POST(request) {
  try {
    const { resource, action, id, data } = await request.json();

    // ── LIST ────────────────────────────────────────────────────────────────
    if (action === "list") {
      if (resource === "suppliers")   return Response.json(await listSuppliers(), { headers: corsHeaders });
      if (resource === "staff")       return Response.json(await listStaff(), { headers: corsHeaders });
      if (resource === "categories")  return Response.json(await listFromIngredients("Catégorie"), { headers: corsHeaders });
      if (resource === "subcategories") return Response.json(await listFromIngredients("Sous-catégorie"), { headers: corsHeaders });
      if (resource === "units")       return Response.json(await listFromIngredients("Unité stock"), { headers: corsHeaders });
      if (resource === "zones")       return Response.json(await listFromIngredients("Zone de stockage"), { headers: corsHeaders });
      return Response.json({ error: `Unknown resource: ${resource}` }, { status: 400, headers: corsHeaders });
    }

    // ── CREATE ───────────────────────────────────────────────────────────────
    if (action === "create") {
      let dbId, properties;
      if (resource === "suppliers") {
        dbId = DB.FOURNISSEURS;
        properties = {
          "Nom":       titleProp(data?.nom || data?.name || ""),
          "Catégorie": selectProp(data?.categorie),
          "Contact":   textProp(data?.contact || ""),
          "Téléphone": textProp(data?.telephone || ""),
          "Email":     textProp(data?.email || ""),
          "Actif":     checkboxProp(data?.actif !== false),
        };
      } else if (resource === "staff") {
        dbId = DB.STAFF;
        properties = {
          "Prénom":    titleProp(data?.nom || data?.name || data?.prenom || ""),
          "Rôle":      selectProp(data?.role),
          "Téléphone": textProp(data?.telephone || ""),
          "Email":     textProp(data?.email || ""),
          "Actif":     checkboxProp(data?.actif !== false),
        };
      } else {
        return Response.json({ error: `create not supported for ${resource}` }, { status: 400, headers: corsHeaders });
      }
      const page = await createPage(dbId, properties);
      return Response.json({ success: true, id: page.id }, { headers: corsHeaders });
    }

    // ── UPDATE ───────────────────────────────────────────────────────────────
    if (action === "update") {
      if (!id) return Response.json({ error: "id required for update" }, { status: 400, headers: corsHeaders });
      let properties;
      if (resource === "suppliers") {
        properties = {
          "Nom":       titleProp(data?.nom || data?.name || ""),
          "Catégorie": selectProp(data?.categorie),
          "Contact":   textProp(data?.contact || ""),
          "Téléphone": textProp(data?.telephone || ""),
          "Email":     textProp(data?.email || ""),
          "Actif":     checkboxProp(data?.actif !== false),
        };
      } else if (resource === "staff") {
        properties = {
          "Prénom":    titleProp(data?.nom || data?.name || data?.prenom || ""),
          "Rôle":      selectProp(data?.role),
          "Téléphone": textProp(data?.telephone || ""),
          "Email":     textProp(data?.email || ""),
          "Actif":     checkboxProp(data?.actif !== false),
        };
      } else {
        return Response.json({ error: `update not supported for ${resource}` }, { status: 400, headers: corsHeaders });
      }
      await updatePage(id, properties);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    // ── ARCHIVE ──────────────────────────────────────────────────────────────
    if (action === "archive") {
      if (!id) return Response.json({ error: "id required for archive" }, { status: 400, headers: corsHeaders });
      await updatePage(id, { "Actif": checkboxProp(false) });
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400, headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
