import type { Metadata } from "next";
import { themeBootstrapScript } from "@/lib/theme/theme-constants";
import "./globals.css";

export const metadata: Metadata = {
  title: "French, for real life",
  description: "Practical French lessons, helpful review, and carefully grounded tutor support.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning covers only this element: the inline script
    // sets data-theme before paint, so the server-rendered attribute set
    // differs on purpose.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
