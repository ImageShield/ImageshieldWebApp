import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /*
     * 75 is the default and what every other image on the site wants. 90 is for the
     * landing hero alone: a near-black photograph whose entire subject is one lit
     * face, which the optimizer takes to 16KB at 75 — the eyelashes and the hair go
     * into the dark with it. Next refuses any quality not listed here, so adding the
     * value to the tag is not enough on its own.
     */
    qualities: [75, 90],
  },
  /*
   * The share poster's rasteriser. It picks a prebuilt `.node` binary for the
   * platform at runtime — linux-x64 on Amplify — which the bundler can't inline, so
   * Node loads it instead and output file tracing ships the binary with the route.
   */
  serverExternalPackages: ["@resvg/resvg-js"],
};

export default nextConfig;
