import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingHeader />
      <div className="min-h-[60vh] bg-[var(--grey-light)]">{children}</div>
      <MarketingFooter />
    </>
  );
}
