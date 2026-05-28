import type { Metadata } from "next";
import { Barlow_Condensed, DM_Sans } from "next/font/google";
import "./globals.css";
import siteData from "@/data/site-data.json";

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-barlow",
});

const dm = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm",
});

const meta = siteData.meta as { defaultTitle: string };

export const metadata: Metadata = {
  title: meta.defaultTitle,
  description: "Connect verified referees with event organizers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${barlow.variable} ${dm.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
