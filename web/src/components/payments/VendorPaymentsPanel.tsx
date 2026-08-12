"use client";

import { useCallback, useEffect, useState } from "react";

type Vendor = {
  id: string;
  display_name: string;
  contact_email: string | null;
  member_id: string | null;
  status: string;
  created_at: string;
};

export function VendorPaymentsPanel() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [payeeMemberId, setPayeeMemberId] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/stripe/vendors");
      const json = (await res.json()) as { vendors?: Vendor[]; error?: string };
      if (!res.ok) {
        setError(json.error || "Could not load vendors.");
        return;
      }
      setVendors(json.vendors ?? []);
      setError(null);
    } catch {
      setError("Could not reach the server.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createVendor() {
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/stripe/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          displayName: name,
          contactEmail: email || undefined,
          payeeMemberId: payeeMemberId.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string; vendor?: Vendor };
      if (!res.ok) {
        setError(json.error || "Could not create vendor.");
        return;
      }
      setMsg(`Added vendor “${json.vendor?.display_name}”.`);
      setName("");
      setEmail("");
      setPayeeMemberId("");
      if (json.vendor?.id) setSelectedVendorId(json.vendor.id);
      await load();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function payVendor() {
    if (!selectedVendorId) {
      setError("Select a vendor.");
      return;
    }
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/stripe/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pay",
          vendorId: selectedVendorId,
          amountDollars: Number(amount),
          description,
        }),
      });
      const json = (await res.json()) as { error?: string; url?: string };
      if (!res.ok) {
        setError(json.error || "Could not start vendor checkout.");
        return;
      }
      if (json.url) window.location.assign(json.url);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function linkPayee() {
    if (!selectedVendorId || !payeeMemberId.trim()) {
      setError("Select a vendor and enter the payee member id (GotRefs user id).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "onboard_payee",
          vendorId: selectedVendorId,
          payeeMemberId: payeeMemberId.trim(),
        }),
      });
      const json = (await res.json()) as { error?: string; code?: string; url?: string };
      if (!res.ok) {
        setError(json.error || "Could not start vendor Connect onboarding.");
        return;
      }
      if (json.url) window.location.assign(json.url);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm lg:p-6">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-neutral-500">
        Custom vendor payments
      </p>
      <h2 className="mt-1 font-display text-2xl font-black text-[var(--navy)]">Pay a vendor</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
        Pay non-ref vendors through Stripe Checkout (card or ACH debit). Funds transfer to their
        Connect account for ACH direct deposit and roll into the same 1099 ledger when linked.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-neutral-200 p-4">
          <p className="text-sm font-bold text-neutral-900">Add vendor</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Vendor name"
            className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Contact email (optional)"
            className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm"
          />
          <input
            value={payeeMemberId}
            onChange={(e) => setPayeeMemberId(e.target.value)}
            placeholder="Payee GotRefs member id (optional)"
            className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm"
          />
          <button
            type="button"
            disabled={loading || !name.trim()}
            onClick={() => void createVendor()}
            className="rounded-full bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save vendor
          </button>
        </div>

        <div className="space-y-3 rounded-2xl border border-neutral-200 p-4">
          <p className="text-sm font-bold text-neutral-900">Checkout</p>
          <select
            value={selectedVendorId}
            onChange={(e) => setSelectedVendorId(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm"
          >
            <option value="">Select vendor…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.display_name}
                {v.member_id ? "" : " (needs Connect link)"}
              </option>
            ))}
          </select>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (USD)"
            inputMode="decimal"
            className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading || !selectedVendorId || !amount}
              onClick={() => void payVendor()}
              className="rounded-full bg-[#d81d24] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Pay with Stripe
            </button>
            <button
              type="button"
              disabled={loading || !selectedVendorId || !payeeMemberId.trim()}
              onClick={() => void linkPayee()}
              className="rounded-full border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-900 disabled:opacity-50"
            >
              Link payee + Connect
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {msg ? <p className="mt-3 text-sm text-emerald-700">{msg}</p> : null}

      {vendors.length > 0 ? (
        <ul className="mt-4 divide-y divide-neutral-100 rounded-xl border border-neutral-200 text-sm">
          {vendors.map((v) => (
            <li key={v.id} className="flex justify-between gap-3 px-3 py-2.5">
              <span className="font-semibold text-neutral-900">{v.display_name}</span>
              <span className="text-xs text-neutral-500">
                {v.member_id ? "Connect linked" : "Awaiting Connect"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
