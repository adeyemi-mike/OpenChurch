import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono, Lora, Fraunces } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ClientErrorReporter } from "@/components/dev/client-error-reporter";
import { getPublicOrigin } from "@/lib/url";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Public church website typography (see lib/themes/fonts.ts)
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

/** Request-aware metadataBase — never emits localhost into production SEO URLs. */
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  return {
    metadataBase: new URL(getPublicOrigin(h)),
    title: {
      default: "OpenChurch — Every Church Deserves a Digital Home",
      template: "%s · OpenChurch",
    },
    description:
      "Open-source church website platform. Create, customise and publish a professional church website — no coding required.",
    icons: {
      icon: "/favicon.svg",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        // Browser extensions (Grammarly, password managers, translators…) inject
        // attributes into <body> before hydration, which triggers React's
        // "attributes didn't match" warning. Suppressed here + on <html>.
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} ${fraunces.variable} antialiased bg-background text-foreground`}
      >
        {children}
        {/* Dev-only: captures uncaught client errors with stacks so
            recurring browser errors (e.g. the reported "data: {..." JSON
            SyntaxError) can be diagnosed from logs/client-errors.log. */}
        <ClientErrorReporter />
        <Toaster />
        <Sonner position="top-right" />
      </body>
    </html>
  );
}
