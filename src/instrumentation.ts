/**
 * Boot-time configuration check.
 *
 * `register` runs once per server instance and must finish before any request is
 * served, which makes it the one place a misconfiguration can be caught while it is
 * still cheap.
 *
 * NEXT_PUBLIC_* vars are inlined into the client bundle at build time and are NOT
 * reliably present in process.env at runtime (especially on Amplify SSR where only
 * .next/ is deployed). So we only warn — a missing value here means the client bundle
 * was built without it, which is a build-time problem, not a boot-time one.
 *
 * Server-only vars (SCORE_SHARE_SECRET, IMAGESHIELD_API_URL) are checked lazily by
 * the routes that need them.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (!process.env.NEXT_PUBLIC_IMAGESHIELD_API_URL?.trim()) {
    console.warn(
      "NEXT_PUBLIC_IMAGESHIELD_API_URL is not in process.env at runtime. " +
        "This is expected on Amplify — the value was inlined at build time.",
    );
  }
}
