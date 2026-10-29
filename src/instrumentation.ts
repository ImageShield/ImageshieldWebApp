/**
 * Boot-time configuration check.
 *
 * `register` runs once per server instance and must finish before any request is
 * served, which makes it the one place a misconfiguration can be caught while it is
 * still cheap.
 *
 * The frontend talks directly to the backend API now (no server-side proxy), so the
 * only env var that matters at build/boot time is the public API base URL that Next.js
 * inlines into the client bundle.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const url = process.env.NEXT_PUBLIC_IMAGESHIELD_API_URL?.trim();
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_IMAGESHIELD_API_URL is not set — copy .env.example to .env.local",
    );
  }
}
