"use client";

import { RefereeIdCard } from "@/components/RefereeIdCard";
import type { PublicRefIdCard } from "@/lib/public-ref-id-card";

/**
 * What organizers see after scanning the QR: the official ID card only.
 * No login, no dashboard chrome — just the card with photo + details.
 */
export function PublicOfficialIdCardClient({
  initialCard,
}: {
  initialCard: PublicRefIdCard;
  gotrefsId: string;
}) {
  const card = initialCard;

  return (
    <main
      className="flex min-h-dvh items-center justify-center p-3 sm:p-6"
      style={{ background: "linear-gradient(165deg, #0f0e1a 0%, #1a1730 45%, #2a2448 100%)" }}
    >
      <RefereeIdCard
        gotrefsId={card.gotrefsId}
        primarySport={card.primarySport ?? undefined}
        additionalSports={card.additionalSports}
        certificationLevel={card.certificationLevel ?? undefined}
        certifiedBy={card.certifiedBy ?? undefined}
        avatarUrl={card.avatarUrl ?? undefined}
        avatarLabel="ID"
        baseCity={card.baseCity ?? undefined}
        workRegions={card.workRegions}
        verificationStatus={card.verificationStatus}
        validThrough={card.validThrough}
        profileComplete={card.profileComplete}
        hideQr
        className="w-full max-w-[400px] shadow-2xl"
      />
    </main>
  );
}

export function PublicOfficialIdNotFound({ id }: { id: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-950 px-6 text-center text-white">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-300">GotREFS</p>
        <h1 className="mt-3 text-2xl font-black">Official ID not found</h1>
        <p className="mt-2 text-sm text-white/70">
          No public ID card matches <span className="font-semibold text-white">{id}</span>.
        </p>
      </div>
    </main>
  );
}
