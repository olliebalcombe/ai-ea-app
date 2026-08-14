import twilio from "twilio";

const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

export async function sendSms(to: string, body: string) {
  return client.messages.create({
    to,
    from: process.env.TWILIO_PHONE_NUMBER!,
    body,
  });
}

/**
 * Places a real outbound call using Twilio's own built-in <Say> voices
 * (Amazon Polly, via the `voice` param) -- no ElevenLabs key needed. Used
 * by the "Test Call My Phone" button and the landline missed-call callback.
 */
export async function makeCall(opts: { to: string; twiml: string }) {
  return client.calls.create({
    to: opts.to,
    from: process.env.TWILIO_PHONE_NUMBER!,
    twiml: opts.twiml,
  });
}

/**
 * Real Twilio Lookup (line_type_intelligence) -- distinguishes mobile from
 * landline for missed-call routing. Falls back to "unknown" (treated as
 * mobile, the safer default) if the Lookup call fails or isn't available on
 * the account, rather than blocking recovery entirely.
 */
export async function lookupLineType(phoneNumber: string): Promise<"mobile" | "landline" | "voip" | "unknown"> {
  try {
    const result = await client.lookups.v2.phoneNumbers(phoneNumber).fetch({ fields: "line_type_intelligence" });
    const type = (result as unknown as { lineTypeIntelligence?: { type?: string } }).lineTypeIntelligence?.type;
    if (type === "mobile" || type === "landline" || type === "voip") return type;
    return "unknown";
  } catch {
    return "unknown";
  }
}
