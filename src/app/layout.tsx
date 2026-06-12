import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Truqpedia",
  description:
    "IA profissional para autopecas, caminhoes, onibus e mecanica diesel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700,900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
