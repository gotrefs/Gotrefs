import { BRAND_NAME } from "@/lib/brand";

/** Renders the canonical brand name with correct mixed-case styling. */
export function BrandName({ className = "" }: { className?: string }) {
  return <span className={className ? `normal-case ${className}` : "normal-case"}>{BRAND_NAME}</span>;
}
