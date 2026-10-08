"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { PlacesWhereInput, type PlaceSelection } from "@/components/marketplace/PlacesWhereInput";
import { RefFinderMap, type RefMapPin } from "@/components/find-refs/RefFinderMap";
import { distanceMiles } from "@/lib/maps/geo";
import type { PublicRefListing } from "@/lib/marketplace/public-refs";
import { sportEmoji } from "@/lib/sport-emoji";

type SortKey = "best" | "price-asc" | "price-desc" | "nearest";
type RateUnitFilter = "any" | "hour" | "game";

const PAGE_SIZE = 20;
const RADIUS_OPTIONS = [10, 25, 40, 60];

function rateText(ref: PublicRefListing): string {
  if (ref.rateMin == null) return "Rate on request";
  const unit = ref.rateUnit === "game" ? "/game" : "/hr";
  if (ref.rateMax != null && ref.rateMax !== ref.rateMin) return `$${ref.rateMin}–${ref.rateMax}${unit}`;
  return `$${ref.rateMin}${unit}`;
}

function pinLabel(ref: PublicRefListing): string {
  return ref.rateMin == null ? "—" : `$${ref.rateMin}`;
}

function Checkbox({
  checked,
  onChange,
  label,
  count,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  count?: number;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1.5 text-sm text-neutral-800">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-neutral-400 accent-[var(--navy)]"
      />
      <span className="flex-1">{label}</span>
      {count != null && <span className="text-xs text-neutral-400">{count}</span>}
    </label>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="border-b border-neutral-200 py-4 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-sm font-semibold text-neutral-900"
        aria-expanded={open}
      >
        {title}
        <span className={`text-neutral-500 transition ${open ? "rotate-180" : ""}`} aria-hidden>
          ⌃
        </span>
      </button>
      {open && <div className="mt-2">{children}</div>}
    </section>
  );
}

function Avatar({ r }: { r: PublicRefListing }) {
  if (r.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={r.photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />;
  }
  return (
    <div
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--navy)] text-lg font-bold text-white"
      aria-hidden
    >
      {r.initials}
    </div>
  );
}

function RefResultCard({
  r,
  distance,
  selected,
  onHover,
}: {
  r: PublicRefListing;
  distance: number | null;
  selected: boolean;
  onHover: (id: string | null) => void;
}) {
  return (
    <article
      id={`ref-${r.id}`}
      onMouseEnter={() => onHover(r.id)}
      onMouseLeave={() => onHover(null)}
      className={`border-b border-neutral-200 px-4 py-6 transition sm:px-6 ${selected ? "bg-neutral-50" : "bg-white"}`}
    >
      <div className="flex gap-4">
        <Avatar r={r} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm text-neutral-600">
                <span className="font-semibold text-neutral-900">{r.name}</span>
                {r.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    ✓ Verified
                  </span>
                )}
              </p>
              <h3 className="mt-0.5 text-lg font-semibold leading-snug text-neutral-900 sm:text-xl">
                {sportEmoji(r.primarySport)} {r.primarySport} Official
                {r.certificationLevel ? ` · ${r.certificationLevel}` : ""}
              </h3>
              <p className="mt-0.5 text-sm text-neutral-500">
                {r.place ?? "Southern California"}
                {distance != null ? ` · ${Math.round(distance)} mi away` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {r.isSample ? (
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-full bg-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-500"
                >
                  Sample profile
                </button>
              ) : (
                <Link
                  href={`/find-refs/request/${encodeURIComponent(r.gotrefsId)}`}
                  className="rounded-full bg-[var(--red)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--red-dark)]"
                >
                  Request
                </Link>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-neutral-700">
            <span className="font-semibold text-neutral-900">{rateText(r)}</span>
            {r.travelRadiusMiles != null && <span>Travels up to {r.travelRadiusMiles} mi</span>}
            {r.ratingCount > 0 && (
              <span>
                ★ {r.ratingAverage} ({r.ratingCount})
              </span>
            )}
            {r.gamesCompleted > 0 && <span>{r.gamesCompleted} games on GotREFS</span>}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {r.sports.map((s) => (
              <span key={s} className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
                {s}
              </span>
            ))}
            <Link
              href={`/verify/${encodeURIComponent(r.gotrefsId)}`}
              className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              ID card · {r.gotrefsId}
            </Link>
          </div>

          {r.bio && <p className="mt-3 line-clamp-2 text-sm leading-6 text-neutral-600">{r.bio}</p>}
        </div>
      </div>
    </article>
  );
}

export function FindRefsExplorer({ refs }: { refs: PublicRefListing[] }) {
  const [keyword, setKeyword] = useState("");
  const [whereLabel, setWhereLabel] = useState("");
  const [place, setPlace] = useState<PlaceSelection | null>(null);
  const [radius, setRadius] = useState(25);
  const [sports, setSports] = useState<Set<string>>(new Set());
  const [certs, setCerts] = useState<Set<string>>(new Set());
  const [unit, setUnit] = useState<RateUnitFilter>("any");
  const [minRate, setMinRate] = useState("");
  const [maxRate, setMaxRate] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [travelsToMe, setTravelsToMe] = useState(false);
  const [sort, setSort] = useState<SortKey>("best");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const sportCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of refs) for (const s of r.sports) counts.set(s, (counts.get(s) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [refs]);

  const certCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of refs) if (r.certificationLevel) counts.set(r.certificationLevel, (counts.get(r.certificationLevel) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [refs]);

  const results = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const min = minRate ? Number(minRate) : null;
    const max = maxRate ? Number(maxRate) : null;

    const withDistance = refs.map((r) => ({
      r,
      d: place && r.coords ? distanceMiles(place, r.coords) : null,
    }));

    const filtered = withDistance.filter(({ r, d }) => {
      if (kw) {
        const hay = [r.name, r.primarySport, ...r.sports, r.certificationLevel ?? "", r.place ?? "", r.bio, r.gotrefsId]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      if (sports.size && !r.sports.some((s) => sports.has(s))) return false;
      if (certs.size && !(r.certificationLevel && certs.has(r.certificationLevel))) return false;
      if (unit !== "any" && r.rateUnit !== unit) return false;
      if (min != null && (r.rateMax ?? r.rateMin ?? 0) < min) return false;
      if (max != null && (r.rateMin ?? Infinity) > max) return false;
      if (verifiedOnly && !r.verified) return false;
      if (place) {
        if (d == null || d > radius) return false;
        if (travelsToMe && r.travelRadiusMiles != null && d > r.travelRadiusMiles) return false;
      }
      return true;
    });

    const byPrice = (a: PublicRefListing, b: PublicRefListing) =>
      (a.rateMin ?? Infinity) - (b.rateMin ?? Infinity);
    filtered.sort((a, b) => {
      // Real, bookable refs always come before sample profiles.
      if (a.r.isSample !== b.r.isSample) return a.r.isSample ? 1 : -1;
      if (Boolean(a.r.photoUrl) !== Boolean(b.r.photoUrl)) return a.r.photoUrl ? -1 : 1;
      if (sort === "price-asc") return byPrice(a.r, b.r);
      if (sort === "price-desc") return byPrice(b.r, a.r);
      if ((sort === "nearest" || sort === "best") && a.d != null && b.d != null) return a.d - b.d;
      if (sort === "best") {
        if (b.r.ratingCount !== a.r.ratingCount) return b.r.ratingCount - a.r.ratingCount;
      }
      return a.r.name.localeCompare(b.r.name);
    });
    return filtered;
  }, [refs, keyword, place, radius, sports, certs, unit, minRate, maxRate, verifiedOnly, travelsToMe, sort]);

  const pins: RefMapPin[] = useMemo(
    () =>
      results
        .filter(({ r }) => r.coords)
        .map(({ r }) => ({
          id: r.id,
          label: pinLabel(r),
          title: `${r.name} · ${r.primarySport}`,
          coords: r.coords!,
        })),
    [results]
  );

  const selectFromMap = useCallback(
    (id: string) => {
      setSelectedId(id);
      const index = results.findIndex(({ r }) => r.id === id);
      if (index >= visible) setVisible(index + 1);
      setMobileView("list");
      requestAnimationFrame(() =>
        document.getElementById(`ref-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
      );
    },
    [results, visible]
  );

  const activeFilterCount =
    sports.size + certs.size + (unit !== "any" ? 1 : 0) + (minRate ? 1 : 0) + (maxRate ? 1 : 0) + (verifiedOnly ? 1 : 0) + (travelsToMe ? 1 : 0);

  const clearAll = () => {
    setSports(new Set());
    setCerts(new Set());
    setUnit("any");
    setMinRate("");
    setMaxRate("");
    setVerifiedOnly(false);
    setTravelsToMe(false);
    setKeyword("");
  };

  const toggle = (set: Set<string>, value: string, next: boolean) => {
    const copy = new Set(set);
    if (next) copy.add(value);
    else copy.delete(value);
    return copy;
  };

  const filters = (
    <div>
      <FilterSection title="Sport">
        {sportCounts.map(([s, n]) => (
          <Checkbox key={s} label={`${sportEmoji(s)} ${s}`} count={n} checked={sports.has(s)} onChange={(v) => setSports(toggle(sports, s, v))} />
        ))}
      </FilterSection>

      <FilterSection title="Rate">
        <div className="mb-3 flex gap-1 rounded-full bg-neutral-100 p-1 text-xs font-semibold">
          {(
            [
              ["any", "Any"],
              ["hour", "Per hour"],
              ["game", "Per game"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setUnit(id)}
              className={`flex-1 whitespace-nowrap rounded-full px-1.5 py-1.5 ${unit === id ? "bg-white text-neutral-900 shadow" : "text-neutral-600"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex flex-1 items-center rounded-lg border border-neutral-300 px-2 text-sm">
            <span className="text-neutral-400">$</span>
            <input inputMode="numeric" placeholder="Min" value={minRate} onChange={(e) => setMinRate(e.target.value.replace(/\D/g, ""))} className="w-full bg-transparent px-1 py-2 outline-none" />
          </label>
          <span className="text-neutral-400">–</span>
          <label className="flex flex-1 items-center rounded-lg border border-neutral-300 px-2 text-sm">
            <span className="text-neutral-400">$</span>
            <input inputMode="numeric" placeholder="Max" value={maxRate} onChange={(e) => setMaxRate(e.target.value.replace(/\D/g, ""))} className="w-full bg-transparent px-1 py-2 outline-none" />
          </label>
        </div>
      </FilterSection>

      <FilterSection title="Certification level">
        {certCounts.map(([c, n]) => (
          <Checkbox key={c} label={c} count={n} checked={certs.has(c)} onChange={(v) => setCerts(toggle(certs, c, v))} />
        ))}
      </FilterSection>

      <FilterSection title="Distance">
        <label className="block text-xs font-medium text-neutral-500" htmlFor="find-refs-radius">
          Within
        </label>
        <select
          id="find-refs-radius"
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
        >
          {RADIUS_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m} miles of {place ? place.label.split(",")[0] : "your location"}
            </option>
          ))}
        </select>
        <div className="mt-2">
          <Checkbox label="Only REFS who travel to me" checked={travelsToMe} onChange={setTravelsToMe} />
        </div>
        {!place && <p className="mt-1 text-xs text-neutral-500">Enter a location above to filter by distance.</p>}
      </FilterSection>

      <FilterSection title="Status">
        <Checkbox label="Verified REFS only" checked={verifiedOnly} onChange={setVerifiedOnly} />
      </FilterSection>

      {activeFilterCount > 0 && (
        <button type="button" onClick={clearAll} className="mt-3 text-sm font-semibold text-[var(--navy)] underline">
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <div className="bg-white">
      {/* Search bar */}
      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-6">
          <div className="flex flex-1 flex-col rounded-2xl border border-neutral-300 shadow-sm focus-within:border-neutral-500 sm:flex-row sm:items-center sm:rounded-full">
            <label className="flex flex-1 items-center gap-2 px-4 py-2.5">
              <span className="text-neutral-400" aria-hidden>
                ⌕
              </span>
              <input
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setVisible(PAGE_SIZE);
                }}
                placeholder="Search by sport, name or GotREFS ID"
                className="w-full bg-transparent text-sm outline-none"
                aria-label="Search REFS"
              />
            </label>
            <span className="h-px w-full bg-neutral-200 sm:h-6 sm:w-px" aria-hidden />
            <div className="flex-1 px-4 py-1">
              <PlacesWhereInput
                id="find-refs-where"
                value={whereLabel}
                placeholder="City or ZIP"
                onChange={setWhereLabel}
                onPlaceSelect={(p) => {
                  setPlace(p);
                  setVisible(PAGE_SIZE);
                  if (p) setSort("best");
                }}
                className="text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="rounded-full border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-800 lg:hidden"
          >
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </button>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1400px] lg:grid-cols-[260px_minmax(0,1fr)_minmax(0,0.9fr)]">
        {/* Sidebar filters */}
        <aside className="hidden border-r border-neutral-200 px-6 py-2 lg:block">{filters}</aside>

        {/* Results */}
        <section className={`${mobileView === "map" ? "hidden lg:block" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 sm:px-6">
            <p className="text-sm text-neutral-600">
              <span className="font-semibold text-neutral-900">{results.length}</span>{" "}
              {results.length === 1 ? "REF" : "REFS"}
              {place ? ` near ${place.label.split(",")[0]}` : ""}
            </p>
            <label className="flex items-center gap-2 text-sm text-neutral-600">
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
              >
                <option value="best">Best match</option>
                <option value="price-asc">Lowest rate</option>
                <option value="price-desc">Highest rate</option>
                {place && <option value="nearest">Nearest</option>}
              </select>
            </label>
          </div>

          <Link
            href="/join"
            className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-[var(--navy)] px-4 py-3 text-sm text-white hover:opacity-95 sm:px-6"
          >
            <span>
              <span className="font-semibold">Are you a REFeree?</span> Join free and find games near you.
            </span>
            <span className="shrink-0 font-semibold underline">Join →</span>
          </Link>

          {results.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-lg font-semibold text-neutral-900">No REFS match these filters</p>
              <p className="mt-1 text-sm text-neutral-500">Try a wider distance or fewer filters.</p>
              <button type="button" onClick={clearAll} className="mt-4 text-sm font-semibold text-[var(--navy)] underline">
                Clear all filters
              </button>
            </div>
          ) : (
            <>
              {results.slice(0, visible).map(({ r, d }) => (
                <RefResultCard key={r.id} r={r} distance={d} selected={selectedId === r.id} onHover={setSelectedId} />
              ))}
              {visible < results.length && (
                <div className="px-6 py-6 text-center">
                  <button
                    type="button"
                    onClick={() => setVisible((v) => v + PAGE_SIZE)}
                    className="rounded-full border border-neutral-900 px-6 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                  >
                    Show more REFS
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Map */}
        <div
          className={`${mobileView === "map" ? "block" : "hidden"} border-l border-neutral-200 lg:block`}
        >
          <div className="sticky top-[var(--marketing-header-height)] h-[calc(100dvh-var(--marketing-header-height)-72px)] lg:h-[calc(100dvh-var(--marketing-header-height))]">
            <RefFinderMap
              pins={pins}
              selectedId={selectedId}
              center={place ? { lat: place.lat, lng: place.lng } : null}
              onSelect={selectFromMap}
            />
          </div>
        </div>
      </div>

      {/* Mobile list/map toggle */}
      <button
        type="button"
        onClick={() => setMobileView((v) => (v === "list" ? "map" : "list"))}
        className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-neutral-900 px-5 py-3 text-sm font-semibold text-white shadow-lg lg:hidden"
      >
        {mobileView === "list" ? "Show map" : "Show list"}
      </button>

      {/* Mobile filters drawer */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <button type="button" className="flex-1 bg-black/40" onClick={() => setFiltersOpen(false)} aria-label="Close filters" />
          <div className="flex w-[min(360px,90vw)] flex-col bg-white">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
              <p className="font-semibold">Filters</p>
              <button type="button" onClick={() => setFiltersOpen(false)} className="text-sm font-semibold text-[var(--navy)]">
                Done
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5">{filters}</div>
            <div className="border-t border-neutral-200 p-4">
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="w-full rounded-full bg-neutral-900 py-3 text-sm font-semibold text-white"
              >
                Show {results.length} REFS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
