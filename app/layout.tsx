import type { Metadata } from "next";
import { Averia_Serif_Libre } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { AppShell } from "@astryxdesign/core/AppShell";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { auth } from "@/lib/auth";
import "./layers.css";
import "./globals.css";

// Display face for titles and branding only — not body copy
const averia = Averia_Serif_Libre({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-music-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Lab86 Music",
    template: "%s | Lab86 Music",
  },
  description: "I made a universal music service converter",
  metadataBase: new URL("https://music.lab86.io"),
  // Absolute canonical also de-duplicates the playlist.jakoblangtry.com mirror
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    siteName: "Lab86 Music",
    title: "Lab86 Music",
    description: "I made a music converter",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "Lab86 Music" }],
  },
  twitter: {
    card: "summary",
    title: "Lab86 Music",
    description: "I made a music converter",
    images: ["/icon-512.png"],
  },
  appleWebApp: {
    capable: true,
    title: "Lab86 Music",
    statusBarStyle: "black-translucent",
  },
};

const siteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Lab86 Music",
  alternateName: "Lab86 Convert",
  url: "https://music.lab86.io/",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  description:
    "Convert songs, albums, artists, and playlists between Spotify, Apple Music, Deezer, TIDAL, YouTube Music, and Amazon Music.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html
      lang="en"
      data-theme="system"
      data-astryx-theme="matcha"
      className={averia.variable}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('theme');
                  var theme = stored === 'light' || stored === 'dark'
                    ? stored
                    : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                  document.documentElement.dataset.theme = theme;
                  document.documentElement.dataset.astryxTheme = 'matcha';
                } catch (e) {}
              })();
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              document.addEventListener('musickitloaded', function() {
                if (window.MusicKit) {
                  console.log('MusicKit loaded');
                }
              });
            `,
          }}
        />
        <script
          src="https://js-cdn.music.apple.com/musickit/v3/musickit.js"
          async
          data-web-components
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <SessionProvider session={session}>
            <AppShell height="auto" variant="surface" contentPadding={0}>
              <Header />
              {children}
              <Footer />
            </AppShell>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
