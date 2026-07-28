import { DB, corsHeaders as notionCors, queryDatabase, createPage, getDate, titleProp, dateProp, numberProp, selectProp, textProp } from "../../_notion";
import { parseUploadForm } from "../_shared";
import { detectFileTypeFromBuffer } from "../../../../lib/importer/detect";
import { extractContentFromBuffer } from "../../../../lib/importer/extract";
import { parsePosAddictill } from "../../../../lib/importer/parsers/pos-addictill";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { headers: notionCors });
}

function centsToEuros(cents) {
  return Math.round(cents || 0) / 100;
}

// Synthèse Quotidienne AddicTill ET Palmarès Produits (hebdo) partagent le
// même fichier/mode d'upload — AddicTill n'exporte pas deux formats
// distincts, le type est déjà déterminé par les feuilles présentes dans le
// classeur (voir detectAddicTillReportType, lib/importer/parsers/pos-addictill.js).
// Cette route réutilise ce parser tel quel (jamais réécrit) — elle ajoute
// seulement l'écriture d'un résumé dans MOKA_Sales_History, une base que le
// pipeline pilotage (5 DBs séparées, non configurées en prod) n'alimente
// jamais.
export async function POST(request) {
  let upload;
  try {
    upload = await parseUploadForm(request);
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: error.status ?? 400, headers: notionCors });
  }

  try {
    const detection = detectFileTypeFromBuffer(upload.buffer, upload.originalFilename);
    if (detection.file_type !== "xlsx") {
      return Response.json(
        { success: false, error: "Fichier .xlsx attendu (export AddicTill — Synthèse quotidienne ou Palmarès produits)" },
        { status: 400, headers: notionCors }
      );
    }

    const extraction = await extractContentFromBuffer(upload.buffer, "xlsx");
    const { reportType, statement, validation } = parsePosAddictill(extraction);

    if (!reportType || !validation.valid) {
      return Response.json(
        { success: false, error: validation.errors?.[0] || "Fichier AddicTill non reconnu" },
        { status: 400, headers: notionCors }
      );
    }

    if (reportType === "daily_summary") {
      const day = statement.days[statement.days.length - 1] || statement.printed_total;
      if (!day) {
        return Response.json({ success: false, error: "Aucune ligne de synthèse trouvée dans le fichier" }, { status: 400, headers: notionCors });
      }

      const caTtc = centsToEuros(day.ca_ttc_cents ?? day.total_ttc_cents);
      const nbTickets = day.ticket_count || 0;
      const ticketMoyen = nbTickets > 0 ? Math.round((caTtc / nbTickets) * 100) / 100 : 0;
      const tva = centsToEuros((day.taxes || []).reduce((sum, t) => sum + (t.tax_cents || 0), 0));
      const repartitionPaiements = (day.payments || []).map((p) => ({ methode: p.method, montant: centsToEuros(p.total_cents) }));
      const date = day.date || statement.period_end || statement.period_start;

      const page = await createPage(DB.SALES_HISTORY, {
        Nom: titleProp(`Synthèse quotidienne — ${date}`),
        Date: dateProp(date),
        Type: selectProp("Quotidien"),
        CA_TTC: numberProp(caTtc),
        Fichier_Nom: textProp(upload.originalFilename || ""),
        Date_Import: dateProp(new Date().toISOString()),
        Donnees_JSON: textProp(JSON.stringify({ date, caTtc, nbTickets, ticketMoyen, repartitionPaiements, tva })),
      });

      return Response.json(
        { success: true, id: page.id, reportType, summary: { date, caTtc, nbTickets, ticketMoyen, tva, repartitionPaiements }, warnings: validation.warnings },
        { headers: notionCors }
      );
    }

    // product_ranking — Palmarès Produits (hebdo)
    const products = [...(statement.products || [])].sort((a, b) => (b.quantity || 0) - (a.quantity || 0));
    const top = products[0] || null;
    const caTtc = centsToEuros((statement.products || []).reduce((sum, p) => sum + (p.revenue_ttc_cents || 0), 0));
    const date = statement.period_end || statement.period_start || new Date().toISOString().slice(0, 10);

    const page = await createPage(DB.SALES_HISTORY, {
      Nom: titleProp(`Palmarès produits — ${date}`),
      Date: dateProp(date),
      Type: selectProp("Hebdomadaire"),
      CA_TTC: numberProp(caTtc),
      Nb_Produits: numberProp(products.length),
      Fichier_Nom: textProp(upload.originalFilename || ""),
      Date_Import: dateProp(new Date().toISOString()),
      Donnees_JSON: textProp(JSON.stringify({
        produitStar: top ? { nom: top.product_name, quantite: top.quantity, ca: centsToEuros(top.revenue_ttc_cents) } : null,
        topProduits: products.slice(0, 5).map((p) => ({ nom: p.product_name, quantite: p.quantity, ca: centsToEuros(p.revenue_ttc_cents) })),
      })),
    });

    return Response.json(
      { success: true, id: page.id, reportType, summary: { date, caTtc, produitStar: top?.product_name || null }, warnings: validation.warnings },
      { headers: notionCors }
    );
  } catch (err) {
    console.error("[POST imports/summary]", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: notionCors });
  }
}

// Dernier import par type — alimente les badges "Dernière import" / "À faire"
// de ManagerHome (voir DailyOpsCard).
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") === "weekly" ? "Hebdomadaire" : "Quotidien";

    const pages = await queryDatabase(
      DB.SALES_HISTORY,
      { property: "Type", select: { equals: type } },
      [{ property: "Date", direction: "descending" }],
      1
    );

    const last = pages[0] || null;
    return Response.json({ lastDate: last ? getDate(last.properties, "Date") : null }, { headers: notionCors });
  } catch (err) {
    console.error("[GET imports/summary]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: notionCors });
  }
}
