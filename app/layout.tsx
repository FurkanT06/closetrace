import type { Metadata } from "next";
import "./theme.css";
import "./legibility.css";

export const metadata: Metadata = {
  title: "CloseTrace — Every adjustment, accounted for",
  description: "A considered workspace for acquisition working-capital reviews. Reconcile balances, inspect evidence, and document the decision.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
