import NextLink from "next/link";
import { SEO_PAGES } from "@/lib/seo-pages";

/**
 * Global footer. This is the only place where every page links to the SEO
 * landing pages, so crawlers can reach them from the home page.
 */

const POPULAR_PAIRS = [
  { slug: "spotify-to-apple-music", label: "Spotify to Apple Music" },
  { slug: "apple-music-to-spotify", label: "Apple Music to Spotify" },
  { slug: "spotify-to-youtube-music", label: "Spotify to YouTube Music" },
  { slug: "youtube-music-to-spotify", label: "YouTube Music to Spotify" },
  { slug: "spotify-to-tidal", label: "Spotify to TIDAL" },
  { slug: "spotify-to-deezer", label: "Spotify to Deezer" },
] as const;

const TOOL_LINKS = [
  { href: "/", label: "Link converter" },
  { href: "/convert", label: "Convert a link" },
  { href: "/playlist-converter", label: "Playlist converter" },
] as const;

function FooterColumn({
  heading,
  links,
}: {
  heading: string;
  links: ReadonlyArray<{ href: string; label: string }>;
}) {
  return (
    <nav aria-label={heading}>
      <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
        {heading}
      </p>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <NextLink
              href={link.href}
              className="text-sm text-secondary transition-colors hover:text-primary"
            >
              {link.label}
            </NextLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border/70 bg-body">
      <div className="mx-auto w-full max-w-6xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-3">
          <FooterColumn heading="Tools" links={TOOL_LINKS} />
          <FooterColumn
            heading="Popular conversions"
            links={POPULAR_PAIRS.map((pair) => ({
              href: `/${pair.slug}`,
              label: pair.label,
            }))}
          />
          <FooterColumn
            heading="Compare"
            links={SEO_PAGES.map((page) => ({
              href: `/${page.slug}`,
              label: page.label,
            }))}
          />
        </div>
        <p className="mt-10 text-xs text-secondary/80">
          Lab86 Music converts songs, albums, artists, and playlists between six
          music services. Made by{" "}
          <a
            href="https://jakoblangtry.com"
            className="underline decoration-border underline-offset-2 transition-colors hover:text-primary"
          >
            Jakob Langtry
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
