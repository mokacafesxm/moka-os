import { corsHeaders } from "../../_notion";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request) {
  try {
    const { messages, context } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: "messages array required" }, { status: 400, headers: corsHeaders });
    }

    const systemPrompt = `Tu es MÖKA AI, l'assistant intelligent de MÖKA Café SXM.
Tu as accès aux données en temps réel du restaurant : stock, commandes, staff, ventes.
Réponds de façon concise et actionnable. Toujours en français.

${context ? `Données actuelles du tableau de bord :\n${JSON.stringify(context, null, 2)}` : ""}

Réponds toujours en 2-4 phrases maximum sauf si l'utilisateur demande un rapport détaillé.
Sois direct, utile, et utilise le tutoiement avec l'équipe.`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const reply = response.content[0]?.text || "";
    return Response.json({ reply }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
