import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clouds Community",
    short_name: "Clouds",
    description: "Comunidades que acontecem agora.",
    start_url: "/",
    display: "standalone",
    background_color: "#060410",
    theme_color: "#16052F",
    icons: [
      { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/clouds-notification-badge-v2.png", sizes: "96x96", type: "image/png", purpose: "monochrome" },
    ],
  };
}
