"use client";

import { useState, useEffect, useCallback } from "react";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Button } from "@astryxdesign/core/Button";
import { Stack } from "@astryxdesign/core/Stack";
import { StatusDot as AstryxStatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import {
  SpotifyLogo,
  AppleLogo,
  YouTubeMusicLogo,
  TidalLogo,
  DeezerLogo,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import { DeezerConnectDialog } from "@/components/deezer-connect-dialog";
import { toast } from "@/lib/toast";

interface SpotifySession {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface MusicKitInstance {
  authorize: () => Promise<string>;
  unauthorize: () => Promise<void>;
  isAuthorized: boolean;
}

declare global {
  interface Window {
    MusicKit: {
      configure: (config: { developerToken: string; app: { name: string; build: string } }) => Promise<MusicKitInstance>;
      getInstance: () => MusicKitInstance;
    };
  }
}

interface ServiceConnectProps {
  onConnectionChange?: (
    service: "spotify" | "apple" | "youtube" | "tidal" | "deezer",
    connected: boolean,
    token?: string
  ) => void;
}

export function ServiceConnect({ onConnectionChange }: ServiceConnectProps) {
  const [spotifySession, setSpotifySession] = useState<SpotifySession | null>(null);
  const [spotifyLoading, setSpotifyLoading] = useState(true);
  const [appleConnected, setAppleConnected] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleUserToken, setAppleUserToken] = useState<string | null>(null);
  const [musicKit, setMusicKit] = useState<MusicKitInstance | null>(null);
  const [youtube, setYoutube] = useState<{ configured: boolean; connected: boolean }>({
    configured: false,
    connected: false,
  });
  const [tidal, setTidal] = useState<{ configured: boolean; connected: boolean }>({
    configured: false,
    connected: false,
  });
  const [deezer, setDeezer] = useState<{
    configured: boolean;
    connected: boolean;
    userName?: string;
  }>({ configured: true, connected: false });
  const [deezerDialogOpen, setDeezerDialogOpen] = useState(false);

  const spotifyConnected = !!spotifySession;

  // YouTube status (row only appears once OAuth env vars are configured)
  useEffect(() => {
    fetch("/api/youtube/status")
      .then((r) => r.json())
      .then((d) => setYoutube({ configured: !!d.configured, connected: !!d.connected }))
      .catch(() => {});
  }, []);

  // TIDAL and advanced Deezer destination status.
  useEffect(() => {
    fetch("/api/tidal/status")
      .then((r) => r.json())
      .then((d) => setTidal({ configured: !!d.configured, connected: !!d.connected }))
      .catch(() => {});
    fetch("/api/deezer/status")
      .then((r) => r.json())
      .then((d) =>
        setDeezer({
          configured: !!d.configured,
          connected: !!d.connected,
          userName: d.userName,
        })
      )
      .catch(() => {});
  }, []);

  const disconnectYouTube = async () => {
    await fetch("/api/youtube/status", { method: "DELETE" });
    setYoutube((y) => ({ ...y, connected: false }));
    onConnectionChange?.("youtube", false);
  };

  const disconnectTidal = async () => {
    await fetch("/api/tidal/status", { method: "DELETE" });
    setTidal((current) => ({ ...current, connected: false }));
    onConnectionChange?.("tidal", false);
  };

  const disconnectDeezer = async () => {
    await fetch("/api/deezer/status", { method: "DELETE" });
    setDeezer((current) => ({ ...current, connected: false, userName: undefined }));
    onConnectionChange?.("deezer", false);
  };

  // Fetch Spotify session on mount
  useEffect(() => {
    const fetchSpotifySession = async () => {
      try {
        const response = await fetch("/api/spotify/session");
        const data = await response.json();
        if (data.session) {
          setSpotifySession(data.session);
        }
      } catch (error) {
        console.error("Failed to fetch Spotify session:", error);
      } finally {
        setSpotifyLoading(false);
      }
    };
    fetchSpotifySession();
  }, []);

  // Initialize MusicKit and validate stored token
  useEffect(() => {
    const initMusicKit = async () => {
      if (typeof window === "undefined" || !window.MusicKit) return;

      try {
        const response = await fetch("/api/apple/token");
        const data = await response.json();
        
        if (!data.success) {
          console.log("Apple Music not configured");
          return;
        }

        const mk = await window.MusicKit.configure({
          developerToken: data.data.token,
          app: {
            name: "Lab86 Convert",
            build: "1.0.0",
          },
        });
        
        setMusicKit(mk);
        
        // Check if we have a stored token and validate it
        // Using sessionStorage for security (clears when browser closes)
        const storedToken = sessionStorage.getItem("appleUserToken");
        if (storedToken) {
          // Validate the token by making a lightweight API call
          try {
            const validateResponse = await fetch("/api/apple/playlists?limit=1", {
              headers: { "Music-User-Token": storedToken },
            });
            if (validateResponse.ok) {
              setAppleConnected(true);
              setAppleUserToken(storedToken);
              onConnectionChange?.("apple", true, storedToken);
            } else {
              // Token is stale or invalid, clear it
              console.log("Apple Music token is stale, clearing...");
              sessionStorage.removeItem("appleUserToken");
              if (mk.isAuthorized) {
                await mk.unauthorize();
              }
            }
          } catch {
            // Token validation failed, clear it
            sessionStorage.removeItem("appleUserToken");
            if (mk.isAuthorized) {
              await mk.unauthorize();
            }
          }
        } else if (mk.isAuthorized) {
          // MusicKit thinks we're authorized but we have no token - clear state
          await mk.unauthorize();
        }
      } catch (error) {
        console.error("Failed to initialize MusicKit:", error);
      }
    };

    // Wait for MusicKit script to load
    const checkMusicKit = () => {
      if (window.MusicKit) {
        initMusicKit();
      } else {
        document.addEventListener("musickitloaded", initMusicKit);
      }
    };

    checkMusicKit();

    return () => {
      document.removeEventListener("musickitloaded", initMusicKit);
    };
  }, [onConnectionChange]);

  const connectSpotify = () => {
    // Use custom OAuth flow that bypasses Auth.js signin issues
    window.location.href = "/api/spotify/auth";
  };

  const disconnectSpotify = async () => {
    try {
      await fetch("/api/spotify/session", { method: "DELETE" });
      setSpotifySession(null);
      window.location.href = "/";
    } catch (error) {
      console.error("Failed to disconnect Spotify:", error);
    }
  };

  const connectApple = useCallback(async () => {
    if (!musicKit) {
      console.error("MusicKit not initialized");
      return;
    }

    setAppleLoading(true);
    try {
      const userToken = await musicKit.authorize();
      setAppleUserToken(userToken);
      setAppleConnected(true);
      onConnectionChange?.("apple", true, userToken);
    } catch (error) {
      console.error("Apple Music authorization failed:", error);
    } finally {
      setAppleLoading(false);
    }
  }, [musicKit, onConnectionChange]);

  const disconnectApple = useCallback(async () => {
    if (!musicKit) return;

    try {
      await musicKit.unauthorize();
      setAppleConnected(false);
      setAppleUserToken(null);
      onConnectionChange?.("apple", false);
    } catch (error) {
      console.error("Failed to disconnect Apple Music:", error);
    }
  }, [musicKit, onConnectionChange]);

  // Notify parent of Spotify connection changes
  useEffect(() => {
    if (spotifyConnected && spotifySession?.accessToken) {
      onConnectionChange?.("spotify", true, spotifySession.accessToken);
    }
  }, [spotifyConnected, spotifySession?.accessToken, onConnectionChange]);

  // Store Apple user token in sessionStorage for security
  // (clears when browser closes - this is intentional for security)
  // MusicKit tokens must be client-side accessible, unlike Spotify which uses HTTP-only cookies
  useEffect(() => {
    if (appleUserToken) {
      sessionStorage.setItem("appleUserToken", appleUserToken);
    } else {
      sessionStorage.removeItem("appleUserToken");
    }
  }, [appleUserToken]);

  const userInitials = spotifySession?.user?.name
    ? spotifySession.user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : spotifySession?.user?.email?.[0]?.toUpperCase() || "U";

  return (
    <>
      <ConnectionPanel
        spotify={{
        connected: spotifyConnected,
        loading: spotifyLoading,
        userName: spotifySession?.user?.name,
        userImage: spotifySession?.user?.image,
        userInitials,
        onConnect: connectSpotify,
        onDisconnect: disconnectSpotify,
        }}
        apple={{
        connected: appleConnected,
        loading: appleLoading,
        ready: !!musicKit,
        onConnect: connectApple,
        onDisconnect: disconnectApple,
        }}
        youtube={{
        configured: youtube.configured,
        connected: youtube.connected,
        onConnect: () => {
          window.location.href = "/api/youtube/auth";
        },
        onDisconnect: disconnectYouTube,
        }}
        tidal={{
        configured: tidal.configured,
        connected: tidal.connected,
        onConnect: () => {
          window.location.href = "/api/tidal/auth";
        },
        onDisconnect: disconnectTidal,
        }}
        deezer={{
        configured: deezer.configured,
        connected: deezer.connected,
        userName: deezer.userName,
        onConnect: () => setDeezerDialogOpen(true),
        onDisconnect: disconnectDeezer,
        }}
      />
      <DeezerConnectDialog
        open={deezerDialogOpen}
        onOpenChange={setDeezerDialogOpen}
        onConnected={(userName) => {
          setDeezer((current) => ({ ...current, connected: true, userName }));
          onConnectionChange?.("deezer", true);
          toast.success(userName ? `Connected to Deezer as ${userName}` : "Connected to Deezer");
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <AstryxStatusDot
      variant={connected ? "success" : "neutral"}
      label={connected ? "Connected" : "Not connected"}
      isPulsing={connected}
    />
  );
}

interface RowProps {
  logo: React.ReactNode;
  tileClass: string;
  name: string;
  status: React.ReactNode;
  action: React.ReactNode;
}

function ConnectionRow({ logo, tileClass, name, status, action }: RowProps) {
  return (
    <Stack className="flex flex-col rounded-lg border border-border/70 bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <Stack direction="horizontal" align="center" className="gap-3">
        <Stack
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-dark shadow-sm",
            tileClass
          )}
        >
          {logo}
        </Stack>
        <Text as="p" className="min-w-0 flex-1 text-sm font-semibold leading-tight">{name}</Text>
      </Stack>
      <Stack
        direction="horizontal"
        align="center"
        className="mt-2.5 min-h-6 flex-1 gap-1.5 text-xs leading-relaxed text-secondary"
      >
        {status}
      </Stack>
      <Stack direction="horizontal" align="center" className="mt-auto pt-2.5">
        {action}
      </Stack>
    </Stack>
  );
}

interface ConnectionPanelProps {
  spotify: {
    connected: boolean;
    loading: boolean;
    userName?: string | null;
    userImage?: string | null;
    userInitials: string;
    onConnect: () => void;
    onDisconnect: () => void;
  };
  apple: {
    connected: boolean;
    loading: boolean;
    ready: boolean;
    onConnect: () => void;
    onDisconnect: () => void;
  };
  youtube?: {
    configured: boolean;
    connected: boolean;
    onConnect: () => void;
    onDisconnect: () => void;
  };
  tidal?: {
    configured: boolean;
    connected: boolean;
    onConnect: () => void;
    onDisconnect: () => void;
  };
  deezer?: {
    configured: boolean;
    connected: boolean;
    userName?: string;
    onConnect: () => void;
    onDisconnect: () => void;
  };
}

function ConnectionPanel({ spotify, apple, youtube, tidal, deezer }: ConnectionPanelProps) {
  return (
    <Stack className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ConnectionRow
        logo={<SpotifyLogo className="h-4.5 w-4.5" />}
        tileClass="bg-green-ring"
        name="Spotify"
        status={
          <>
            <StatusDot connected={spotify.connected} />
            {spotify.connected ? (
              <Text className="truncate">
                Connected{spotify.userName ? ` as ${spotify.userName}` : ""}
              </Text>
            ) : (
              <Text>Browse your library and convert playlists</Text>
            )}
          </>
        }
        action={
          spotify.connected ? (
            <Stack direction="horizontal" align="center" className="gap-2.5">
              <Avatar
                size="sm"
                src={spotify.userImage || undefined}
                name={spotify.userName || spotify.userInitials || "User"}
              />
              <Button
                label="Disconnect Spotify"
                onClick={spotify.onDisconnect}
                variant="ghost"
                size="sm"
              />
            </Stack>
          ) : (
            <Button
              label="Connect"
              icon={<SpotifyLogo className="h-4 w-4" />}
              onClick={spotify.onConnect}
              isDisabled={spotify.loading}
              isLoading={spotify.loading}
              variant="primary"
              size="sm"
              tooltip="Connect Spotify"
            />
          )
        }
      />
      <ConnectionRow
        logo={<AppleLogo className="h-4.5 w-4.5" />}
        tileClass="bg-red-ring"
        name="Apple Music"
        status={
          <>
            <StatusDot connected={apple.connected} />
            {apple.connected ? (
              <Text>Connected</Text>
            ) : (
              <Text>Import shared playlists into your library</Text>
            )}
          </>
        }
        action={
          apple.connected ? (
            <Button
              label="Disconnect Apple Music"
              onClick={apple.onDisconnect}
              variant="ghost"
              size="sm"
            />
          ) : (
            <Button
              label={!apple.ready ? "Loading…" : "Connect"}
              icon={<AppleLogo className="h-4 w-4" />}
              onClick={apple.onConnect}
              isDisabled={apple.loading || !apple.ready}
              isLoading={apple.loading}
              variant="primary"
              size="sm"
              tooltip={!apple.ready ? "Loading Apple Music" : "Connect Apple Music"}
            />
          )
        }
      />
      {tidal?.configured && (
        <ConnectionRow
          logo={<TidalLogo className="h-4.5 w-4.5" />}
          tileClass="bg-gray-ring ring-1 ring-border"
          name="TIDAL"
          status={
            <>
              <StatusDot connected={tidal.connected} />
              {tidal.connected ? (
                <Text>Connected, ISRC-exact playlist import</Text>
              ) : (
                <Text>Official sign-in for private playlist imports</Text>
              )}
            </>
          }
          action={
            tidal.connected ? (
              <Button
                label="Disconnect TIDAL"
                onClick={tidal.onDisconnect}
                variant="ghost"
                size="sm"
              />
            ) : (
              <Button
                label="Connect"
                icon={<TidalLogo className="h-4 w-4" />}
                onClick={tidal.onConnect}
                variant="primary"
                size="sm"
                tooltip="Connect TIDAL"
              />
            )
          }
        />
      )}
      {youtube?.configured && (
        <ConnectionRow
          logo={<YouTubeMusicLogo className="h-4.5 w-4.5" />}
          tileClass="bg-red-ring"
          name="YouTube Music"
          status={
            <>
              <StatusDot connected={youtube.connected} />
              {youtube.connected ? (
                <Text>Connected</Text>
              ) : (
                <Text>Import shared playlists into YouTube</Text>
              )}
            </>
          }
          action={
            youtube.connected ? (
              <Button
                label="Disconnect YouTube Music"
                onClick={youtube.onDisconnect}
                variant="ghost"
                size="sm"
              />
            ) : (
              <Button
                label="Connect"
                icon={<YouTubeMusicLogo className="h-4 w-4" />}
                onClick={youtube.onConnect}
                variant="primary"
                size="sm"
                tooltip="Connect YouTube Music"
              />
            )
          }
        />
      )}
      {deezer?.configured && (
        <ConnectionRow
          logo={<DeezerLogo className="h-4.5 w-4.5" />}
          tileClass="bg-purple-ring"
          name="Deezer"
          status={
            <>
              <StatusDot connected={deezer.connected} />
              {deezer.connected ? (
                <Text className="truncate">
                  Connected{deezer.userName ? ` as ${deezer.userName}` : ""}, unofficial
                </Text>
              ) : (
                <Text>Opt-in import using your browser session</Text>
              )}
            </>
          }
          action={
            deezer.connected ? (
              <Button
                label="Disconnect Deezer"
                onClick={deezer.onDisconnect}
                variant="ghost"
                size="sm"
              />
            ) : (
              <Button
                label="Connect"
                icon={<DeezerLogo className="h-4 w-4" />}
                onClick={deezer.onConnect}
                variant="primary"
                size="sm"
                tooltip="Connect Deezer"
              />
            )
          }
        />
      )}
    </Stack>
  );
}
