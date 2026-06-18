import { DB, corsHeaders, queryDatabase, getText, getSelect, getDate } from "../../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const staffFilter = searchParams.get("staff");

    const clockPages = await queryDatabase(DB.POINTAGES, null, [{ property: "Date et heure", direction: "ascending" }], 500);

    const getDaySXM = (isoDate) =>
      new Date(isoDate).toLocaleDateString("en-CA", { timeZone: "America/Puerto_Rico" });

    const allEvents = clockPages.map(p => ({
      staff: getText(p.properties, "Staff") || "",
      action: getSelect(p.properties, "Action") || "",
      date: getDate(p.properties, "Date et heure") || "",
    })).filter(e => e.date && (!staffFilter || e.staff === staffFilter));

    const sorted = allEvents
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(e => ({ ...e, daySXM: getDaySXM(e.date) }));

    // Run state machine with trace
    const byDay = {};
    sorted.forEach(e => {
      const key = `${e.staff}__${e.daySXM}`;
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(e);
    });

    const trace = [];
    Object.entries(byDay).forEach(([key, events]) => {
      const [staffName, day] = key.split("__");
      let totalMs = 0;
      let state = "out";
      let lastTimestamp = null;
      const steps = [];

      events.forEach(e => {
        const action = e.action.toLowerCase();
        const t = new Date(e.date);
        const prevState = state;

        if (action === "arrivée") {
          if (state === "out") { state = "working"; lastTimestamp = t; }
        } else if (action === "départ pause") {
          if (state === "working" && lastTimestamp) {
            totalMs += t - lastTimestamp;
            state = "paused";
            lastTimestamp = null;
          }
        } else if (action === "retour pause") {
          if (state === "paused") { state = "working"; lastTimestamp = t; }
        } else if (action === "départ") {
          if (state === "working" && lastTimestamp) totalMs += t - lastTimestamp;
          state = "out";
          lastTimestamp = null;
        }

        steps.push({
          time: new Date(e.date).toLocaleTimeString("fr-FR", { timeZone: "America/Puerto_Rico", hour: "2-digit", minute: "2-digit" }),
          action: e.action,
          stateChange: `${prevState} → ${state}`,
          ignored: prevState === state,
          runningTotal: `${Math.round(totalMs / 60000)}min`,
        });
      });

      const incomplete = state === "working";
      trace.push({
        staff: staffName,
        day,
        totalHeures: Math.round((totalMs / 3600000) * 10) / 10,
        incomplete,
        finalState: state,
        steps,
      });
    });

    return Response.json({ staff: staffFilter, trace }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
