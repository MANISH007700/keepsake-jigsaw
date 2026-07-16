"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

const VIDEO_ID = "cKgnDmpb4BU";
const VIDEO_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
const API_URL = "https://www.youtube.com/iframe_api";

type YouTubePlayer = {
  destroy: () => void;
  pauseVideo: () => void;
  playVideo: () => void;
  setVolume: (volume: number) => void;
  unMute: () => void;
};

type YouTubePlayerEvent = { target: YouTubePlayer };

type YouTubeApi = {
  Player: new (element: HTMLElement, options: {
    width: string;
    height: string;
    videoId: string;
    host: string;
    playerVars: Record<string, string | number>;
    events: {
      onReady: (event: YouTubePlayerEvent) => void;
      onStateChange: (event: { data: number }) => void;
      onError: () => void;
      onAutoplayBlocked: () => void;
    };
  }) => YouTubePlayer;
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube player API did not initialize"));
    };
    if (document.querySelector(`script[src="${API_URL}"]`)) return;
    const script = document.createElement("script");
    script.src = API_URL;
    script.async = true;
    script.addEventListener("error", () => reject(new Error("YouTube player API could not load")), { once: true });
    document.head.appendChild(script);
  });
  return youtubeApiPromise;
}

export type YouTubeMusicHandle = {
  play: () => void;
  pause: () => void;
};

const YouTubeMusic = forwardRef<YouTubeMusicHandle, { active: boolean }>(function YouTubeMusic({ active }, ref) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const activeRef = useRef(active);
  const pendingPlayRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const playAtFullVolume = () => {
    pendingPlayRef.current = true;
    const player = playerRef.current;
    if (!player) return;
    player.setVolume(100);
    player.unMute();
    player.playVideo();
  };

  useImperativeHandle(ref, () => ({
    play: playAtFullVolume,
    pause: () => {
      pendingPlayRef.current = false;
      playerRef.current?.pauseVideo();
    },
  }));

  useEffect(() => {
    activeRef.current = active;
    if (active) playAtFullVolume();
    else {
      pendingPlayRef.current = false;
      playerRef.current?.pauseVideo();
    }
  }, [active]);

  useEffect(() => {
    let disposed = false;
    loadYouTubeApi()
      .then((api) => {
        if (disposed || !mountRef.current) return;
        playerRef.current = new api.Player(mountRef.current, {
          width: "100%",
          height: "200",
          videoId: VIDEO_ID,
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            autoplay: 0,
            controls: 1,
            loop: 1,
            playlist: VIDEO_ID,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (disposed) return;
              playerRef.current = event.target;
              event.target.setVolume(100);
              event.target.unMute();
              setReady(true);
              if (activeRef.current || pendingPlayRef.current) event.target.playVideo();
            },
            onAutoplayBlocked: () => {
              if (!disposed) setBlocked(true);
            },
            onStateChange: (event) => {
              if (!disposed && event.data === 1) setBlocked(false);
            },
            onError: () => {
              if (!disposed) setUnavailable(true);
            },
          },
        });
      })
      .catch(() => { if (!disposed) setUnavailable(true); });
    return () => {
      disposed = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  return (
    <section className="youtube-music-dock" aria-label="Featured music">
      <div className="youtube-music-copy">
        <span className="eyebrow eyebrow-accent">Default soundtrack</span>
        <h2>Sparkle</h2>
        <p>Your Name OST, performed on piano by Animenz Piano Sheets. It loops at 100% player volume while you play.</p>
        <small>
          {unavailable
            ? "The player is unavailable. Choose Homecoming or Memory Lane instead."
            : blocked
              ? "Your browser blocked automatic sound—tap Play in the player once."
              : ready
                ? active ? "Playing · control loudness with your phone or laptop." : "Ready · starts with your puzzle."
                : "Preparing the YouTube player…"}
        </small>
        <a href={VIDEO_URL} target="_blank" rel="noreferrer">Open the original on YouTube ↗</a>
      </div>
      <div className="youtube-player-frame"><div ref={mountRef} /></div>
    </section>
  );
});

export default YouTubeMusic;
