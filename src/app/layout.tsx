import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PlayerProvider } from "@/components/PlayerProvider";
import { Nav } from "@/components/Nav";
import { PlayerSwitcher } from "@/components/PlayerSwitcher";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Golf Weekend",
  description: "Scores, handicaps, and matchups for the golf weekend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">
        <PlayerProvider>
          <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
            <div className="flex items-center justify-between px-4 pt-3">
              <h1 className="text-lg font-semibold tracking-tight">
                ⛳ Golf Weekend
              </h1>
              <PlayerSwitcher />
            </div>
            <Nav />
          </header>
          <main className="flex-1 px-4 py-5 mx-auto w-full max-w-2xl">
            {children}
          </main>
        </PlayerProvider>
      </body>
    </html>
  );
}
