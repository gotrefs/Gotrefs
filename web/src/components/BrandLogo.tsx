import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
};

export function BrandLogo({
  href = "/",
  className = "",
  imageClassName = "h-9 w-auto",
  priority = false,
}: BrandLogoProps) {
  const img = (
    <Image
      src="/gotrefs-logo.png"
      alt="GotRefs"
      width={320}
      height={120}
      className={imageClassName}
      priority={priority}
    />
  );

  if (!href) {
    return <span className={`inline-flex items-center ${className}`}>{img}</span>;
  }

  return (
    <Link href={href} className={`inline-flex items-center ${className}`}>
      {img}
    </Link>
  );
}
