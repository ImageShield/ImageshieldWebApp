import { mintShareToken } from "@/lib/share-token";

/**
 * GET /api/share/score-token — mints a signed, short-lived token for the
 * score-card route.
 *
 * This is the one place the server touches the backend on behalf of a browser
 * session after the proxy removal. It exists because the score-card PNG must
 * render a VERIFIED score, and the browser's sessionStorage tokens are not
 * visible to the server. So the browser forwards its access token here, the
 * server uses it to read the score independently from the backend, and returns
 * a signed token the score-card route can trust.
 *
 * NOT a general proxy: it reads exactly one endpoint and returns a token, not
 * the score data itself.
 */

function apiBaseUrl(): string {
  const url = (
    process.env.IMAGESHIELD_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_IMAGESHIELD_API_URL?.trim()
  );
  if (!url) throw new Error("No API URL configured");
  return url.replace(/\/+$/, "");
}

type MeScore = {
  live?: number;
  total_score?: number;
  band: string;
};

type MeResponse = {
  score: MeScore | null;
};

type ScoreResponse = {
  score: { live: number; band: string } | null;
};

export async function GET(request: Request): Promise<Response> {
  const auth = request.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return Response.json(
      { error: "authentication required" },
      { status: 401 },
    );
  }

  const base = apiBaseUrl();
  const headers = {
    Authorization: auth,
    Accept: "application/json",
  };

  // Try the full score endpoint first.
  let score: number | null = null;
  let band: string | null = null;

  try {
    const scoreRes = await fetch(`${base}/v1/me/score`, { headers });
    if (scoreRes.ok) {
      const envelope = (await scoreRes.json()) as ScoreResponse;
      if (envelope.score) {
        score = envelope.score.live;
        band = envelope.score.band;
      }
    }
  } catch {
    // Fall through to /v1/me.
  }

  // Fallback: read the summary score from the account record.
  if (score === null) {
    try {
      const meRes = await fetch(`${base}/v1/me`, { headers });
      if (!meRes.ok) {
        const status = meRes.status === 401 || meRes.status === 403 ? 401 : 502;
        return Response.json(
          { error: status === 401 ? "authentication required" : "could not read score" },
          { status },
        );
      }
      const me = (await meRes.json()) as MeResponse;
      const stored = me.score;
      const live = stored?.live ?? stored?.total_score;
      if (stored && typeof live === "number" && Number.isFinite(live)) {
        score = live;
        band = stored.band;
      }
    } catch {
      return Response.json(
        { error: "could not reach the API" },
        { status: 502 },
      );
    }
  }

  if (score === null || band === null) {
    return Response.json(
      { error: "no score on record" },
      { status: 404 },
    );
  }

  const token = mintShareToken(score, band);
  return Response.json(
    { token },
    {
      status: 200,
      headers: { "Cache-Control": "no-store, private" },
    },
  );
}
