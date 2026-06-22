"use client";

import { useState } from "react";

type DemoRequestButtonProps = {
  className?: string;
};

const CALENDLY_URL = "https://calendly.com/gotrefs/demo";

export function DemoRequestButton({ className = "" }: DemoRequestButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  function submitDemoRequest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = [
      `Name: ${name}`,
      `Phone: ${phone}`,
      `Email: ${email}`,
      "",
      "Message:",
      message,
      "",
      `Calendly invite: ${CALENDLY_URL}`,
    ].join("\n");
    window.location.href = `mailto:hello@gotrefs.org?subject=${encodeURIComponent(
      "GotREFS Demo Request"
    )}&body=${encodeURIComponent(body)}`;
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        Book a Demo
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 text-[var(--navy)] shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-request-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--red)]">GotREFS Demo</p>
                <h2 id="demo-request-title" className="mt-1 text-2xl font-black">
                  Book a demo
                </h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Tell us how to reach you, then choose a time on Calendly.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-[var(--border)] px-3 py-1 text-sm font-medium"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <form onSubmit={submitDemoRequest} className="mt-6 grid gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Name
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl border border-[var(--border)] px-3 py-2 font-normal"
                  autoComplete="name"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Phone number
                <input
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-xl border border-[var(--border)] px-3 py-2 font-normal"
                  autoComplete="tel"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Email
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl border border-[var(--border)] px-3 py-2 font-normal"
                  autoComplete="email"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Message
                <textarea
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-24 rounded-xl border border-[var(--border)] px-3 py-2 font-normal"
                  placeholder="Tell us about your league, tournament, school, or referee needs."
                />
              </label>

              <div className="rounded-xl border border-[var(--blue)]/20 bg-[var(--blue)]/5 p-4">
                <p className="text-sm font-bold">Calendly invite</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Choose a time that works for you after sending the request.
                </p>
                <a
                  href={CALENDLY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-lg bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white"
                >
                  Open Calendly
                </a>
              </div>

              <button type="submit" className="rounded-lg bg-[var(--red)] px-4 py-3 text-sm font-bold text-white">
                Send demo request
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
