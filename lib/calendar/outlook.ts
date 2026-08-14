// Real Microsoft/Outlook Calendar OAuth + Graph API calls via plain fetch --
// same real-but-inert-until-configured pattern as lib/calendar/google.ts.

const REDIRECT_URI = () => `${process.env.APP_BASE_URL}/api/integrations/outlook/callback`;

export function isOutlookConfigured() {
  return Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
}

export function getOutlookAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    redirect_uri: REDIRECT_URI(),
    response_type: "code",
    response_mode: "query",
    scope: "offline_access Calendars.ReadWrite User.Read",
    state,
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeOutlookCode(code: string) {
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      redirect_uri: REDIRECT_URI(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Outlook token exchange failed: ${await res.text()}`);
  const tokens = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };

  const userRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const user = userRes.ok ? ((await userRes.json()) as { mail?: string; userPrincipalName?: string }) : {};

  return { ...tokens, email: user.mail ?? user.userPrincipalName ?? null };
}

async function refreshOutlookToken(refreshToken: string) {
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Outlook token refresh failed: ${await res.text()}`);
  return (await res.json()) as { access_token: string; expires_in: number };
}

/** Returns busy [start,end] windows for the connected calendar in the given range. */
export async function getOutlookFreeBusy(opts: {
  accessToken: string;
  refreshToken: string | null;
  email: string;
  timeMin: string;
  timeMax: string;
}): Promise<{ start: string; end: string }[]> {
  const body = JSON.stringify({
    schedules: [opts.email],
    startTime: { dateTime: opts.timeMin, timeZone: "UTC" },
    endTime: { dateTime: opts.timeMax, timeZone: "UTC" },
  });

  let accessToken = opts.accessToken;
  let res = await fetch("https://graph.microsoft.com/v1.0/me/calendar/getSchedule", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body,
  });

  if (res.status === 401 && opts.refreshToken) {
    const refreshed = await refreshOutlookToken(opts.refreshToken);
    accessToken = refreshed.access_token;
    res = await fetch("https://graph.microsoft.com/v1.0/me/calendar/getSchedule", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body,
    });
  }
  if (!res.ok) throw new Error(`Outlook getSchedule failed: ${await res.text()}`);
  const data = (await res.json()) as {
    value: { scheduleItems: { start: { dateTime: string }; end: { dateTime: string } }[] }[];
  };
  return (data.value?.[0]?.scheduleItems ?? []).map((i) => ({ start: i.start.dateTime, end: i.end.dateTime }));
}

/** Creates a real event on the connected calendar for a confirmed booking. */
export async function createOutlookEvent(opts: {
  accessToken: string;
  subject: string;
  body: string;
  startIso: string;
  endIso: string;
}) {
  const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: opts.subject,
      body: { contentType: "text", content: opts.body },
      start: { dateTime: opts.startIso, timeZone: "UTC" },
      end: { dateTime: opts.endIso, timeZone: "UTC" },
    }),
  });
  if (!res.ok) throw new Error(`Outlook event creation failed: ${await res.text()}`);
  return res.json();
}
