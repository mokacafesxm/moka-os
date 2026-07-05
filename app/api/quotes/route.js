import { unstable_cache } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { corsHeaders } from "../_notion";

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

// Used until ANTHROPIC_API_KEY exists, and as a safety net if the call fails.
const FALLBACK_QUOTES = [
  "Chaque commande commence par une idée. Fonce.",
  "Le meilleur moment pour se lancer, c'est maintenant.",
  "Petites habitudes, grands résultats.",
  "Tout est possible avant midi.",
];

async function generateQuotes() {
  if (!client) return FALLBACK_QUOTES;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system:
        "Tu écris des citations motivantes très courtes (moins de 8 mots), ton entrepreneurial et énergique " +
        '("tout est possible"), pour l\'en-tête d\'une app de commande de café. Réponds uniquement avec les ' +
        "citations, une par ligne, sans numérotation ni tirets, en français.",
      messages: [{ role: "user", content: "Génère 4 citations motivantes courtes." }],
    });

    const text = response.content[0]?.text || "";
    const quotes = text
      .split("\n")
      .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
      .filter(Boolean);

    return quotes.length ? quotes : FALLBACK_QUOTES;
  } catch {
    return FALLBACK_QUOTES;
  }
}

// Generated once, then reused for ~24h — never regenerated on a page load.
const getCachedQuotes = unstable_cache(generateQuotes, ["daily-quotes"], { revalidate: 60 * 60 * 24 });

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  const quotes = await getCachedQuotes();
  return Response.json({ quotes }, { headers: corsHeaders });
}
