"use client";

import { useEffect, useRef } from "react";

const HERO_VIDEO_SRC = "/gotrefs-hero-video.mp4";

type HeroVideoShowcaseProps = {
  showCaption?: boolean;
  caption?: string;
  /** Constrain video to parent height — full frame, no crop */
  fitContainer?: boolean;
  className?: string;
};

/** GoTRefs hero video — entire frame visible (object-contain). */
export function HeroVideoShowcase({
  showCaption = false,
  caption = "THE REFEREE MARKETPLACE FOR EVERY SPORT",
  fitContainer = false,
  className = "",
}: HeroVideoShowcaseProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    void video.play().catch(() => {});
  }, []);

  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-[var(--blue-hero)] shadow-xl ring-1 ring-white/10 ${
        fitContainer ? "flex h-full min-h-0 w-full items-center justify-center" : "w-full"
      } ${className}`}
    >
      <video
        ref={videoRef}
        src={HERO_VIDEO_SRC}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className={
          fitContainer
            ? "max-h-full max-w-full object-contain"
            : "block h-auto w-full object-contain"
        }
      />
      {showCaption && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-black/75 px-4 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-white sm:text-xs">{caption}</p>
          <span className="shrink-0 text-xs font-bold text-[var(--red)]">GoTRefs</span>
        </div>
      )}
    </div>
  );
}
