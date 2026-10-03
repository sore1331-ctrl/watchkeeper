import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WatchKeeper",
    short_name: "WatchKeeper",
    description: "Watch accuracy and timekeeping analytics for mechanical and quartz collectors.",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0e11",
    theme_color: "#0c0e11",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Collection", url: "/watches" },
      { name: "Insights", url: "/insights" },
    ],
  };
}
