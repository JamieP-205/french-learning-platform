import type { Metadata } from "next";
import { themeBootstrapScript } from "@/lib/theme/theme-constants";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "French for Life",
    template: "%s · French for Life",
  },
  description:
    "Practical French for everyday life. Learn a phrase first, then use it, ten minutes at a time.",
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
