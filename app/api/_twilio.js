import twilio from "twilio";

let client = null;

function getClient() {
  if (!client) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return client;
}

export function isTwilioConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID);
}

export async function sendVerificationCode(phone) {
  return getClient()
    .verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID)
    .verifications.create({ to: phone, channel: "sms" });
}

// Returns true only if Twilio reports the code as approved for this number.
export async function checkVerificationCode(phone, code) {
  const check = await getClient()
    .verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID)
    .verificationChecks.create({ to: phone, code });
  return check.status === "approved";
}

// ── WhatsApp (order notifications) ───────────────────────────────────────
// Separate from Verify: WhatsApp sends go through the Messaging API and need
// a WhatsApp-enabled sender (sandbox number in test, an approved Business
// sender in prod) in TWILIO_WHATSAPP_FROM — e.g. "whatsapp:+14155238886".
export function isWhatsAppConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);
}

function toWhatsAppAddress(phone) {
  return phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`;
}

// Free-form WhatsApp message. Only deliverable inside the 24h customer-service
// window (recipient messaged us first) — used for the internal owner/chef
// alerts, where they've joined the sandbox / opened the window.
export async function sendWhatsAppText(phone, body) {
  return getClient().messages.create({
    from: toWhatsAppAddress(process.env.TWILIO_WHATSAPP_FROM),
    to: toWhatsAppAddress(phone),
    body,
  });
}

// Template-based WhatsApp message (Content API). Required for the client
// "order ready" notification, which is sent outside any 24h window and must
// use a Meta-approved Utility template (contentSid = HX...). Only usable once
// TWILIO_WHATSAPP_ORDER_READY_SID is set.
export async function sendWhatsAppTemplate(phone, contentSid, variables) {
  return getClient().messages.create({
    from: toWhatsAppAddress(process.env.TWILIO_WHATSAPP_FROM),
    to: toWhatsAppAddress(phone),
    contentSid,
    contentVariables: JSON.stringify(variables),
  });
}

// ── Plain SMS (fallback for the client "order ready" notification) ────────
// Content SMS goes through Messaging too, so it needs its own sender number
// in TWILIO_SMS_FROM — the Verify service can't send arbitrary text.
export function isSmsConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_SMS_FROM);
}

export async function sendSms(phone, body) {
  return getClient().messages.create({ from: process.env.TWILIO_SMS_FROM, to: phone, body });
}
