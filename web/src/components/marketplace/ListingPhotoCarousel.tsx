"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

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
  // One photo per listing — ignore extras if callers still pass arrays.
  const photo = images.find((url) => Boolean(url?.trim()))?.trim() || null;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [photo]);

  const showPhoto = Boolean(photo) && !failed;

  return (
    <div className={`relative ${aspectClass} overflow-hidden bg-gradient-to-br ${gradientClass}`}>
      {showPhoto ? (
        <Image
          src={photo!}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-6xl drop-shadow-md" aria-hidden>
          {emoji}
        </div>
      )}

      <span className="sr-only">{alt}</span>
      <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10" />

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
    </div>
  );
}
