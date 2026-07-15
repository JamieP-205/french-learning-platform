import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "French, for real life",
  description: "Practical French missions, adaptive review, and source-bound tutor support.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
