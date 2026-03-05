import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Life Calculator",
  description: "See your financial future clearly.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#f0e6d5] text-stone-900 antialiased">{children}</body>
    </html>
  );
}
