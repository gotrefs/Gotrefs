"use client";

import { useEffect, useRef } from "react";

const HERO_VIDEO_SRC = "/gotrefs-hero-video.mp4";

/** Full-bleed hero background video (GotREFS Hero Video Final). */
export function HeroVideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    void video.play().catch(() => {
      /* Autoplay may be blocked until user interaction — muted usually works. */
    });
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <video
        ref={videoRef}
        src={HERO_VIDEO_SRC}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        tabIndex={-1}
        className="pointer-events-none absolute left-1/2 top-1/2 h-full w-full min-h-full min-w-full -translate-x-1/2 -translate-y-1/2 object-cover"
      />
    </div>
  );
}
