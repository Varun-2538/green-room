import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { currentCreator } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

// Every page is per-user (session cookie), so nothing is prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Green Room",
  description: "Mosaic tells you who. Green Room gets them on your show.",
};

async function Nav() {
  const creator = await currentCreator(getDb());
  return (
    <header className="border-b border-line bg-surface/70 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href={creator ? "/desk" : "/"} className="font-display text-xl font-semibold text-brand">
          Green Room
        </Link>
        {creator ? (
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/desk" className="hover:text-brand">Desk</Link>
            <Link href="/settings" className="hover:text-brand">Settings</Link>
            <form action="/api/auth/logout" method="post">
              <button className="text-muted hover:text-foreground">Log out</button>
            </form>
          </nav>
        ) : null}
      </div>
    </header>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Nav />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
