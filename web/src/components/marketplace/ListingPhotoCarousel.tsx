"use client";

import Image from "next/image";
import { useState } from "react";

export function ListingPhotoCarousel({
  images,
  alt,
  gradientClass,
  emoji,
  badge,
  secondaryBadge,
  aspectClass = "aspect-[4/3]",
}: {
  images: string[];
  alt: string;
  gradientClass: string;
  emoji: string;
  badge?: string;
  secondaryBadge?: string | null;
  aspectClass?: string;
}) {
  const slides = images.length > 0 ? images : [];
  const [index, setIndex] = useState(0);
  const hasMultiple = slides.length > 1;

  function show(next: number) {
    if (!slides.length) return;
    setIndex((next + slides.length) % slides.length);
  }

  return (
    <div
      className={`group/photos relative ${aspectClass} overflow-hidden bg-gradient-to-br ${gradientClass}`}
      onMouseLeave={() => setIndex(0)}
    >
      {slides.length > 0 ? (
        <Image
          src={slides[index]}
          alt={alt}
          fill
          className="object-cover transition duration-500 group-hover/photos:scale-[1.02]"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-6xl drop-shadow-md">{emoji}</div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-black/10" />

      {badge && (
        <div className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-neutral-800 shadow-sm">
          {badge}
        </div>
      )}
      {secondaryBadge && (
        <div
          className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ${
            secondaryBadge.includes("mismatch") || secondaryBadge.includes("outside")
              ? "bg-amber-100 text-amber-900"
              : "bg-white/95 text-emerald-800"
          }`}
        >
          {secondaryBadge}
        </div>
      )}

      {hasMultiple && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={(e) => {
              e.stopPropagation();
              show(index - 1);
            }}
            className="absolute left-2 top-1/2 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-sm font-bold text-neutral-800 shadow group-hover/photos:flex"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={(e) => {
              e.stopPropagation();
              show(index + 1);
            }}
            className="absolute right-2 top-1/2 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-sm font-bold text-neutral-800 shadow group-hover/photos:flex"
          >
            ›
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
            {slides.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-white" : "w-1.5 bg-white/60"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
