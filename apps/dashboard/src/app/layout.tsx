import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "../hooks/useTheme";
import { ToastProvider } from "../components/ui/ToastContainer";

export const metadata: Metadata = {
  title: "Restroex | Restaurant POS & AI WhatsApp Automation",
  description: "Production-grade restaurant operations dashboard, WhatsApp ordering engine, and POS control",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}