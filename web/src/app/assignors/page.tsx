import Link from "next/link";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";

const next = encodeURIComponent("/dashboard/assignor");

export default function AssignorsPage() {
  return (
    <>
      <MarketingHeader />
      <main className="bg-slate-50">
        <section className="hero-arbiter-bg px-4 py-20 text-white">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--red)]">For Assignors</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
                Bring your ref list into GotREFS in minutes.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-lg">
                Add refs one at a time or upload your current crew list. GotREFS keeps the roster organized so
                future games can be staffed faster.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href={`/auth/signup?role=assignor&next=${next}`} className="btn-primary w-full sm:w-auto">
                  Start as an assignor
                </Link>
                <Link href={`/auth/login?next=${next}`} className="btn-outline-light w-full sm:w-auto">
                  Log in to add refs
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur">
              <div className="rounded-[1.5rem] bg-white p-5 text-[var(--navy)]">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--red)]">Clean import flow</p>
                <div className="mt-5 grid gap-3">
                  {[
                    ["1", "Choose manual entry or upload a file"],
                    ["2", "GotREFS stores each ref in your Supabase roster"],
                    ["3", "Refs can later claim and complete their profiles"],
                  ].map(([number, text]) => (
                    <div key={number} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--navy)] text-sm font-black text-white">
                        {number}
                      </span>
                      <span className="text-sm font-bold">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ["Manual add", "Perfect for adding a few refs with name, sport, certification, email, and notes."],
                ["File upload", "Upload a CSV or text list from your current spreadsheet and store the refs at once."],
                ["Future AI cleanup", "Use an LLM to clean messy files, create draft profiles, and send claim-profile emails."],
              ].map(([title, body]) => (
                <article key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-black text-[var(--navy)]">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
