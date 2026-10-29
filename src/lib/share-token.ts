import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * HMAC-signed share tokens for score-card authenticity.
 *
 * The score-card route used to read the score from the visitor's server-side
 * session, which made it unforgeable. Now that sessions live in the browser,
 * the route needs another way to trust the score it renders.
 *
 * The flow:
 *   1. Browser has an authenticated score from `GET /v1/me/score`.
 *   2. Browser calls `GET /api/share/score-token` with its access token.
 *   3. That route independently fetches the score from the backend, signs it
 *      with a server-only secret, and returns a short-lived opaque token.
 *   4. Browser passes the token to `/api/share/score-card?token=...`.
 *   5. The score-card route verifies the HMAC and renders the PNG.
 *
 * The server never signs a value the browser chose - it always reads the score
 * itself. The token is time-limited so a leaked URL expires.
 */

const TOKEN_TTL_S = 300; // 5 minutes - enough for the share sheet

/** The known bands the API returns. */
const KNOWN_BANDS = new Set([
  "low risk",
  "moderate risk",
  "high risk",
  "severe risk",
]);

function secret(): string {
  const raw = process.env.SCORE_SHARE_SECRET?.trim();
  if (!raw || raw.length < 32) {
    throw new Error(
      "SCORE_SHARE_SECRET is not set or too short (min 32 chars) - " +
        "generate one: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return raw;
}

export type SharePayload = {
  /** The score, clamped to 0–100. */
  score: number;
  /** The band as served by the API. */
  band: string;
  /** Epoch seconds when this token expires. */
  exp: number;
};

function encode(payload: SharePayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

/** Creates a signed, expiring share token from a verified score. */
export function mintShareToken(score: number, band: string): string {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const normalised = KNOWN_BANDS.has(band.trim().toLowerCase())
    ? band.trim().toLowerCase()
    : "moderate risk";
  const payload: SharePayload = {
    score: clamped,
    band: normalised,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_S,
  };
  const data = encode(payload);
  return `${data}.${sign(data)}`;
}

/** Verifies a share token and returns its payload, or null if invalid/expired. */
export function verifyShareToken(token: string): SharePayload | null {
  const dot = token.indexOf(".");
  if (dot === -1) return null;

  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  // Timing-safe comparison
  const expected = sign(data);
  if (sig.length !== expected.length) return null;
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expBuf)) return null;

  let payload: SharePayload;
  try {
    payload = JSON.parse(Buffer.from(data, "base64url").toString()) as SharePayload;
  } catch {
    return null;
  }

  if (typeof payload.score !== "number" || typeof payload.band !== "string") {
    return null;
  }

  // Expired?
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;

  // Validate ranges
  if (payload.score < 0 || payload.score > 100) return null;
  if (!KNOWN_BANDS.has(payload.band)) return null;

  return payload;
}
