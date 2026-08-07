import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Rift Rotor: Two Worlds, One Flight",
    template: "%s · Rift Rotor",
  },
  description:
    "A neon dimension-shifting browser flight game. Hold to rise, release to fall, and phase between two deadly worlds.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "Rift Rotor: Two Worlds, One Flight",
    description: "Hold to rise. Shift to survive. Master two worlds at once.",
    images: [{ url: "/og.png", width: 1730, height: 909, alt: "Rift Rotor Solar and Void worlds" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rift Rotor: Two Worlds, One Flight",
    description: "Hold to rise. Shift to survive.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#060812",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
