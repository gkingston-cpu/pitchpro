import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DM_Sans } from "next/font/google";
import "./globals.css";

// Closest open typeface to Google Sans; variable weights cover 400–750.
const dmSans = DM_Sans({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "The Ledger — FinReg Signal Dashboard",
  description:
    "Sales intelligence for the CPA.com affiliate network, refreshed Monday and Wednesday mornings.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={dmSans.className}>{children}</body>
    </html>
  );
}
