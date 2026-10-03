import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { Shell } from "@/components/shell";

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
  themeColor: "#0a0e14",
};

// Applies the saved theme before first paint. Without it the page always
// drew dark and then flipped for anyone who had chosen light.
const themeInit = `try{var t=localStorage.getItem("wk-theme");if(t==="light"||(t==="system"&&!matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.remove("dark")}catch(e){}`;

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
      </body>
    </html>
  );
}
