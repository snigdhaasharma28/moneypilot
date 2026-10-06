import type { Metadata } from "next";
import { Inter, Protest_Strike } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const protestStrike = Protest_Strike({
  variable: "--font-protest-strike",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Inbox Claim Matcher | MoneyPilot",
  description:
    "Find class-action settlements you may be owed, with the email that proves it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${protestStrike.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
