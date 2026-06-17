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
  uploadedLabel = "On file",
  accept = ".jpg,.jpeg,.png,.pdf",
}: VerificationUploadFieldProps) {
  return (
    <div className="rounded-xl border-2 border-[var(--blue)]/25 bg-[var(--grey-light)]/40 p-5">
      <p className="font-display text-lg font-bold text-[var(--navy)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
      <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--blue)]/40 bg-white px-4 py-6 transition-colors hover:border-[var(--blue)] hover:bg-[var(--blue)]/5">
        <span className="text-sm font-semibold text-[var(--blue)]">Choose file to upload</span>
        <span className="mt-1 text-xs text-[var(--muted)]">JPG, PNG, or PDF</span>
        <input type="file" accept={accept} className="sr-only" onChange={onFile} />
      </label>
      {uploaded && (
        <p className="mt-3 text-sm font-semibold text-green-700">{uploadedLabel}</p>
      )}
    </div>
  );
}
