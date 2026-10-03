import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { Shell } from "@/components/shell";
import { OfflineSupport } from "@/components/offline";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "WatchKeeper — Watch Accuracy Analytics",
    template: "%s · WatchKeeper",
  },
  description:
    "Professional watch accuracy and timekeeping analytics for mechanical and quartz collectors.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0c0e11" },
    { media: "(prefers-color-scheme: light)", color: "#f5f1ea" },
  ],
};

// Applies the saved theme and accent before first paint. Without it the page always
// drew dark and then flipped for anyone who had chosen light.
const themeInit = `try{var d=document.documentElement,t=localStorage.getItem("wk-theme");if(t==="light"||(t==="system"&&!matchMedia("(prefers-color-scheme: dark)").matches))d.classList.remove("dark");if(localStorage.getItem("wk-accent")==="green")d.dataset.accent="green"}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full">
        <StoreProvider>
          <Shell>{children}</Shell>
        </StoreProvider>
        <OfflineSupport />
      </body>
    </html>
  );
}
