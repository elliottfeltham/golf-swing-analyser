import type { Metadata } from "next";

import "./styles.css";

export const metadata: Metadata = {
  title: "Golf Swing Analyser",
  description:
    "Private, browser-based golf swing analysis with evidence-linked AI guidance.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
