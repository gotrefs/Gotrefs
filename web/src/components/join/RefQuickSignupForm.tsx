"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PasswordField } from "@/components/auth/PasswordField";
import { RefereeIdCard } from "@/components/RefereeIdCard";
import { saveRefSignupDraft } from "@/lib/auth/signup-draft";
import { uploadRefProfilePhoto } from "@/lib/auth/upload-ref-signup-docs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POPULAR = ["Basketball", "Soccer", "Flag Football", "Volleyball", "Baseball", "Softball"];
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const inputClass =
  "mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-3 text-[15px] text-neutral-900 outline-none focus:border-neutral-900";

type Done = { gotrefsId: string | null; needsEmailConfirmation: boolean; photoSaved: boolean };

/**
 * Shrink the chosen photo to a small JPEG so it can travel with the signup request
 * and be saved on the server (which works before the email is confirmed).
 * Returns null if this browser can't read the image; the caller then falls back.
 */
async function shrinkPhoto(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    for (const [maxSide, quality] of [[900, 0.85], [700, 0.75], [500, 0.7]] as const) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      // ~1 MB of base64: far under the server's limit.
      if (dataUrl.startsWith("data:image/jpeg") && dataUrl.length < 1_400_000) return dataUrl;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Referee signup in one screen: name, photo, sport (+ email and password to log in).
 * No government ID or certification here. The ref gets an ID card right away; it only
 * says "Verified" once GoTRefs has verified them.
 */
export function RefQuickSignupForm({ sports }: { sports: string[] }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [sport, setSport] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [resend, setResend] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const fileRef = useRef<HTMLInputElement>(null);

  // Preview the chosen photo; release the object URL when it changes.
  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const popular = POPULAR.filter((s) => sports.includes(s));

  function choosePhoto(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose a photo (JPG or PNG).");
    if (file.size > MAX_PHOTO_BYTES) return setError("That photo is over 10 MB. Choose a smaller one.");
    setPhoto(file);
  }

  function validate(): string | null {
    if (!firstName.trim() || !lastName.trim()) return "Enter your first and last name.";
    if (!photo) return "Add a photo of yourself for your REF card.";
    if (!sport) return "Pick the sport you REFeree.";
    if (!EMAIL_RE.test(email.trim())) return "Enter a valid email address.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return "Password needs at least one letter and one number.";
    }
    return null;
  }

  /** Keep the photo on this device so it attaches to the card after they sign in. */
  async function holdPhotoForLater() {
    if (!photo) return;
    try {
      await saveRefSignupDraft(
        {
          screen: "quick",
          fullName: `${firstName} ${lastName}`.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          primarySport: sport,
          customPrimarySport: "",
          secondarySport: "",
          additionalSports: [],
          certificationLevel: "",
          additionalCertificationLevels: [],
          hourlyRateMin: "",
          hourlyRateMax: "",
          baseCity: "",
          travelRadius: "",
          workRegions: [],
          termsAccepted: true,
          recommendedAssignorName: "",
          recommendedAssignorEmail: "",
          recommendedAssignorPhone: "",
        },
        { photo }
      );
      localStorage.setItem("gotrefs_pending_ref_docs", "1");
    } catch {
      // Storage unavailable: they can add the photo from their dashboard.
    }
  }

  async function resendEmail() {
    setResend("sending");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), pendingRedirect: "/dashboard/referee" }),
      });
      setResend(res.ok ? "sent" : "failed");
    } catch {
      setResend("failed");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const profilePhotoDataUrl = photo ? await shrinkPhoto(photo) : null;
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "ref",
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          password,
          primarySport: sport,
          verificationSkipped: true,
          termsAccepted: true,
          acceptedTermsSlug: "referee-official-terms",
          ...(profilePhotoDataUrl ? { profilePhotoDataUrl } : {}),
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        needsEmailConfirmation?: boolean;
        userId?: string | null;
        gotrefsId?: string | null;
        photoSaved?: boolean;
      };
      if (!res.ok) {
        setError(json.error || "Could not create your account. Try again.");
        setSaving(false);
        return;
      }

      // Normally the server has already saved the photo. These are fallbacks.
      let photoSaved = json.photoSaved === true;
      if (!photoSaved && !json.needsEmailConfirmation && json.userId && photo) {
        try {
          await uploadRefProfilePhoto(json.userId, photo);
          photoSaved = true;
        } catch {
          // Fall through: hold the photo and attach it from the dashboard.
        }
      }
      if (!photoSaved) await holdPhotoForLater();

      setDone({
        gotrefsId: json.gotrefsId ?? null,
        needsEmailConfirmation: Boolean(json.needsEmailConfirmation),
        photoSaved,
      });
      setSaving(false);
    } catch {
      setError("Could not reach the server. Try again in a moment.");
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-3xl bg-white p-7 text-center shadow-[0_10px_40px_rgba(0,0,0,0.08)] sm:p-8">
        <h2 className="text-2xl font-semibold text-neutral-900">Your REF card is ready, {firstName.trim()}!</h2>
        <p className="mt-1 text-sm text-neutral-600">
          {done.needsEmailConfirmation
            ? `We sent a link to ${email.trim().toLowerCase()}. Open it ${
                done.photoSaved ? "on your phone or computer" : "on this device"
              } to activate your card and its QR code. Can't find it? Check your junk or spam folder.`
            : "Show the QR code at any game so organizers can pull up your ID."}
        </p>
        <div className="mx-auto mt-5 w-full max-w-[360px] text-left">
          <RefereeIdCard
            fullName={`${firstName} ${lastName}`.trim()}
            gotrefsId={done.gotrefsId ?? undefined}
            primarySport={sport}
            avatarUrl={photoUrl ?? undefined}
            emptyPlaceholders
            hideQr={done.needsEmailConfirmation || !done.gotrefsId}
            className="w-full shadow-xl"
          />
        </div>
        {done.needsEmailConfirmation && (
          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={resendEmail}
              disabled={resend === "sending" || resend === "sent"}
              className="w-full rounded-xl border border-neutral-300 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
            >
              {resend === "sending" ? "Sending…" : resend === "sent" ? "Email sent again" : "Didn't get it? Send again"}
            </button>
            {resend === "failed" && (
              <p className="text-sm text-red-600">Couldn&apos;t send the email. Try again in a minute.</p>
            )}
            <p className="text-sm text-neutral-600">
              Already clicked the link?{" "}
              <Link href="/auth/login" className="font-semibold text-neutral-900 underline">
                Log in
              </Link>
            </p>
          </div>
        )}
        {!done.needsEmailConfirmation && (
          <a
            href="/dashboard/referee"
            className="mt-6 block w-full rounded-xl bg-[var(--red)] py-3.5 text-base font-semibold text-white hover:bg-[var(--red-dark)]"
          >
            Find games near me
          </a>
        )}
        <p className="mt-4 text-xs leading-5 text-neutral-500">
          Your card says &ldquo;Official ID card&rdquo; for now. It changes to &ldquo;Verified official&rdquo; once
          GotREFS verifies you.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-3xl bg-white p-7 shadow-[0_10px_40px_rgba(0,0,0,0.08)] sm:p-8">
      <h2 className="text-2xl font-semibold text-neutral-900">Get your REF card</h2>
      <p className="mt-1 text-sm text-neutral-600">Free. Takes about a minute. No ID needed to sign up.</p>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-neutral-300 bg-neutral-50 text-2xl text-neutral-400 hover:border-neutral-500"
          aria-label={photo ? "Change your photo" : "Add your photo"}
        >
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden>+</span>
          )}
        </button>
        <div>
          <p className="text-sm font-semibold text-neutral-900">Your photo</p>
          <button type="button" onClick={() => fileRef.current?.click()} className="text-sm font-semibold text-neutral-700 underline">
            {photo ? "Change photo" : "Add a photo"}
          </button>
          <p className="text-xs text-neutral-500">A clear photo of your face. It goes on your card.</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => choosePhoto(e.target.files?.[0])}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-neutral-900">
          First name
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} autoComplete="given-name" />
        </label>
        <label className="block text-sm font-semibold text-neutral-900">
          Last name
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} autoComplete="family-name" />
        </label>
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-semibold text-neutral-900">Your sport</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {popular.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSport(s)}
              aria-pressed={sport === s}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                sport === s
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <select
          value={popular.includes(sport) ? "" : sport}
          onChange={(e) => setSport(e.target.value)}
          className={inputClass}
          aria-label="Other sport"
        >
          <option value="">Other sport…</option>
          {sports
            .filter((s) => !popular.includes(s))
            .map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
        </select>
      </fieldset>

      <label className="mt-5 block text-sm font-semibold text-neutral-900">
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} autoComplete="email" placeholder="you@example.com" />
      </label>
      <div className="mt-4">
        <PasswordField
          label="Password"
          labelClassName="block text-sm font-semibold text-neutral-900"
          inputClassName="w-full rounded-xl border border-neutral-300 bg-white py-3 pl-3.5 pr-14 text-[15px] text-neutral-900 outline-none focus:border-neutral-900"
          className="!mt-1.5"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <p className="mt-1 text-xs text-neutral-500">At least 8 characters, with a letter and a number.</p>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-6 w-full rounded-xl bg-[var(--red)] py-3.5 text-base font-semibold text-white hover:bg-[var(--red-dark)] disabled:opacity-60"
      >
        {saving ? "Creating your card…" : "Get my REF card"}
      </button>
      <p className="mt-3 text-center text-xs leading-5 text-neutral-500">
        By signing up you agree to the{" "}
        <Link href="/policies/referee-official-terms" target="_blank" className="underline">
          REFeree Terms
        </Link>
        , Privacy Policy and Community Standards.
      </p>
    </form>
  );
}
