import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "The Ledger — CPA.com Affiliate Signal Dashboard",
  description:
    "Sales intelligence for the CPA.com affiliate network, refreshed Monday and Wednesday mornings.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
