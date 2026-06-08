import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import siteData from "@/data/site-data.json";

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-open-sans",
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
    <html lang="en" className={`${openSans.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
