import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "影子跟读 — 英语发音练习",
  description: "基于影子跟读方法的英语发音学习系统",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
