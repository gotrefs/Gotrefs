import Image from "next/image";
import { BRAND_NAME } from "@/lib/brand";

type BrandLogoProps = {
  href?: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  src?: string;
};

export function BrandLogo({
  href = "/",
  className = "",
  imageClassName = "h-12 w-auto",
  priority = false,
  src = "/gotrefs-logo.png",
}: BrandLogoProps) {
  const img = (
    <Image
      src={src}
      alt={BRAND_NAME}
      width={320}
      height={120}
      className={imageClassName}
      priority={priority}
    />
  );

  if (!href) {
    return <span className={`inline-flex items-center ${className}`}>{img}</span>;
  }

  // Native anchor so dashboard → marketing home always navigates (Next Link can soft-nav fail across layouts).
  return (
    <a
      href={href}
      className={`inline-flex cursor-pointer items-center ${className}`}
      aria-label={`${BRAND_NAME} home`}
    >
      {img}
    </a>
  );
}
