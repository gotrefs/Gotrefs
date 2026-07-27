"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { RefereeIdCard } from "@/components/RefereeIdCard";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND_NAME } from "@/lib/brand";

type PublicCard = {
  gotrefsId: string;
  primarySport: string | null;
  additionalSports: string[];
  certificationLevel: string | null;
  certifiedBy: string | null;
  baseCity: string | null;
  workRegions: string[];
  avatarUrl: string | null;
  verificationStatus: string | null;
  validThrough: string | null;
  profileComplete?: boolean;
};

export default function PublicRefIdPage() {
  const params = useParams<{ gotrefsId: string }>();
  const rawId = typeof params?.gotrefsId === "string" ? params.gotrefsId : "";
  const [card, setCard] = useState<PublicCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rawId) {
      setError("Missing GotREFS ID.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await fetch(`/api/id/${encodeURIComponent(rawId)}`);
        const json = (await res.json()) as { card?: PublicCard; error?: string };
        if (cancelled) return;
        if (!res.ok || !json.card) {
          setError(json.error || "Official ID not found.");
          setCard(null);
          return;
        }
        setCard(json.card);
      } catch {
        if (!cancelled) setError("Could not load this official ID.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rawId]);

  return (
    <div className="min-h-dvh bg-[var(--blue-hero)] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex max-w-lg flex-col items-center">
        <BrandLogo href="/" src="/gotrefs-logo-blue-background.png" imageClassName="h-12 w-auto sm:h-14" />
        <p className="mt-4 text-center text-xs font-bold uppercase tracking-[0.2em] text-white/70">
          {BRAND_NAME} Official ID
        </p>

        <div className="mt-6 w-full">
          {loading ? (
            <div className="mx-auto h-[34rem] max-w-[400px] animate-pulse rounded-[18px] bg-white/10" />
          ) : error ? (
            <div className="rounded-2xl border border-white/15 bg-white px-5 py-8 text-center shadow-xl">
              <p className="text-sm font-bold uppercase tracking-wide text-[var(--red)]">ID not found</p>
              <p className="mt-2 text-sm text-[var(--slate)]">{error}</p>
            </div>
          ) : card ? (
            <div className="w-full">
              <RefereeIdCard
                gotrefsId={card.gotrefsId}
                primarySport={card.primarySport ?? undefined}
                additionalSports={card.additionalSports}
                certificationLevel={card.certificationLevel ?? undefined}
                certifiedBy={card.certifiedBy ?? undefined}
                baseCity={card.baseCity ?? undefined}
                workRegions={card.workRegions}
                avatarUrl={card.avatarUrl ?? undefined}
                verificationStatus={card.verificationStatus}
                validThrough={card.validThrough}
                profileComplete={card.profileComplete}
              />
              <p className="mt-4 text-center text-xs text-white/60">
                Scan-verified GotREFS ID · Photo matches the official on file
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
