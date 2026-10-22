import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CONSENT_VERSION as V } from "@/lib/consent";
import { ConsentManager } from "./ConsentManager";

/* `next/script` injects into the real document after hydration; what matters here is
   which scripts the manager asks for, and how many times. */
vi.mock("next/script", () => ({
  default: ({ id, src, children }: { id: string; src?: string; children?: string }) => (
    <div hidden data-script={id} data-src={src}>
      {children}
    </div>
  ),
}));

const { reloadPage } = vi.hoisted(() => ({ reloadPage: vi.fn() }));
vi.mock("@/lib/consent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/consent")>()),
  reloadPage,
}));

type WithDataLayer = Window & { dataLayer?: unknown[] };

const scripts = () =>
  [...document.querySelectorAll("[data-script]")].map((el) => el.getAttribute("data-script"));
const script = (id: string) => document.querySelector(`[data-script="${id}"]`);
const cookieNames = () =>
  document.cookie
    .split(";")
    .map((part) => part.trim().split("=")[0])
    .filter(Boolean);
const banner = () => screen.queryByRole("heading", { name: "Cookies on the quiz" });
/* Stands in for a quiz screen: the manager wraps the page in the root layout. */
const screenContent = <main>Quiz screen</main>;

afterEach(() => {
  cleanup();
  for (const name of cookieNames()) document.cookie = `${name}=; Max-Age=0; Path=/`;
  delete (window as WithDataLayer).dataLayer;
  reloadPage.mockReset();
});

describe("ConsentManager", () => {
  it("asks a first-time visitor and loads nothing", () => {
    render(<ConsentManager>{screenContent}</ConsentManager>);
    expect(banner()).not.toBeNull();
    expect(scripts()).toEqual([]);
  });

  it("stores a refusal and still loads nothing", () => {
    render(<ConsentManager>{screenContent}</ConsentManager>);
    fireEvent.click(screen.getByRole("button", { name: "Reject all" }));

    expect(document.cookie).toContain(`imageshield_consent=${V}.a0.m0`);
    expect(banner()).toBeNull();
    expect(scripts()).toEqual([]);
  });

  it("loads Tag Manager and HubSpot once each on Accept all", () => {
    const { rerender } = render(<ConsentManager>{screenContent}</ConsentManager>);
    fireEvent.click(screen.getByRole("button", { name: "Accept all" }));
    rerender(<ConsentManager>{screenContent}</ConsentManager>);

    expect(scripts()).toEqual(["gtm-init", "hs-banner-off", "hs-script-loader"]);
    expect(script("hs-script-loader")?.getAttribute("data-src")).toBe(
      "https://js.hs-scripts.com/20495177.js",
    );
    const gtm = script("gtm-init")?.textContent ?? "";
    expect(gtm).toContain("'dataLayer','GTM-NM7B8G3X'");
    expect(gtm).toContain('"ad_storage":"granted"');
    // The signals have to exist before the container that checks them.
    expect(gtm.indexOf("'consent','default'")).toBeLessThan(gtm.indexOf("gtm.js"));
  });

  it("loads Tag Manager alone, advertising denied, when only Analytics is chosen", () => {
    render(<ConsentManager>{screenContent}</ConsentManager>);
    fireEvent.click(screen.getByRole("button", { name: "Choose what to allow" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Analytics/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save choices" }));

    expect(scripts()).toEqual(["gtm-init"]);
    const gtm = script("gtm-init")?.textContent ?? "";
    expect(gtm).toContain('"analytics_storage":"granted"');
    expect(gtm).toContain('"ad_storage":"denied"');
  });

  it("loads HubSpot alone, and no Tag Manager, when only Marketing is chosen", () => {
    render(<ConsentManager>{screenContent}</ConsentManager>);
    fireEvent.click(screen.getByRole("button", { name: "Choose what to allow" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Marketing/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save choices" }));

    expect(document.cookie).toContain(`imageshield_consent=${V}.a0.m1`);
    expect(scripts()).toEqual(["hs-banner-off", "hs-script-loader"]);
  });

  it("doesn't ask a returning visitor again", () => {
    document.cookie = `imageshield_consent=${V}.a1.m1; Path=/`;
    render(<ConsentManager>{screenContent}</ConsentManager>);
    expect(banner()).toBeNull();
    expect(scripts()).toEqual(["gtm-init", "hs-banner-off", "hs-script-loader"]);
  });

  it("asks again, loading nothing, after the consent version is bumped", () => {
    document.cookie = "imageshield_consent=v0.a1.m1; Path=/";
    render(<ConsentManager>{screenContent}</ConsentManager>);
    expect(banner()).not.toBeNull();
    expect(scripts()).toEqual([]);
  });

  /* After a version bump the old "yes" reads as no choice; a "no" now must still clear
     what it left behind. Nothing was loaded on this page, so there is nothing to reload. */
  it("clears an outdated choice's cookies when the visitor now rejects", () => {
    document.cookie = "imageshield_consent=v0.a1.m1; Path=/";
    for (const name of ["_ga", "__hstc", "hubspotutk", "other"]) document.cookie = `${name}=1; Path=/`;
    render(<ConsentManager>{screenContent}</ConsentManager>);
    fireEvent.click(screen.getByRole("button", { name: "Reject all" }));
    expect(cookieNames().sort()).toEqual(["imageshield_consent", "other"]);
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it("keeps an outdated choice's cookies when the visitor now accepts", () => {
    document.cookie = "imageshield_consent=v0.a1.m1; Path=/";
    document.cookie = "_ga=1; Path=/";
    render(<ConsentManager>{screenContent}</ConsentManager>);
    fireEvent.click(screen.getByRole("button", { name: "Accept all" }));
    expect(cookieNames()).toContain("_ga");
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it("on withdrawal tells Google, deletes the cookies and reloads", () => {
    document.cookie = `imageshield_consent=${V}.a1.m1; Path=/`;
    for (const name of ["_ga", "__hstc", "other"]) document.cookie = `${name}=1; Path=/`;
    const dataLayer: unknown[] = [];
    (window as WithDataLayer).dataLayer = dataLayer;

    render(<ConsentManager>{screenContent}</ConsentManager>);
    fireEvent.click(screen.getByRole("button", { name: "Cookie settings" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Analytics/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Marketing/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save choices" }));

    expect(document.cookie).toContain(`imageshield_consent=${V}.a0.m0`);
    expect(cookieNames().sort()).toEqual(["imageshield_consent", "other"]);
    // An `arguments` object, as gtag() pushes — GTM ignores the same values as an array.
    const command = dataLayer.at(-1);
    expect(Object.prototype.toString.call(command)).toBe("[object Arguments]");
    expect(Array.from(command as ArrayLike<unknown>)).toEqual([
      "consent",
      "update",
      {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      },
    ]);
    expect(reloadPage).toHaveBeenCalledOnce();
  });

  it("grants more without a reload", () => {
    document.cookie = `imageshield_consent=${V}.a1.m0; Path=/`;
    const dataLayer: unknown[] = [];
    (window as WithDataLayer).dataLayer = dataLayer;

    render(<ConsentManager>{screenContent}</ConsentManager>);
    fireEvent.click(screen.getByRole("button", { name: "Cookie settings" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Marketing/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save choices" }));

    expect(reloadPage).not.toHaveBeenCalled();
    expect(scripts()).toEqual(["gtm-init", "hs-banner-off", "hs-script-loader"]);
    expect(Array.from(dataLayer.at(-1) as ArrayLike<unknown>)[2]).toMatchObject({
      ad_storage: "granted",
    });
  });

  it("links to the privacy policy, not the homepage's privacy section", () => {
    render(<ConsentManager>{screenContent}</ConsentManager>);
    expect(screen.getByRole("link", { name: "Privacy policy" }).getAttribute("href")).toBe(
      "https://imageshield.com/privacy-policy",
    );
  });

  it("leaves the choice alone when settings are cancelled", () => {
    document.cookie = `imageshield_consent=${V}.a1.m1; Path=/`;
    render(<ConsentManager>{screenContent}</ConsentManager>);
    fireEvent.click(screen.getByRole("button", { name: "Cookie settings" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Analytics/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(document.cookie).toContain(`imageshield_consent=${V}.a1.m1`);
    expect(banner()).toBeNull();
    expect(reloadPage).not.toHaveBeenCalled();
  });
});

/* fireEvent.click carries a `detail` of 0, which is how Enter, Space and a screen
   reader's activation arrive; `{ detail: 1 }` is a mouse click or a tap. */
describe("ConsentManager focus", () => {
  const trigger = () => screen.getByRole("button", { name: "Cookie settings" });
  const firstChoice = () => screen.getByRole("checkbox", { name: /Analytics/ });

  it("doesn't take focus when the first-visit banner appears", () => {
    render(<ConsentManager>{screenContent}</ConsentManager>);
    expect(banner()).not.toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it("moves into the choices, and back to the button that opened them", () => {
    render(<ConsentManager>{screenContent}</ConsentManager>);
    fireEvent.click(screen.getByRole("button", { name: "Choose what to allow" }));
    expect(document.activeElement).toBe(firstChoice());

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Choose what to allow" }),
    );
  });

  it.each(["Accept all", "Reject all"])("returns focus to Cookie settings after %s", (name) => {
    render(<ConsentManager>{screenContent}</ConsentManager>);
    const button = screen.getByRole("button", { name });
    button.focus();
    fireEvent.click(button);
    expect(banner()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("opens Cookie settings on the first choice, and returns there on Cancel and Save", () => {
    document.cookie = `imageshield_consent=${V}.a1.m0; Path=/`;
    render(<ConsentManager>{screenContent}</ConsentManager>);

    fireEvent.click(trigger());
    expect(document.activeElement).toBe(firstChoice());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(document.activeElement).toBe(trigger());

    fireEvent.click(trigger());
    expect(document.activeElement).toBe(firstChoice());
    fireEvent.click(screen.getByRole("checkbox", { name: /Marketing/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save choices" }));
    expect(document.activeElement).toBe(trigger());
  });

  it("returns focus without scrolling for a mouse or a tap, and with it for a keyboard", () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    render(<ConsentManager>{screenContent}</ConsentManager>);

    fireEvent.click(screen.getByRole("button", { name: "Accept all" }), { detail: 1 });
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });

    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: false });
    focus.mockRestore();
  });
});

describe("ConsentManager placement", () => {
  it("puts the banner before the screen and Cookie settings after it", () => {
    render(<ConsentManager>{screenContent}</ConsentManager>);
    const screenEl = screen.getByRole("main");
    const follows = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    expect(follows(banner()!, screenEl)).toBe(true);
    expect(follows(screenEl, screen.getByRole("button", { name: "Cookie settings" }))).toBe(
      true,
    );
  });

  /* A remount would throw away whatever a visitor had typed on /details. */
  it("never remounts the screen when consent changes", () => {
    let mounts = 0;
    function Form() {
      useEffect(() => {
        mounts++;
      }, []);
      return (
        <main>
          <input aria-label="Email address" />
        </main>
      );
    }
    const form = <Form />;
    render(<ConsentManager>{form}</ConsentManager>);
    const email = () => screen.getByRole("textbox", { name: "Email address" });
    fireEvent.change(email(), { target: { value: "half-typed@" } });

    fireEvent.click(screen.getByRole("button", { name: "Choose what to allow" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Analytics/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save choices" }));
    fireEvent.click(screen.getByRole("button", { name: "Cookie settings" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Marketing/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save choices" }));

    expect(reloadPage).not.toHaveBeenCalled();
    expect((email() as HTMLInputElement).value).toBe("half-typed@");
    expect(mounts).toBe(1);
  });
});
