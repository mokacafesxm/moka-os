import {
  isWhatsAppConfigured,
  sendWhatsAppText,
  sendWhatsAppTemplate,
  isSmsConfigured,
  sendSms,
} from "../_twilio";

// Owner + chef internal alert numbers (comma-separated E.164 in one env var
// to keep config simple). Empty = feature simply doesn't fire.
function internalAlertNumbers() {
  return (process.env.MOKA_ALERT_WHATSAPP || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

// New order → free-form WhatsApp to owner + chef (they've opened the 24h
// window via the sandbox / by messaging us first). Best-effort: never blocks
// or fails order creation, just logs.
export async function notifyInternalNewOrder({ code, client, articles, total, creneau, comment }) {
  const numbers = internalAlertNumbers();
  if (!numbers.length || !isWhatsAppConfigured()) return;

  const body =
    `🔔 Nouvelle commande MÖKA ${code}\n` +
    `Client : ${client || "—"}\n` +
    `Créneau : ${creneau || "—"}\n` +
    `${articles || ""}\n` +
    `Total : ${Number(total || 0).toFixed(2)}€` +
    (comment ? `\n📝 ${comment}` : "");

  await Promise.allSettled(numbers.map((n) => sendWhatsAppText(n, body)));
}

// Order ready → client notification: approved WhatsApp template first, SMS
// fallback if WhatsApp isn't configured/approved or the send throws (client
// may not have WhatsApp). Both are config-gated, so this is inert until the
// prod sender + template SID (and/or SMS sender) exist — Phase 2.
export async function notifyClientOrderReady({ telephone, prenom, code }) {
  if (!telephone) return { sent: false, channel: null };

  const contentSid = process.env.TWILIO_WHATSAPP_ORDER_READY_SID;
  if (isWhatsAppConfigured() && contentSid) {
    try {
      await sendWhatsAppTemplate(telephone, contentSid, { 1: prenom || "", 2: code || "" });
      return { sent: true, channel: "whatsapp" };
    } catch (err) {
      console.warn("[notify] WhatsApp order-ready failed, trying SMS:", err.message);
    }
  }

  if (isSmsConfigured()) {
    try {
      await sendSms(telephone, `Bonjour ${prenom || ""}, votre commande MÖKA ${code} est prête ☕ Venez la récupérer !`);
      return { sent: true, channel: "sms" };
    } catch (err) {
      console.warn("[notify] SMS order-ready failed:", err.message);
    }
  }

  return { sent: false, channel: null };
}
