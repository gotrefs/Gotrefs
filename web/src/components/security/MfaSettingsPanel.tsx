"use client";

import { useCallback, useEffect, useState } from "react";

type MfaFactor = {
  id: string;
  friendly_name?: string | null;
  status: string;
};

type MfaStatus = {
  factors: MfaFactor[];
  currentLevel: string | null;
  nextLevel: string | null;
  enrolled: boolean;
};

export function MfaSettingsPanel({
  title = "Two-factor authentication",
  compact = false,
  onStatusChange,
}: {
  title?: string;
  compact?: boolean;
  onStatusChange?: (status: MfaStatus) => void;
}) {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [challengeFactorId, setChallengeFactorId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa");
      const json = (await res.json()) as MfaStatus & { error?: string };
      if (!res.ok) {
        setError(json.error || "Could not load MFA status.");
        return;
      }
      const next = {
        factors: json.factors ?? [],
        currentLevel: json.currentLevel,
        nextLevel: json.nextLevel,
        enrolled: Boolean(json.enrolled),
      };
      setStatus(next);
      onStatusChange?.(next);
    } catch {
      setError("Could not reach the server.");
    }
  }, [onStatusChange]);

  useEffect(() => {
    void load();
  }, [load]);

  async function startEnroll() {
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enroll" }),
      });
      const json = (await res.json()) as {
        error?: string;
        factorId?: string;
        qrCode?: string;
      };
      if (!res.ok) {
        setError(json.error || "Could not start MFA enrollment.");
        return;
      }
      setEnrollFactorId(json.factorId ?? null);
      setQrCode(json.qrCode ?? null);
      setCode("");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyEnrollment() {
    if (!enrollFactorId || !code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_enrollment",
          factorId: enrollFactorId,
          code: code.trim(),
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Invalid code.");
        return;
      }
      setMsg("Two-factor authentication is on.");
      setEnrollFactorId(null);
      setQrCode(null);
      setCode("");
      await load();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function startChallenge(factorId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "challenge", factorId }),
      });
      const json = (await res.json()) as { error?: string; challengeId?: string };
      if (!res.ok) {
        setError(json.error || "Could not start MFA challenge.");
        return;
      }
      setChallengeFactorId(factorId);
      setChallengeId(json.challengeId ?? null);
      setCode("");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyChallenge() {
    if (!challengeFactorId || !challengeId || !code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_challenge",
          factorId: challengeFactorId,
          challengeId,
          code: code.trim(),
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Invalid code.");
        return;
      }
      setMsg("Session elevated. You can continue with payout actions.");
      setChallengeId(null);
      setChallengeFactorId(null);
      setCode("");
      await load();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  const verifiedFactor = status?.factors.find((f) => f.status === "verified");
  const needsAal2 = status?.enrolled && status.currentLevel !== "aal2";

  return (
    <div
      className={
        compact
          ? "rounded-2xl border border-neutral-200 bg-white p-4"
          : "rounded-[1.5rem] border border-neutral-200 bg-white p-5 shadow-sm"
      }
    >
      <p className="text-xs font-black uppercase tracking-[0.16em] text-neutral-500">Security</p>
      <h3 className="mt-1 text-lg font-bold text-[var(--navy)]">{title}</h3>
      <p className="mt-1 text-sm text-neutral-600">
        Required before connecting a bank for ACH direct deposit or managing tax payout settings.
      </p>

      {status ? (
        <p className="mt-3 text-sm font-semibold text-neutral-800">
          Status:{" "}
          {status.enrolled
            ? status.currentLevel === "aal2"
              ? "Enabled · verified this session"
              : "Enabled · confirm a code to unlock payout actions"
            : "Not enabled"}
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {msg ? <p className="mt-3 text-sm text-emerald-700">{msg}</p> : null}

      {!status?.enrolled && !enrollFactorId ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => void startEnroll()}
          className="mt-4 rounded-full bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Starting…" : "Enable authenticator app"}
        </button>
      ) : null}

      {enrollFactorId && qrCode ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-neutral-600">
            Scan this QR code in Google Authenticator, 1Password, or Authy, then enter the 6-digit code.
          </p>
          {qrCode.startsWith("data:") ? (
            <div className="inline-block rounded-xl border border-neutral-200 bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="MFA QR code" className="h-40 w-40" />
            </div>
          ) : qrCode.startsWith("<svg") ? (
            <div
              className="inline-block rounded-xl border border-neutral-200 bg-white p-3"
              dangerouslySetInnerHTML={{ __html: qrCode }}
            />
          ) : (
            <p className="break-all text-xs text-neutral-500">{qrCode}</p>
          )}
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm"
          />
          <button
            type="button"
            disabled={loading || code.trim().length < 6}
            onClick={() => void verifyEnrollment()}
            className="rounded-full bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Confirm and enable"}
          </button>
        </div>
      ) : null}

      {needsAal2 && verifiedFactor && !challengeId ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => void startChallenge(verifiedFactor.id)}
          className="mt-4 rounded-full border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-900 disabled:opacity-50"
        >
          Confirm 2FA for this session
        </button>
      ) : null}

      {challengeId ? (
        <div className="mt-4 space-y-3">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm"
          />
          <button
            type="button"
            disabled={loading || code.trim().length < 6}
            onClick={() => void verifyChallenge()}
            className="rounded-full bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Verify code"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
