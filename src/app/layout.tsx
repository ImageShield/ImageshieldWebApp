import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ConsentManager } from "@/components/consent/ConsentManager";
import { FaviconTheme } from "@/components/FaviconTheme";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ImageShield",
  description: "Find out how exposed your likeness is online.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the page paint under the notch; screens opt in with the safe-area padding.
  viewportFit: "cover",
  themeColor: "#380e99",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plusJakarta.variable} h-full antialiased`}>
      {/* `relative` so the "Cookie settings" link can sit at the foot of the page. */}
      <body className="relative min-h-full">
        {/* Here, not per screen: the root layout is never remounted by a client-side
            navigation, so the choice and the scripts it allowed load once. */}
        <ConsentManager>{children}</ConsentManager>
        <FaviconTheme />
      </body>
    </html>
  );
}
