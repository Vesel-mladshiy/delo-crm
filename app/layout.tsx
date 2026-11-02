import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://delo-mini-crm-portfolio.cheekyolm65.chatgpt.site"),
  title: "Дело CRM — клиенты, сделки, результат",
  description: "Простая CRM для небольших команд. Клиенты, воронка продаж, задачи и понятная аналитика в одном месте.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}
