import { HashScrollOnLoad } from "@/components/marketing/HashScrollOnLoad";
import { MarketingFullPageScroll } from "@/components/marketing/MarketingFullPageScroll";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HashScrollOnLoad />
      <MarketingFullPageScroll />
      {children}
    </>
  );
}
