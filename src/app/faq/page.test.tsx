import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FAQ_INSTALL_PATH, STORE_LINKS } from "@/lib/site-nav";
import FaqPage from "./page";

/* The header's Download link and `/get-app`'s desktop fallback both land on this
   page's install block. A renamed id leaves both pointing at nothing, with no error
   anywhere, so the two ends are checked against each other here. */
describe("FAQ install block", () => {
  it("is what the header's Download link points at, and carries both badges", () => {
    const { container } = render(<FaqPage />);

    // Spelled out rather than taken from the constant, so a link quietly pointed
    // back at the parked landing page's `#download` fails here.
    expect(FAQ_INSTALL_PATH).toBe("/faq#install");
    expect(screen.getByRole("link", { name: "Download" })).toHaveProperty(
      "hash",
      "#install",
    );

    const block = container.querySelector<HTMLElement>("#install");
    expect(block).not.toBeNull();
    const hrefs = within(block!)
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([STORE_LINKS.appStore, STORE_LINKS.googlePlay]);
  });
});
