import {
  DB, corsHeaders, queryDatabase, createPage,
  getTitle, getText, getNumber, getSelect, getDate, getCheckbox,
  titleProp, textProp, numberProp, selectProp, dateProp, checkboxProp,
} from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function normalize(page) {
  const p = page.properties;
  return {
    id: page.id,
    libelle: getTitle(p, "Libelle"),
    date: getDate(p, "Date"),
    montant: getNumber(p, "Montant"),
    type: getSelect(p, "Type"),
    categorie: getSelect(p, "Categorie"),
    banque: getText(p, "Banque"),
    compte: getText(p, "Compte"),
    periode: getText(p, "Periode"),
    verifie: getCheckbox(p, "Verifie"),
  };
}

// GET [?categorie=][&limit=] — MOKA_Banque existait déjà (voir DB.BANQUE,
// utilisée par /api/imports/bank pour la trésorerie du dashboard) ; cette
// route lit la même base mais expose les champs ajoutés pour le nouveau
// dashboard financier (/rapports "Dernières transactions").
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const categorie = searchParams.get("categorie");
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 500);

    const filter = categorie ? { property: "Categorie", select: { equals: categorie } } : undefined;
    const pages = await queryDatabase(DB.BANQUE, filter, [{ property: "Date", direction: "descending" }], limit);

    return Response.json(pages.map(normalize), { headers: corsHeaders });
  } catch (err) {
    console.error("[GET banque]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

// POST { transactions: [...], banque, compte, periode } — persiste après
// vérification/édition côté client (voir /api/scan-releve pour l'extraction,
// qui n'écrit rien). Verifie démarre à false : coché manuellement une fois
// la transaction rapprochée.
export async function POST(req) {
  try {
    const { transactions, banque, compte, periode } = await req.json();
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return Response.json({ success: false, error: "transactions (array) requis" }, { status: 400, headers: corsHeaders });
    }

    const created = [];
    for (const t of transactions) {
      if (!t.date || !t.libelle) continue;
      const montant = Number(t.montant) || 0;
      const type = t.type === "débit" || t.type === "Débit" || montant < 0 ? "Débit" : "Crédit";
      const page = await createPage(DB.BANQUE, {
        Libelle: titleProp(t.libelle),
        Date: dateProp(t.date),
        Montant: numberProp(Math.abs(montant)),
        Type: selectProp(type),
        Categorie: selectProp(t.categorie || "Autre"),
        Banque: textProp(banque || ""),
        Compte: textProp(compte || ""),
        Periode: textProp(periode || ""),
        Verifie: checkboxProp(false),
        Date_Import: dateProp(new Date().toISOString().slice(0, 10)),
      });
      created.push(page.id);
    }

    return Response.json({ success: true, count: created.length }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST banque]", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
