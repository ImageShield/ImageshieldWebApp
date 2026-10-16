"use client";

import Script from "next/script";
import { type Consent, googleConsent } from "@/lib/consent";

/** The same container imageshield.com runs. */
const GTM_ID = "GTM-NM7B8G3X";
const HUBSPOT_PORTAL_ID = "20495177";

/**
 * Tag Manager and HubSpot, each rendered only once the visitor has opted into its
 * category. Nothing here is in the page before that — Google's "basic" consent mode
 * — so a visitor who declines, or never answers, sends neither company anything.
 *
 * The consent defaults go out in the same inline script as the container, ahead of
 * it, so no tag can ever run before the signals it checks exist. HubSpot's own
 * cookie banner is switched off because this one has already asked.
 *
 * Mounted once from the root layout, which a client-side navigation never remounts,
 * and `next/script` runs each `id` once per page load, so walking the quiz can't
 * load either a second time.
 */
export function TrackingScripts({ consent }: { consent: Consent }) {
  return (
    <>
      {consent.analytics ? (
        <Script id="gtm-init">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',${JSON.stringify(googleConsent(consent))});
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>
      ) : null}
      {consent.marketing ? (
        <>
          <Script id="hs-banner-off">{`window.disableHubSpotCookieBanner=true;`}</Script>
          <Script
            id="hs-script-loader"
            src={`https://js.hs-scripts.com/${HUBSPOT_PORTAL_ID}.js`}
          />
        </>
      ) : null}
    </>
  );
}
