import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sigma",
    short_name: "Sigma",
    description: "Working iPhone and Mac app UIs for film and TV sets.",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0B0D",
    theme_color: "#0B0B0D",
    icons: [
      { src: "/m/icon?name=Sigma&size=192", sizes: "192x192", type: "image/png" },
      { src: "/m/icon?name=Sigma&size=512", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
