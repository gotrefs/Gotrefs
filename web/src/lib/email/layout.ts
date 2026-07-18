import { BRAND_NAME } from "@/lib/brand";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function emailLayout(opts: {
  title: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}) {
  const cta =
    opts.ctaLabel && opts.ctaUrl
      ? `<p style="margin:28px 0 8px;">
          <a href="${escapeHtml(opts.ctaUrl)}"
             style="display:inline-block;background:#0D1B2A;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;">
            ${escapeHtml(opts.ctaLabel)}
          </a>
        </p>`
      : "";

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#F8FAFB;font-family:Arial,Helvetica,sans-serif;color:#0D1B2A;">
    <div style="max-width:560px;margin:24px auto;background:#ffffff;border:1px solid #E2E8EF;border-radius:16px;padding:28px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#F04E23;">${BRAND_NAME}</p>
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${escapeHtml(opts.title)}</h1>
      <div style="font-size:15px;line-height:1.6;color:#3A5068;">${opts.bodyHtml}</div>
      ${cta}
      <p style="margin:28px 0 0;font-size:12px;color:#7B8FA0;">You’re receiving this because you have a ${BRAND_NAME} account.</p>
    </div>
  </body>
</html>`;
}

export { escapeHtml };
