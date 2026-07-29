import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "باشگاه مراقبین سلامت اول",
    short_name: "باشگاه مراقبین",
    description: "سامانه عضویت، جذب، پایش و توسعه حرفه‌ای مراقبین سلامت اول",
    start_url: "/admin/users",
    display: "standalone",
    background_color: "#f5f8f6",
    theme_color: "#0f6a3a",
    lang: "fa",
    dir: "rtl",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
