import type { Metadata } from "next";
import { Heading } from "@astryxdesign/core/Heading";
import { Link } from "@astryxdesign/core/Link";
import { Stack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { LinkConverter } from "@/components/link-converter";
import { CONVERSION_PAIRS, findPair, type ConversionPair, type SeoService } from "@/lib/seo-pairs";
import { SEO_PAGES } from "@/lib/seo-pages";

export const dynamicParams = false;

export function generateStaticParams() {
  return CONVERSION_PAIRS.map((pair) => ({ pair: pair.slug }));
}

interface PageProps {
  params: Promise<{ pair: string }>;
}

function pageDescription(pair: ConversionPair): string {
  if (pair.to.id === "amazon") {
    return `Free ${pair.from.name} to ${pair.to.name} converter. Paste a song, album, or artist link from ${pair.from.name} and get a matching ${pair.to.name} link. No account, no limits, no ads.`;
  }
  return `Free ${pair.from.name} to ${pair.to.name} converter for songs, albums, artists, and playlists. Exact ISRC matching, no account for single links, no ads.`;
}

/** What happens when converting INTO this service. */
function targetNote(to: SeoService): string {
  switch (to.id) {
    case "spotify":
      return "Playlist imports into Spotify use the normal Spotify sign in. A free Spotify account is enough.";
    case "apple":
      return "Playlist imports into Apple Music sign in through MusicKit, Apple's own web player, so nothing unofficial touches your account.";
    case "tidal":
      return "The TIDAL connection is official OAuth, and imports match by ISRC, so playlists come across exact.";
    case "youtube":
      return "YouTube imports use Google sign in. YouTube's API has a small daily quota, so a very long playlist can take more than one day to finish.";
    case "deezer":
      return "Deezer closed its developer program, so playlist imports use an opt-in browser session connection I label Advanced. Single links need nothing.";
    case "amazon":
      return "Amazon has no public catalog API, so results are pre-filled Amazon Music searches. The right result is almost always the first one.";
  }
}

interface FaqItem {
  question: string;
  answer: string;
}

function buildFaq(pair: ConversionPair): FaqItem[] {
  const { from, to } = pair;
  const faq: FaqItem[] = [];

  faq.push({
    question: "Is this free? Do I need an account?",
    answer:
      to.id === "amazon"
        ? "Yes, free, with no ads and no caps. Songs, albums, and artists convert without any sign in. Amazon Music has no public API, so the result is a pre-filled Amazon search that lands on the right item."
        : `Yes, free, with no ads and no caps on link conversion. Songs, albums, and artists convert without any sign in. Converting a full playlist into ${to.name} needs a quick sign in so the playlist can be created in your own library.`,
  });

  faq.push({
    question: "How accurate are the matches?",
    answer:
      "Songs match by ISRC first, the recording industry's unique ID for a recording, so most matches are exact rather than guessed. When a catalog does not report an ISRC, the converter compares title, artist, and album and shows a confidence score so you can judge the match yourself.",
  });

  if (to.id === "amazon") {
    faq.push({
      question: `Can I convert a whole ${from.name} playlist to ${to.name}?`,
      answer:
        "No. Amazon Music has no public API for playlists. A playlist link still works here, but it becomes a 48 hour share page for the five other services instead.",
    });
  } else if (from.id === "youtube") {
    faq.push({
      question: `Can I convert a whole ${from.name} playlist to ${to.name}?`,
      answer: `Yes. Paste the playlist link to get a 48 hour share page anyone can import from, or sign in and convert it straight into ${to.name}. YouTube playlists carry no track IDs, so tracks match by title and accuracy can vary.`,
    });
  } else {
    faq.push({
      question: `Can I convert a whole ${from.name} playlist to ${to.name}?`,
      answer: `Yes. Paste the playlist link to get a 48 hour share page, or sign in and convert it straight into your ${to.name} library. Matching is ISRC first, so playlists come across accurately, and you get a per-track report for anything that needs attention.`,
    });
  }

  faq.push({
    question: "Does it handle albums and artists too?",
    answer:
      to.id === "amazon"
        ? `Yes. Album and artist links from ${from.name} become matching Amazon Music searches, and every conversion also gets a universal page that lists all six services with a QR code.`
        : `Yes. Album links map to the same album on ${to.name} and artist links map to the artist page. Every conversion also gets a universal page that lists all six services with a QR code, handy for sharing with people who use something else entirely.`,
  });

  switch (to.id) {
    case "spotify":
      faq.push({
        question: "Do I need Spotify Premium?",
        answer:
          "No. Link conversion needs nothing at all, and playlist imports work with a free Spotify account.",
      });
      break;
    case "apple":
      faq.push({
        question: "Do I need an Apple Music subscription?",
        answer:
          "Converting links needs nothing. Importing a playlist into your library needs an active Apple Music subscription, because Apple only lets subscribers save music.",
      });
      break;
    case "tidal":
      faq.push({
        question: "Is the TIDAL connection official?",
        answer:
          "Yes. It uses TIDAL's official OAuth sign in, the same flow the TIDAL app uses, and imports are ISRC exact.",
      });
      break;
    case "youtube":
      faq.push({
        question: "Why do long playlists pause partway?",
        answer:
          "YouTube's Data API has a small daily quota, roughly 60 track additions a day. If a playlist is longer than that, the import stops at the quota and you can convert the rest the next day. The playlist it already created stays in your library.",
      });
      break;
    case "deezer":
      faq.push({
        question: "Why is the Deezer connection labeled Advanced?",
        answer:
          "Deezer stopped accepting new developer apps, so there is no official sign in to offer. The Advanced connection uses your own browser session value, stored only in an HTTP-only cookie, never in a database. It is opt-in and clearly marked because it is unofficial.",
      });
      break;
    case "amazon":
      faq.push({
        question: "Why do I get a search instead of a direct link?",
        answer:
          "Amazon Music has no public catalog API, so no converter can produce true direct links. A pre-filled search is the honest version of this feature, and in practice the first result is the right one.",
      });
      break;
  }

  return faq;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { pair: slug } = await params;
  const pair = findPair(slug);
  if (!pair) return {};
  const title = `${pair.from.name} to ${pair.to.name} Converter`;
  const description = pageDescription(pair);
  return {
    title,
    description,
    alternates: { canonical: `/${pair.slug}` },
    openGraph: { title, description, url: `/${pair.slug}` },
  };
}

export default async function ConversionPairPage({ params }: PageProps) {
  const { pair: slug } = await params;
  const pair = findPair(slug);
  if (!pair) notFound();

  const { from, to } = pair;
  const faq = buildFaq(pair);
  const others = CONVERSION_PAIRS.filter((p) => p.slug !== pair.slug);

  const steps =
    to.id === "amazon"
      ? [
          `Copy a link in ${from.name}. Songs, albums, and artists all work.`,
          "Paste it in the box above. No account, nothing to install.",
          `Open the pre-filled ${to.name} search. The right result is almost always first.`,
        ]
      : [
          `Copy a link in ${from.name}. Songs, albums, artists, and playlists all work.`,
          "Paste it in the box above. Single links need no account at all.",
          `Open the ${to.name} match, copy it, or sign in once to import a playlist straight into your library.`,
        ];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <Stack className="min-h-screen bg-body">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Stack className="relative">
        <Stack aria-hidden className="hero-staff pointer-events-none absolute inset-x-0 top-0 h-72" />
        <Stack className="relative mx-auto w-full px-4">
          <Stack as="section" className="mx-auto w-full max-w-2xl pt-12 text-center sm:pt-16">
            <Heading level={1} className="font-display text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Convert {from.name} to {to.name}
            </Heading>
            <Text as="p" className="mx-auto mt-3 max-w-md text-balance text-secondary">
              {to.id === "amazon"
                ? `Paste a ${from.name} link and get the ${to.name} version. Free, no account.`
                : `Paste a ${from.name} link and get the ${to.name} version. Free, no account, playlists included.`}
            </Text>
          </Stack>

          <Stack as="section" className="mx-auto w-full max-w-4xl pb-10 pt-8">
            <LinkConverter showHistory={false} />
          </Stack>

          <Stack as="section" className="mx-auto w-full max-w-2xl pb-10">
            <Heading level={2} className="text-xs font-semibold uppercase tracking-wide text-secondary">
              How it works
            </Heading>
            <Stack as="ol" className="mt-2 space-y-2">
              {steps.map((step, index) => (
                <Stack as="li" direction="horizontal" key={step} className="gap-3 text-sm leading-relaxed text-secondary">
                  <Text className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-muted text-xs font-semibold text-accent">
                    {index + 1}
                  </Text>
                  {step}
                </Stack>
              ))}
            </Stack>
            <Text as="p" className="mt-4 text-sm leading-relaxed text-secondary">
              This is the same converter that runs on the{" "}
              <Link href="/" className="font-medium text-primary hover:underline">
                home page
              </Link>
              . Songs match by ISRC, the recording industry&apos;s unique recording ID, with a
              title and artist comparison as fallback and a visible confidence score.{" "}
              {targetNote(to)}
            </Text>
          </Stack>

          <Stack as="section" className="mx-auto w-full max-w-2xl pb-10">
            <Heading level={2} className="text-xs font-semibold uppercase tracking-wide text-secondary">
              Common questions
            </Heading>
            <dl className="mt-2 space-y-4">
              {faq.map((item) => (
                <Stack key={item.question}>
                  <dt className="text-sm font-semibold">{item.question}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-secondary">
                    {item.answer}
                  </dd>
                </Stack>
              ))}
            </dl>
          </Stack>

          <Stack as="section" className="mx-auto w-full max-w-2xl pb-16">
            <Heading level={2} className="text-xs font-semibold uppercase tracking-wide text-secondary">
              Other directions
            </Heading>
            <Stack as="ul" direction="horizontal" wrap="wrap" className="mt-2 gap-x-4 gap-y-1.5">
              {others.map((other) => (
                <Stack as="li" key={other.slug}>
                  <Link
                    href={`/${other.slug}`}
                    className="text-xs text-secondary transition-colors hover:text-primary hover:underline"
                  >
                    {other.from.name} to {other.to.name}
                  </Link>
                </Stack>
              ))}
              {SEO_PAGES.map((page) => (
                <Stack as="li" key={page.slug}>
                  <Link
                    href={`/${page.slug}`}
                    className="text-xs text-secondary transition-colors hover:text-primary hover:underline"
                  >
                    {page.label}
                  </Link>
                </Stack>
              ))}
            </Stack>
          </Stack>
        </Stack>
      </Stack>
    </Stack>
  );
}
