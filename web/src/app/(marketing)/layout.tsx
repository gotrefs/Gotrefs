import { HashScrollOnLoad } from "@/components/marketing/HashScrollOnLoad";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HashScrollOnLoad />
      {children}
    </>
  );
}
