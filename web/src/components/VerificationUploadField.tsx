"use client";

type VerificationUploadFieldProps = {
  title: string;
  description: string;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFileComplete?: () => void;
  uploaded?: boolean;
  uploadedLabel?: string;
  accept?: string;
};

export function VerificationUploadField({
  title,
  description,
  onFile,
  uploaded,
  uploadedLabel = "Uploaded",
  accept = ".jpg,.jpeg,.png,.pdf",
}: VerificationUploadFieldProps) {
  return (
    <div
      className={`rounded-xl border-2 p-5 ${
        uploaded
          ? "border-green-300 bg-green-50/60"
          : "border-[var(--blue)]/25 bg-[var(--grey-light)]/40"
      }`}
    >
      <p className="font-display text-lg font-bold text-[var(--navy)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
      <label
        className={`relative mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 transition-colors ${
          uploaded
            ? "border-green-400 bg-white hover:border-green-500"
            : "border-[var(--blue)]/40 bg-white hover:border-[var(--blue)] hover:bg-[var(--blue)]/5"
        }`}
      >
        {uploaded ? (
          <>
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500 text-2xl font-black text-white shadow-sm"
              aria-hidden
            >
              ✓
            </span>
            <span className="mt-3 text-sm font-semibold text-green-800">{uploadedLabel}</span>
            <span className="mt-1 text-xs text-green-700/80">Tap to replace file</span>
          </>
        ) : (
          <>
            <span className="text-sm font-semibold text-[var(--blue)]">Choose file to upload</span>
            <span className="mt-1 text-xs text-[var(--muted)]">JPG, PNG, or PDF</span>
          </>
        )}
        <input type="file" accept={accept} className="sr-only" onChange={onFile} />
      </label>
    </div>
  );
}
