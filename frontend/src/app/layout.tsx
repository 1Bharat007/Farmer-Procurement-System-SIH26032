import type { Metadata } from "next";
import { Roboto, Noto_Sans_Gurmukhi } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-roboto",
  display: "swap",
});

/**
 * Noto Sans Gurmukhi provides full Gurmukhi script glyph coverage.
 * Roboto does NOT include Gurmukhi glyphs, so without this fallback
 * all Punjabi text would render as boxes ("tofu"). This font is loaded
 * as a CSS variable and applied only when locale === 'pa' via the
 * `font-gurmukhi` CSS class defined in globals.css.
 */
const notoGurmukhi = Noto_Sans_Gurmukhi({
  weight: ["400", "500", "700"],
  subsets: ["gurmukhi"],
  variable: "--font-noto-gurmukhi",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KisanSlot — Farmer Procurement Queue & Slot Platform",
  description:
    "Ministry of Consumer Affairs, Food & Public Distribution — Smart India Hackathon 2026",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${roboto.variable} ${notoGurmukhi.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-[#202124] font-sans">
        {children}
      </body>
    </html>
  );
}
