"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Heading } from "@astryxdesign/core/Heading";
import { Stack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { ServiceConnect } from "@/components/service-connect";
import { LinkConverter } from "@/components/link-converter";
import { Equalizer } from "@/components/animated-icons";
import { DancingLetters } from "@/components/dancing-letters";
import {
  SpotifyLogo,
  AppleLogo,
  DeezerLogo,
  TidalLogo,
  YouTubeMusicLogo,
  AmazonMusicLogo,
} from "@/components/icons";
import {
  IconArrowsExchange,
  IconEyeOff,
  IconLoader2,
  IconPlaylist,
} from "@tabler/icons-react";

function FeatureCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Stack className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card/60 p-5 transition-shadow hover:shadow-md">
      <Stack className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-muted text-accent">
        {icon}
      </Stack>
      <Text as="p" className="text-sm font-semibold">
        {title}
      </Text>
      <Text as="p" className="text-sm leading-relaxed text-secondary">
        {children}
      </Text>
    </Stack>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  // Check Spotify session and redirect to dashboard if authenticated
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch("/api/spotify/session");
        const data = await response.json();
        if (data.session) {
          router.push("/dashboard");
          return;
        }
      } catch (error) {
        console.error("Failed to check session:", error);
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();
  }, [router]);

  if (isLoading) {
    return (
      <Stack className="min-h-screen bg-body">
        <Stack direction="horizontal" className="flex items-center justify-center py-20">
          <IconLoader2 className="h-8 w-8 animate-spin text-accent" />
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack className="min-h-screen bg-body">
      <Stack className="relative">
        {/* Faint staff-line texture behind the hero */}
        <Stack aria-hidden className="hero-staff pointer-events-none absolute inset-x-0 top-0 h-96" />

        <Stack className="relative mx-auto w-full px-4">
          {/* Hero */}
          <Stack as="section" className="mx-auto w-full max-w-4xl pb-2 pt-16 text-center sm:pt-24">
            <Stack
              direction="horizontal"
              wrap="wrap"
              className="mx-auto mb-8 inline-flex items-center justify-center gap-2.5 rounded-full border border-border/70 bg-card px-4 py-2 text-xs font-medium text-secondary shadow-md"
            >
              {/* The logo sequence is the same as the service list in the
                  tagline below. Amazon Music is last because it is search-only. */}
              <SpotifyLogo className="h-3.5 w-3.5 text-green-vivid" />
              <AppleLogo className="h-3.5 w-3.5 text-red-vivid" />
              <Equalizer className="h-3 text-accent" />
              <DeezerLogo className="h-3.5 w-3.5 text-purple-vivid" />
              <TidalLogo className="h-3.5 w-3.5" />
              <YouTubeMusicLogo className="h-3.5 w-3.5 text-red-vivid" />
              <AmazonMusicLogo className="h-3.5 w-3.5 text-cyan-vivid" />
              <Text>6 music services</Text>
            </Stack>
            <Heading
              level={1}
              type="display-1"
              textWrap="balance"
              className="font-display text-4xl sm:text-6xl"
            >
              I made a music converter.{" "}
              <DancingLetters text="I use it myself" className="text-green-vivid" />.
            </Heading>
            <Text as="p" className="mx-auto mt-5 max-w-2xl text-balance text-lg text-secondary sm:text-xl">
              Paste a link or type a song name. Get matches on Spotify, Apple Music,
              Deezer, TIDAL, YouTube Music, and Amazon Music. No account needed.
            </Text>
          </Stack>

          {/* The one input */}
          <Stack as="section" className="mx-auto w-full max-w-6xl pb-4 pt-10">
            <LinkConverter />
          </Stack>

          {/* Sign-in, directly below the tool */}
          <Stack as="section" className="mx-auto w-full max-w-6xl pb-2 pt-12">
            <Stack direction="horizontal" className="mb-6 flex items-center gap-4">
              <Stack className="h-px flex-1 bg-border/70" />
              <Text type="supporting" color="secondary" weight="semibold" className="uppercase">
                Or sign in to convert full playlists
              </Text>
              <Stack className="h-px flex-1 bg-border/70" />
            </Stack>
            <ServiceConnect />
          </Stack>

          {/* Why it exists, in three beats */}
          <Stack as="section" className="mx-auto w-full max-w-6xl pb-20 pt-14">
            <Stack className="grid gap-4 sm:grid-cols-3">
              <FeatureCard icon={<IconArrowsExchange size={19} />} title="Every direction">
                One link becomes six. Tracks, albums, and artists matched across
                catalogs — by exact recording where the services allow it.
              </FeatureCard>
              <FeatureCard icon={<IconPlaylist size={19} />} title="Playlists travel too">
                Sign in to move whole playlists between services, or hand anyone a
                48-hour share link and let them import it into theirs.
              </FeatureCard>
              <FeatureCard icon={<IconEyeOff size={19} />} title="Nothing to keep up">
                No account needed for links. Your history lives in this browser,
                not on a server.
              </FeatureCard>
            </Stack>
          </Stack>
        </Stack>
      </Stack>
    </Stack>
  );
}
