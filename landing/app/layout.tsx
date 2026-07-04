import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Agon — Free Fitness Studio Management",
  description:
    "Open-source, self-hosted fitness studio management. Class scheduling, memberships, payments, check-ins, and a mobile app. No subscriptions. Your data stays on your machine.",
  openGraph: {
    title: "Agon — Free Fitness Studio Management",
    description:
      "Open-source, self-hosted fitness studio management. No subscriptions. No data sharing. No vendor lock-in.",
    url: "https://agon-studio.dev",
    siteName: "Agon",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Agon — Free Fitness Studio Management",
    description:
      "Open-source, self-hosted fitness studio management. No subscriptions. No data sharing.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} bg-zinc-950 text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
