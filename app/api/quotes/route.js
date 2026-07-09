import { corsHeaders } from "../_notion";
import { currentHourInCafeTz, quoteForHour } from "../../commander/_lib/quotes";

// The active quote is derived from the current server hour (café timezone) —
// same result for every caller, changing only on the hour. Must be dynamic so
// each request reflects the current hour rather than a build-time snapshot.
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  const hour = currentHourInCafeTz();
  const quote = quoteForHour(hour);
  return Response.json({ hour, quote }, { headers: corsHeaders });
}
