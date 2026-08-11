import type { Metadata } from "next";
import { Heading } from "@astryxdesign/core/Heading";
import { Stack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { LinkConverter } from "@/components/link-converter";

export const metadata: Metadata = {
  title: "Convert a Link",
  description:
    "Convert song, album, and artist links between Spotify, Apple Music, Deezer, TIDAL, YouTube Music, and Amazon Music. No sign-in required.",
  alternates: { canonical: "/convert" },
};

function extractUrl(params: { [key: string]: string | string[] | undefined }): string | undefined {
  const direct = typeof params.url === "string" ? params.url : undefined;
  if (direct?.startsWith("http")) return direct;
  // Android share sheets often put the link inside shared text
  const text = typeof params.text === "string" ? params.text : "";
  const match = text.match(/https?:\/\/\S+/);
  return match?.[0];
}

export default async function ConvertPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sharedUrl = extractUrl(await searchParams);
  return (
    <Stack className="min-h-screen bg-body">
      <Stack className="relative">
        <Stack aria-hidden className="hero-staff pointer-events-none absolute inset-x-0 top-0 h-72" />
        <Stack className="relative mx-auto w-full px-4">
          <Stack as="section" className="mx-auto w-full max-w-3xl pt-14 text-center sm:pt-20">
            <Heading level={1} className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Convert a link
            </Heading>
            <Text as="p" className="mx-auto mt-4 max-w-lg text-balance text-secondary sm:text-lg">
              One link in, every service out. Playlists become 48-hour share links.
            </Text>
          </Stack>
          <Stack as="section" className="mx-auto w-full max-w-6xl pb-16 pt-8">
            <LinkConverter initialUrl={sharedUrl} />
          </Stack>
        </Stack>
      </Stack>
    </Stack>
  );
}
