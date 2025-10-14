import type { Metadata } from "next";
import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "../styles/theme.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Social Remix",
  description: "Creative automation for social campaigns",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="w-full flex items-center justify-between p-4 border-b border-black/10">
          <div className="flex items-center gap-3">
            <Image src="/socialremix_logo.svg" alt="Social Remix" width={256} height={100} priority />
          </div>
        </header>
        <main className="container mx-auto p-6">{children}</main>
        <footer className="w-full p-6 text-sm text-black/60 border-t border-black/10">© {new Date().getFullYear()} Social Remix</footer>
      </body>
    </html>
  );
}
