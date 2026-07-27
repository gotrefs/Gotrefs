"use client";

import { useMemo } from "react";
import { RefereeIdCard } from "@/components/RefereeIdCard";
import type { PublicRefIdCard } from "@/lib/public-ref-id-card";
import { refVerificationApproved } from "@/lib/ref-eligibility";
import { BRAND_NAME } from "@/lib/brand";

function splitList(value?: string | null): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/[\n,;|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function VerifyOfficialClient({ card }: { card: PublicRefIdCard }) {
  const sports = useMemo(() => {
    const list = [card.primarySport, ...(card.additionalSports ?? [])]
      .map((s) => s?.trim())
      .filter((s): s is string => Boolean(s));
    return list.length ? list : ["Not listed"];
  }, [card.primarySport, card.additionalSports]);

  const accepted = useMemo(() => {
    const list = splitList(card.certifiedBy);
    if (list.length) return list;
    const levels = [card.certificationLevel, ...(card.additionalCertificationLevels ?? [])]
      .map((s) => s?.trim())
      .filter((s): s is string => Boolean(s));
    if (levels.length) return levels;
    return ["Not listed"];
  }, [card.certifiedBy, card.certificationLevel, card.additionalCertificationLevels]);

  const city =
    card.baseCity?.trim() ||
    (card.workRegions ?? []).filter(Boolean).slice(0, 2).join(", ") ||
    "Not listed";

  const isVerified = refVerificationApproved(card.verificationStatus) || card.profileComplete;

  return (
    <main
      className="min-h-dvh px-4 py-6 sm:px-6 sm:py-10"
      style={{ background: "linear-gradient(165deg, #0f0e1a 0%, #1a1730 45%, #2a2448 100%)" }}
    >
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-5">
        <div className="w-full text-center text-white">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/70">
            {BRAND_NAME} verification
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2 ring-1 ring-emerald-400/40">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-sm font-black text-white"
              aria-hidden
            >
              ✓
            </span>
            <span className="text-sm font-black tracking-[0.08em] text-emerald-200">
              {isVerified ? "Verified Official" : `${BRAND_NAME} Official ID`}
            </span>
          </div>
          <p className="mt-2 text-sm text-white/65">
            Referee ID <span className="font-semibold text-white">{card.gotrefsId}</span>
          </p>
        </div>

        <div className="w-full">
          <div id="id-card" className="mx-auto w-full max-w-[400px]">
            <RefereeIdCard
              gotrefsId={card.gotrefsId}
              primarySport={card.primarySport ?? undefined}
              additionalSports={card.additionalSports}
              certificationLevel={card.certificationLevel ?? undefined}
              additionalCertificationLevels={card.additionalCertificationLevels}
              certifiedBy={card.certifiedBy ?? undefined}
              avatarUrl={card.avatarUrl ?? undefined}
              avatarLabel="ID"
              baseCity={card.baseCity ?? undefined}
              workRegions={card.workRegions}
              verificationStatus={card.verificationStatus}
              validThrough={card.validThrough}
              profileComplete={card.profileComplete}
              hideQr
              className="w-full shadow-2xl"
            />
          </div>
        </div>

        <section className="w-full rounded-2xl bg-white/95 p-4 text-left shadow-lg ring-1 ring-white/20">
          <h2 className="text-xs font-black uppercase tracking-[0.16em] text-neutral-500">
            Official details
          </h2>
          <dl className="mt-3 space-y-3 text-sm text-neutral-800">
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                Certified sports
              </dt>
              <dd className="mt-1 font-semibold">{sports.join(" · ")}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">City</dt>
              <dd className="mt-1 font-semibold">{city}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                Accepted by
              </dt>
              <dd className="mt-1 font-semibold">{accepted.join(" · ")}</dd>
            </div>
          </dl>
        </section>

        <p className="text-center text-xs text-white/50">
          No GotRefs login required — this page is for organizers scanning a referee QR.
        </p>
      </div>
    </main>
  );
}

export function VerifyOfficialNotFound({ id }: { id: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-950 px-6 text-center text-white">
      <div>
        <p className="text-sm font-bold tracking-[0.12em] text-amber-300">{BRAND_NAME}</p>
        <h1 className="mt-3 text-2xl font-black">Official ID not found</h1>
        <p className="mt-2 text-sm text-white/70">
          No public ID card matches <span className="font-semibold text-white">{id}</span>.
        </p>
      </div>
    </main>
  );
}
