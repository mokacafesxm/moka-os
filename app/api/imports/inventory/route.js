import { DB, corsHeaders, queryDatabase, getTitle, getNumber, getSelect } from "../../_notion";
import { detectFileTypeFromBuffer } from "../../../../lib/importer/detect";
import { extractContentFromBuffer } from "../../../../lib/importer/extract";

export const dynamic = "force-dynamic";

// Écart théorique/réel au-delà duquel une ligne est signalée — pas de seuil
// donné dans la demande, 10% est une valeur de départ raisonnable côté
// café (à ajuster une fois de vrais inventaires comparés).
const ALERT_THRESHOLD_RATIO = 0.1;

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function headerIndex(header, candidates) {
  const normalized = header.map((c) => normalizeName(c));
  for (const name of candidates) {
    const i = normalized.findIndex((h) => h.includes(name));
    if (i !== -1) return i;
  }
  return -1;
}

function rowsFromExtraction(extraction) {
  if (extraction.sheets && extraction.sheets[0]) {
    const [header, ...rows] = extraction.sheets[0].rows;
    return { header: header || [], rows };
  }
  if (extraction.table) {
    return { header: extraction.table.header || [], rows: extraction.table.rows || [] };
  }
  return { header: [], rows: [] };
}

export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return Response.json({ success: false, error: "multipart/form-data attendu" }, { status: 400, headers: corsHeaders });
    }
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return Response.json({ success: false, error: "Fichier requis" }, { status: 400, headers: corsHeaders });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detection = detectFileTypeFromBuffer(buffer, file.name || "inventaire.xlsx");
    if (detection.file_type !== "xlsx" && detection.file_type !== "csv") {
      return Response.json({ success: false, error: "Fichier Excel ou CSV attendu" }, { status: 400, headers: corsHeaders });
    }

    const extraction = await extractContentFromBuffer(buffer, detection.file_type);
    const { header, rows } = rowsFromExtraction(extraction);

    const produitIdx = headerIndex(header, ["produit", "nom", "article"]);
    const quantiteIdx = headerIndex(header, ["quantite reelle", "quantite", "qte"]);
    const uniteIdx = headerIndex(header, ["unite"]);

    if (produitIdx === -1 || quantiteIdx === -1) {
      return Response.json(
        { success: false, error: "Colonnes attendues introuvables — le fichier doit contenir au moins Produit et Quantité réelle" },
        { status: 400, headers: corsHeaders }
      );
    }

    const compte = rows
      .map((row) => ({
        produit: String(row[produitIdx] || "").trim(),
        quantiteReelle: parseFloat(String(row[quantiteIdx] ?? "0").replace(",", ".")) || 0,
        unite: uniteIdx >= 0 ? String(row[uniteIdx] || "") : "",
      }))
      .filter((r) => r.produit);

    const stockPages = await queryDatabase(DB.STOCK);
    const stockByName = new Map();
    stockPages.forEach((page) => {
      const p = page.properties;
      const name = getTitle(p, "Produit");
      if (!name) return;
      stockByName.set(normalizeName(name), {
        name,
        quantiteTheorique: getNumber(p, "Quantite_stock") || 0,
        unite: getSelect(p, "Unite_stock") || "",
      });
    });

    const ecarts = compte.map((c) => {
      const stock = stockByName.get(normalizeName(c.produit));
      const quantiteTheorique = stock?.quantiteTheorique ?? null;
      const ecart = quantiteTheorique === null ? null : c.quantiteReelle - quantiteTheorique;
      const ratio = quantiteTheorique ? Math.abs(ecart) / quantiteTheorique : null;
      return {
        produit: c.produit,
        unite: c.unite || stock?.unite || "",
        quantiteTheorique,
        quantiteReelle: c.quantiteReelle,
        ecart,
        perte: ecart !== null && ecart < 0 ? Math.abs(ecart) : 0,
        alerte: ratio !== null && ratio > ALERT_THRESHOLD_RATIO,
        introuvableEnStock: quantiteTheorique === null,
      };
    });

    const totalPertes = ecarts.reduce((sum, e) => sum + e.perte, 0);
    const nbAlertes = ecarts.filter((e) => e.alerte).length;

    return Response.json(
      { success: true, ecarts, totalPertes, nbAlertes, nbLignes: ecarts.length },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("[POST imports/inventory]", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
