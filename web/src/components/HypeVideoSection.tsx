export function HypeVideoSection() {
  return (
    <section className="bg-black px-4 py-4 sm:py-6">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-xl border border-white/10 shadow-2xl">
        <iframe
          src="/gotrefs-hype.html"
          title="GotREFS intro"
          className="aspect-video w-full border-0 bg-[#0a0d1a]"
          loading="eager"
        />
      </div>
    </section>
  );
}
