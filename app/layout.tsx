import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";

import "./globals.css";

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LMX Sovereign Wallet",
  description: "Personal identity graph and control dashboard",
};

const clerkAppearance = {
  variables: {
    colorPrimary: "#1c9cf0",
    colorBackground: "#12141b",
    colorText: "#e7e9ea",
    colorTextSecondary: "#8b9199",
    colorInputBackground: "#1e222a",
    colorInputText: "#e7e9ea",
    colorNeutral: "#30353f",
    borderRadius: "0.8125rem",
    fontFamily: "var(--font-open-sans), 'Open Sans', ui-sans-serif, system-ui, sans-serif",
  },
} as const;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html
        lang="en"
        className={`${openSans.variable} dark h-full antialiased`}
      >
        <body className="min-h-dvh bg-background font-sans text-foreground">{children}</body>
      </html>
    </ClerkProvider>
  );
}
