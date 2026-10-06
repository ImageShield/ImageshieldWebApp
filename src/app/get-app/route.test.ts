// @vitest-environment node
import { describe, expect, it } from "vitest";
import { STORE_LINKS } from "@/lib/site-nav";
import { GET } from "./route";

const visit = (ua?: string) =>
  GET(
    new Request("http://localhost/get-app", {
      headers: ua === undefined ? {} : { "user-agent": ua },
    }),
  );

describe("GET /get-app", () => {
  it.each([
    [
      "iPhone Safari",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      STORE_LINKS.appStore,
    ],
    [
      "iPhone Chrome",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1",
      STORE_LINKS.appStore,
    ],
    [
      "Android Chrome",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
      STORE_LINKS.googlePlay,
    ],
    [
      "desktop Chrome",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
      "/",
    ],
    ["no User-Agent", undefined, "/"],
  ])("redirects %s", (_, ua, target) => {
    const res = visit(ua);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(target);
  });

  it("is never cached, since the answer depends on the device", () => {
    expect(visit("Android").headers.get("cache-control")).toBe("no-store");
  });
});
