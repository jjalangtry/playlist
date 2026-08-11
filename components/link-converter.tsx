"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { Item } from "@astryxdesign/core/Item";
import { List } from "@astryxdesign/core/List";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { HStack, Stack, StackItem } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import {
  IconLoader2,
  IconArrowRight,
  IconCopy,
  IconCheck,
  IconExternalLink,
  IconTrash,
  IconChevronDown,
  IconAlertTriangle,
  IconLink,
  IconSearch,
  IconWorld,
  IconClipboard,
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
} from "@tabler/icons-react";
import { toast } from "@/lib/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  SpotifyLogo,
  AppleLogo,
  DeezerLogo,
  TidalLogo,
  YouTubeMusicLogo,
  AmazonMusicLogo,
} from "@/components/icons";
import { parseMusicUrl, isAmazonMusicUrl, isDeezerShortLink } from "@/lib/url-parser";
import { cn } from "@/lib/utils";
import type {
  LinkMetadata,
  MusicItemType,
  MusicService,
  ServiceLink,
} from "@/lib/link-converter";

// v2: multi-service result shape (old single-target entries are discarded)
const HISTORY_KEY = "linkConversionHistory.v2";
const HISTORY_LIMIT = 10;

const BRAND: Record<
  MusicService,
  { name: string; logo: string; chip: string }
> = {
  spotify: {
    name: "Spotify",
    logo: "text-green-vivid",
    chip: "bg-green-subtle text-green-vivid",
  },
  apple: {
    name: "Apple Music",
    logo: "text-red-vivid",
    chip: "bg-red-subtle text-red-vivid",
  },
  tidal: {
    name: "TIDAL",
    logo: "text-primary",
    chip: "bg-neutral text-primary",
  },
  deezer: {
    name: "Deezer",
    logo: "text-purple-vivid",
    chip: "bg-purple-subtle text-purple-vivid",
  },
  youtube: {
    name: "YouTube Music",
    logo: "text-red-vivid",
    chip: "bg-red-subtle text-red-vivid",
  },
  amazon: {
    name: "Amazon Music",
    logo: "text-cyan-vivid",
    chip: "bg-cyan-subtle text-cyan-vivid",
  },
};

function ServiceLogo({
  service,
  className,
  colored = false,
}: {
  service: MusicService;
  className?: string;
  colored?: boolean;
}) {
  const props = {
    className: cn(className, colored && BRAND[service].logo),
  };
  switch (service) {
    case "spotify":
      return <SpotifyLogo {...props} />;
    case "apple":
      return <AppleLogo {...props} />;
    case "tidal":
      return <TidalLogo {...props} />;
    case "deezer":
      return <DeezerLogo {...props} />;
    case "youtube":
      return <YouTubeMusicLogo {...props} />;
    case "amazon":
      return <AmazonMusicLogo {...props} />;
  }
}

interface ConversionResponse {
  kind: "conversion";
  type: MusicItemType;
  sourceService: MusicService;
  source: LinkMetadata;
  links: ServiceLink[];
  primary: ServiceLink | null;
  /** Universal landing page listing every service */
  pageUrl?: string;
}

interface PlaylistShareResponse {
  kind: "playlist";
  shareUrl: string;
  playlistName: string;
  trackCount: number;
  service: string;
  image: string | null;
}

type ConvertApiResponse = ConversionResponse | PlaylistShareResponse;

interface HistoryItem {
  timestamp: number;
  result: ConversionResponse;
}

interface SearchCandidate {
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  url: string;
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim()) || /^[\w.-]+\.[a-z]{2,}\//i.test(value.trim());
}

function formatDuration(ms?: number) {
  if (!ms) return null;
  const totalSeconds = Math.round(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, "0")}`;
}

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) => item && typeof item.timestamp === "number" && item.result?.source
    );
  } catch {
    return [];
  }
}

function CopyIconButton({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Tooltip>
      <TooltipTrigger
        onClick={async (e) => {
          e.stopPropagation();
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-body/70 text-secondary transition-colors hover:text-primary hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-bg",
          className
        )}
      >
        {copied ? (
          <IconCheck size={16} className="text-accent" />
        ) : (
          <IconCopy size={16} />
        )}
      </TooltipTrigger>
      <TooltipContent>{copied ? "Copied!" : label}</TooltipContent>
    </Tooltip>
  );
}

function ConfidenceMeter({ link }: { link: ServiceLink }) {
  if (link.confidence == null) return null;
  const explanation =
    link.matchMethod === "isrc"
      ? "Exact recording match. Both services report the same ISRC code for this recording."
      : "Matched by comparing title, artist, and album across catalogs.";
  return (
    <Tooltip>
      <TooltipTrigger
        className="flex cursor-help items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-bg"
        type="button"
      >
        <ProgressBar
          className="w-20"
          label={`${link.confidence}% match confidence`}
          value={link.confidence}
          isLabelHidden
          variant={
            link.confidence >= 80
              ? "success"
              : link.confidence >= 50
                ? "warning"
                : "error"
          }
        />
        <Text className="text-xs tabular-nums text-secondary">
          {link.confidence}% match
        </Text>
      </TooltipTrigger>
      <TooltipContent>{explanation}</TooltipContent>
    </Tooltip>
  );
}

function PreviewButton({ url }: { url: string }) {
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return () => {
      audio?.pause();
    };
  }, [audio]);

  const toggle = () => {
    if (playing) {
      audio?.pause();
      setPlaying(false);
      return;
    }
    const el = audio ?? new Audio(url);
    if (!audio) {
      el.addEventListener("ended", () => setPlaying(false));
      setAudio(el);
    }
    el.play();
    setPlaying(true);
  };

  return (
    <Tooltip>
      <TooltipTrigger
        onClick={toggle}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-body/70 text-secondary transition-colors hover:text-primary hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-bg"
      >
        {playing ? <IconPlayerPauseFilled size={15} /> : <IconPlayerPlayFilled size={15} />}
      </TooltipTrigger>
      <TooltipContent>{playing ? "Pause preview" : "Play 30s preview"}</TooltipContent>
    </Tooltip>
  );
}

function ServicePill({ link }: { link: ServiceLink }) {
  const brand = BRAND[link.service];
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            label={brand.name}
            icon={<ServiceLogo service={link.service} className="h-3.5 w-3.5" colored />}
            endContent={link.kind === "search" ? <IconSearch size={11} /> : undefined}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            size="sm"
          />
        }
      />
      <TooltipContent>
        {link.kind === "direct"
          ? `Open on ${brand.name}${link.confidence != null ? `, ${link.confidence}% match` : ""}`
          : `${brand.name} has no public catalog API, so this opens a pre-filled search`}
      </TooltipContent>
    </Tooltip>
  );
}

function ConversionResult({ result }: { result: ConversionResponse }) {
  const primary = result.primary;
  const meta = primary?.metadata ?? result.source;
  const secondary = result.links.filter((l) => l.service !== primary?.service);

  if (!primary) {
    return (
      <Stack className="animate-rise-in mt-6 space-y-3 rounded-lg border border-border/70 bg-muted/40 px-4 py-3.5">
        <Stack direction="horizontal" align="start" className="gap-3">
          <IconAlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
          <Text as="p" className="text-sm leading-relaxed">
            Found <Text className="font-medium">{result.source.title}</Text>
            {result.type !== "artist" && <> by {result.source.artist}</>}, but no confident
            direct match on another catalog. Try the searches below.
          </Text>
        </Stack>
        {secondary.length > 0 && (
          <Stack direction="horizontal" wrap="wrap" align="center" className="gap-2 pl-8">
            {secondary.map((link) => (
              <ServicePill key={link.service} link={link} />
            ))}
          </Stack>
        )}
      </Stack>
    );
  }

  const brand = BRAND[primary.service];

  return (
    <Stack className="animate-rise-in relative mt-6 overflow-hidden rounded-lg border border-border/70 shadow-lg">
      {/* Artwork-derived backdrop, TIDAL-style */}
      {meta.artworkUrl && (
        <Image
          src={meta.artworkUrl}
          alt=""
          aria-hidden
          fill
          sizes="640px"
          className="scale-125 object-cover opacity-30 blur-2xl saturate-150 dark:opacity-25"
        />
      )}
      <Stack className="relative flex flex-col gap-4 bg-body/70 p-4 backdrop-blur-2xl sm:p-5 dark:bg-body/55">
        <Stack className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {meta.artworkUrl ? (
            <Image
              src={meta.artworkUrl}
              alt={meta.title}
              width={96}
              height={96}
              className={cn(
                "h-24 w-24 shrink-0 object-cover shadow-lg",
                result.type === "artist" ? "rounded-full" : "rounded-lg"
              )}
            />
          ) : (
            <Stack direction="horizontal" className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-muted">
              <ServiceLogo service={primary.service} className="h-9 w-9 opacity-60" />
            </Stack>
          )}

          <Stack className="min-w-0 flex-1">
            <Stack direction="horizontal" align="center" className="gap-1.5 text-xs font-medium uppercase tracking-wide text-secondary">
              <ServiceLogo service={primary.service} className="h-3.5 w-3.5" />
              {result.type} on {brand.name}
            </Stack>
            <Heading level={3} className="mt-1 truncate text-lg font-semibold leading-tight sm:text-xl">
              {meta.title}
            </Heading>
            {result.type !== "artist" ? (
              <Text as="p" className="truncate text-sm text-secondary">
                {meta.artist}
                {result.type === "track" && meta.album ? ` · ${meta.album}` : ""}
              </Text>
            ) : (
              meta.genres && (
                <Text as="p" className="truncate text-sm text-secondary">
                  {meta.genres.slice(0, 3).join(" · ")}
                </Text>
              )
            )}

            <Stack direction="horizontal" wrap="wrap" align="center" className="mt-3 gap-2.5">
              <Button
                label={`Open in ${brand.name}`}
                endContent={<IconExternalLink size={14} />}
                href={primary.url}
                target="_blank"
                rel="noopener noreferrer"
                variant="primary"
              />
              <CopyIconButton value={primary.url} label="Copy link" />
              {result.pageUrl && (
                <Tooltip>
                  <TooltipTrigger
                    onClick={async () => {
                      await navigator.clipboard.writeText(result.pageUrl!);
                      toast.success("Universal link copied. One page, every service.");
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-body/70 text-secondary transition-colors hover:text-primary hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-bg"
                  >
                    <IconWorld size={16} />
                  </TooltipTrigger>
                  <TooltipContent>
                    Copy universal link, a page where anyone picks their service
                  </TooltipContent>
                </Tooltip>
              )}
              {meta.previewUrl && <PreviewButton url={meta.previewUrl} />}
              <Stack className="ml-auto hidden sm:block">
                <ConfidenceMeter link={primary} />
              </Stack>
            </Stack>
            <Stack className="mt-2.5 sm:hidden">
              <ConfidenceMeter link={primary} />
            </Stack>
          </Stack>
        </Stack>

        {secondary.length > 0 && (
          <Stack direction="horizontal" wrap="wrap" align="center" className="gap-2 border-t border-border/50 pt-3.5">
            <Text className="mr-1 text-xs font-medium uppercase tracking-wide text-secondary">
              Also on
            </Text>
            {secondary.map((link) => (
              <ServicePill key={link.service} link={link} />
            ))}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}

function PlaylistResult({ result }: { result: PlaylistShareResponse }) {
  return (
    <Stack className="animate-rise-in relative mt-6 overflow-hidden rounded-lg border border-border/70 shadow-lg">
      {result.image && (
        <Image
          src={result.image}
          alt=""
          aria-hidden
          fill
          sizes="640px"
          className="scale-125 object-cover opacity-30 blur-2xl saturate-150 dark:opacity-25"
        />
      )}
      <Stack className="relative flex flex-col gap-4 bg-body/70 p-4 backdrop-blur-2xl sm:flex-row sm:items-center sm:p-5 dark:bg-body/55">
        {result.image ? (
          <Image
            src={result.image}
            alt={result.playlistName}
            width={96}
            height={96}
            className="h-24 w-24 shrink-0 rounded-lg object-cover shadow-lg"
          />
        ) : (
          <Stack direction="horizontal" className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-muted">
            <IconLink size={28} className="opacity-50" />
          </Stack>
        )}
        <Stack className="min-w-0 flex-1">
          <Stack className="text-xs font-medium uppercase tracking-wide text-secondary">
            Share link · expires in 48 hours
          </Stack>
          <Heading level={3} className="mt-1 truncate text-lg font-semibold leading-tight sm:text-xl">
            {result.playlistName}
          </Heading>
          <Text as="p" className="text-sm text-secondary">
            {result.trackCount} tracks · from {result.service}
          </Text>
          <Stack direction="horizontal" wrap="wrap" align="center" className="mt-3 gap-2.5">
            <code className="min-w-0 flex-1 truncate rounded-full border border-border/70 bg-body/70 px-3.5 py-2 text-xs">
              {result.shareUrl}
            </code>
            <CopyIconButton value={result.shareUrl} label="Copy share link" />
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    label="Open share page"
                    isIconOnly
                    icon={<IconExternalLink size={16} />}
                    href={result.shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="secondary"
                  />
                }
              />
              <TooltipContent>Open share page</TooltipContent>
            </Tooltip>
          </Stack>
          <Text as="p" className="mt-2.5 text-xs text-secondary">
            Anyone with this link can sign in on the page and import the playlist into their
            own service.
          </Text>
        </Stack>
      </Stack>
    </Stack>
  );
}

function HistoryRow({ item }: { item: HistoryItem }) {
  const [expanded, setExpanded] = useState(false);
  const { result } = item;
  const primary = result.primary;
  if (!primary) return null;
  const meta = primary.metadata ?? result.source;
  const brand = BRAND[primary.service];

  return (
    <Stack
      as="li"
      className="self-start overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm transition-shadow hover:shadow-md"
    >
      <Stack
        direction="horizontal"
        align="center"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        className="group flex w-full cursor-pointer items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-bg"
      >
        {meta.artworkUrl ? (
          <Image
            src={meta.artworkUrl}
            alt=""
            width={48}
            height={48}
            className={cn(
              "h-12 w-12 shrink-0 object-cover shadow-sm",
              result.type === "artist" ? "rounded-full" : "rounded-md"
            )}
          />
        ) : (
          <Stack direction="horizontal" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted">
            <ServiceLogo service={primary.service} className="h-5 w-5 opacity-60" />
          </Stack>
        )}
        <Stack className="min-w-0 flex-1">
          <Text as="p" className="truncate text-sm font-medium">{meta.title}</Text>
          <Text as="p" className="truncate text-xs text-secondary">
            {result.type === "artist" ? brand.name : meta.artist} ·{" "}
            {new Date(item.timestamp).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </Text>
        </Stack>
        <Text
          className={cn(
            "hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize sm:inline-flex",
            brand.chip
          )}
        >
          <ServiceLogo service={primary.service} className="h-2.5 w-2.5" />
          {result.type}
        </Text>
        <Text
          onClick={(e) => e.stopPropagation()}
          className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <CopyIconButton value={primary.url} label="Copy link" className="h-8 w-8" />
        </Text>
        <IconChevronDown
          size={15}
          className={cn(
            "shrink-0 text-secondary/60 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </Stack>

      {expanded && (
        <Stack className="animate-rise-in space-y-2.5 border-t border-border/50 bg-muted/30 px-4 py-3 text-xs text-secondary">
          <Stack direction="horizontal" wrap="wrap" className="gap-x-4 gap-y-1">
            {result.type === "track" && meta.album && <Text>Album · {meta.album}</Text>}
            {meta.releaseDate && (
              <Text>Released · {new Date(meta.releaseDate).toLocaleDateString()}</Text>
            )}
            {meta.duration && <Text>Duration · {formatDuration(meta.duration)}</Text>}
            {meta.genres && <Text>Genres · {meta.genres.slice(0, 4).join(", ")}</Text>}
          </Stack>
          <Stack direction="horizontal" wrap="wrap" className="gap-1.5">
            {result.links.map((link) => (
              <ServicePill key={link.service} link={link} />
            ))}
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}

export function LinkConverter({
  showHistory = true,
  compact = false,
  initialUrl,
}: {
  showHistory?: boolean;
  /** Smaller input + no reserved detection space — for utility placement (dashboard). */
  compact?: boolean;
  /** Prefill and auto-convert (used by share-sheet and deep links). */
  initialUrl?: string;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConvertApiResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [autoRan, setAutoRan] = useState(false);
  const [candidates, setCandidates] = useState<SearchCandidate[] | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const detected = useMemo(() => parseMusicUrl(url), [url]);
  const isAmazon = useMemo(() => isAmazonMusicUrl(url), [url]);
  const isDeezerShort = useMemo(() => isDeezerShortLink(url), [url]);

  const isSearchMode = url.trim().length > 0 && !looksLikeUrl(url) && !parseMusicUrl(url);

  const runTextSearch = async () => {
    setIsConverting(true);
    setError(null);
    setResult(null);
    setCandidates(null);
    try {
      const response = await fetch(`/api/convert/search?q=${encodeURIComponent(url.trim())}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Search failed. Please try again.");
        return;
      }
      if (!data.results?.length) {
        setError("No songs found for that search. Try adding the artist name.");
        return;
      }
      setCandidates(data.results);
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setIsConverting(false);
    }
  };

  const convertUrl = async (targetUrl: string) => {
    setIsConverting(true);
    setError(null);
    setResult(null);
    setCandidates(null);

    try {
      const response = await fetch("/api/convert/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Conversion failed. Please try again.");
        return;
      }
      setResult(data);
      setUrl("");

      if (data.kind === "conversion" && data.primary) {
        const item: HistoryItem = { timestamp: Date.now(), result: data };
        setHistory((prev) => {
          const next = [item, ...prev].slice(0, HISTORY_LIMIT);
          try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
          } catch {
            // storage full/unavailable — history is best-effort
          }
          return next;
        });
      }
    } catch {
      setError("Conversion failed. Please try again.");
    } finally {
      setIsConverting(false);
    }
  };

  const handleConvert = async () => {
    if (!url.trim() || isConverting) return;
    if (isSearchMode) {
      await runTextSearch();
      return;
    }
    await convertUrl(url);
  };

  const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text?.trim()) setUrl(text.trim());
    } catch {
      // Clipboard read denied/unavailable — user can paste manually
    }
  };

  // Auto-convert when arriving via share sheet or deep link (?url=)
  useEffect(() => {
    if (initialUrl && !autoRan) {
      setAutoRan(true);
      handleConvert();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl, autoRan]);

  const detectedBrand = detected ? BRAND[detected.service] : null;

  return (
    <Stack className="w-full">
      {/* The hero object: one big pill with the actions living inside it */}
      <HStack
        gap={compact ? 1 : 1.5}
        vAlign="center"
        width="100%"
        className={cn(
          "rounded-full border border-border/70 bg-surface transition-all focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-muted",
          compact
            ? "p-1 pl-1.5 shadow-sm"
            : "mx-auto w-full max-w-4xl p-1 pl-2 shadow-lg focus-within:shadow-xl sm:p-1.5 sm:pl-4"
        )}
      >
        <StackItem size="fill">
          <TextInput
            label="Music link or song search"
            isLabelHidden
            value={url}
            onChange={setUrl}
            onEnter={handleConvert}
            isDisabled={isConverting}
            placeholder={compact ? "Convert a music link…" : "Paste a link or type a song name"}
            startIcon={<IconLink size={compact ? 15 : 20} />}
            size={compact ? "sm" : "lg"}
            width="100%"
            className={cn(
              "border-0 bg-transparent shadow-none",
              compact ? "h-8" : "[&_input]:sm:text-lg"
            )}
          />
        </StackItem>
        {!url.trim() && !isConverting && (
          <>
            <Button
              className={compact ? undefined : "sm:hidden"}
              label="Paste"
              icon={<IconClipboard size={compact ? 13 : 14} />}
              onClick={pasteFromClipboard}
              variant="ghost"
              size="sm"
              isIconOnly
              tooltip="Paste from clipboard"
            />
            {!compact && (
              <Button
                className="hidden sm:inline-flex"
                label="Paste"
                icon={<IconClipboard size={15} />}
                onClick={pasteFromClipboard}
                variant="ghost"
                size="lg"
                tooltip="Paste from clipboard"
              />
            )}
          </>
        )}
        <Button
          className={compact ? undefined : "sm:hidden"}
          label={isConverting ? "Matching…" : isSearchMode ? "Search" : "Convert"}
          icon={
            isSearchMode ? (
              <IconSearch size={15} />
            ) : (
              <IconArrowRight size={15} />
            )
          }
          onClick={handleConvert}
          isDisabled={!url.trim() || isConverting}
          isLoading={isConverting}
          isIconOnly
          variant="primary"
          size="sm"
        />
        {!compact && (
          <Button
            className="hidden sm:inline-flex"
            label={isConverting ? "Matching…" : isSearchMode ? "Search" : "Convert"}
            icon={
              isSearchMode ? (
                <IconSearch size={17} />
              ) : (
                <IconArrowRight size={17} />
              )
            }
            onClick={handleConvert}
            isDisabled={!url.trim() || isConverting}
            isLoading={isConverting}
            variant="primary"
            size="lg"
          />
        )}
      </HStack>

      {/* Live detection line */}
      <Stack
        direction="horizontal"
        justify="center"
        align="center"
        className={cn(
          compact
            ? url.trim()
              ? "mt-1.5 justify-start pl-2"
              : "hidden"
            : "mt-3 min-h-6 justify-center"
        )}
      >
        {url.trim() &&
          (detected && detectedBrand ? (
            <Text
              className={cn(
                "animate-rise-in inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                detectedBrand.chip
              )}
            >
              <ServiceLogo service={detected.service} className="h-3.5 w-3.5" />
              {detectedBrand.name} {detected.type}
              <IconArrowRight size={12} className="opacity-60" />
              {detected.type === "playlist" ? "48-hour share link" : "links for every service"}
            </Text>
          ) : isSearchMode ? (
            <Text className="animate-rise-in inline-flex items-center gap-1.5 rounded-full bg-accent-muted px-3 py-1 text-xs font-medium text-accent">
              <IconSearch size={12} />
              Song search. Press Enter to find &ldquo;{url.trim().slice(0, 40)}&rdquo;
            </Text>
          ) : isDeezerShort ? (
            <Text
              className={cn(
                "animate-rise-in inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                BRAND.deezer.chip
              )}
            >
              <DeezerLogo className="h-3.5 w-3.5" />
              Deezer link
            </Text>
          ) : isAmazon ? (
            <Text className="animate-rise-in text-xs text-secondary/80">
              Amazon Music has no public API. Paste from Spotify, Apple Music, Deezer, or
              YouTube Music instead.
            </Text>
          ) : (
            <Text className="text-xs text-secondary/70">
              Works with Spotify, Apple Music, Deezer, TIDAL, and YouTube Music links
            </Text>
          ))}
      </Stack>

      {error && (
        <Banner
          className={cn("mt-4", !compact && "mx-auto w-full max-w-4xl")}
          status="error"
          title="Could not convert that"
          description={error}
        />
      )}

      {candidates && (
          <List
            className={cn("mt-4", !compact && "mx-auto w-full max-w-4xl")}
            header="Pick the right song"
            density="compact"
            hasDividers
          >
            {candidates.map((candidate) => (
              <Item
                  key={candidate.url}
                  as="li"
                  label={candidate.title}
                  description={`${candidate.artist}${candidate.album ? ` · ${candidate.album}` : ""}`}
                  onClick={() => convertUrl(candidate.url)}
                  startContent={candidate.artworkUrl ? (
                    <Image
                      src={candidate.artworkUrl}
                      alt=""
                      width={40}
                      height={40}
                      className="h-10 w-10 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <Stack className="h-10 w-10 shrink-0 rounded-md bg-muted" />
                  )}
                  endContent={<IconArrowRight size={15} />}
                />
            ))}
          </List>
      )}

      {isConverting && (
        <Text as="p" className="animate-rise-in mt-4 flex items-center justify-center gap-2 text-sm text-secondary">
          <IconLoader2 size={15} className="animate-spin" />
          Searching five catalogs…
        </Text>
      )}

      {result?.kind === "conversion" && (
        <Stack className={cn(!compact && "mx-auto w-full max-w-4xl")}>
          <ConversionResult result={result} />
        </Stack>
      )}
      {result?.kind === "playlist" && (
        <Stack className={cn(!compact && "mx-auto w-full max-w-4xl")}>
          <PlaylistResult result={result} />
        </Stack>
      )}

      {showHistory && history.length > 0 && (
        <Stack as="section" className="mt-12">
          <Stack direction="horizontal" align="center" justify="between" className="px-1">
            <Heading level={2} className="text-xs font-semibold uppercase tracking-wide text-secondary">
              Recent conversions
            </Heading>
            <Button
              label="Clear"
              icon={<IconTrash size={13} />}
              onClick={clearHistory}
              variant="ghost"
              size="sm"
              tooltip="Stored only in this browser"
            />
          </Stack>
          <Stack as="ul" className="mt-4 grid gap-3 sm:grid-cols-2">
            {history.map((item) => (
              <HistoryRow key={item.timestamp} item={item} />
            ))}
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}
