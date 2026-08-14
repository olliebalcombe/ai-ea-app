// Real Google Calendar OAuth + API calls, using plain fetch (no new SDK
// dependency). Every function here is genuinely functional -- it's simply
// inert until GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET are set, the same way
// Twilio/Resend/Anthropic were before this project's initial setup step.

const REDIRECT_URI = () => `${process.env.APP_BASE_URL}/api/integrations/google/callback`;

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: REDIRECT_URI(),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: REDIRECT_URI(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  const tokens = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };

  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const user = userRes.ok ? ((await userRes.json()) as { email?: string }) : {};

  return { ...tokens, email: user.email ?? null };
}

async function refreshGoogleToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`);
  return (await res.json()) as { access_token: string; expires_in: number };
}

/** Returns busy [start,end] windows for the connected calendar in the given range. */
export async function getGoogleFreeBusy(opts: {
  accessToken: string;
  refreshToken: string | null;
  timeMin: string;
  timeMax: string;
}): Promise<{ start: string; end: string }[]> {
  let accessToken = opts.accessToken;
  let res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin: opts.timeMin, timeMax: opts.timeMax, items: [{ id: "primary" }] }),
  });

  if (res.status === 401 && opts.refreshToken) {
    const refreshed = await refreshGoogleToken(opts.refreshToken);
    accessToken = refreshed.access_token;
    res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ timeMin: opts.timeMin, timeMax: opts.timeMax, items: [{ id: "primary" }] }),
    });
  }
  if (!res.ok) throw new Error(`Google freeBusy failed: ${await res.text()}`);
  const data = (await res.json()) as { calendars: { primary: { busy: { start: string; end: string }[] } } };
  return data.calendars.primary.busy ?? [];
}

/** Creates a real event on the connected calendar for a confirmed booking. */
export async function createGoogleEvent(opts: {
  accessToken: string;
  summary: string;
  description: string;
  startIso: string;
  endIso: string;
}) {
  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: opts.summary,
      description: opts.description,
      start: { dateTime: opts.startIso },
      end: { dateTime: opts.endIso },
    }),
  });
  if (!res.ok) throw new Error(`Google event creation failed: ${await res.text()}`);
  return res.json();
}
