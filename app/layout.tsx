import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "باشگاه مراقبین سلامت اول",
  description: "سامانه یکپارچه عضویت، جذب، آموزش، پایش و ارزیابی مراقبین سلامت اول",
  applicationName: "باشگاه مراقبین سلامت اول",
};

export const viewport: Viewport = {
  themeColor: "#0f6a3a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
