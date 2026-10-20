import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Zero-Trust Starter",
  description: "Zero-trust full-stack starter with OIDC, RBAC, audit & AI assistant",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
