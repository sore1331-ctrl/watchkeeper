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
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
