import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CKA-Sim",
  description:
    "Simulateur de dextérité kubectl/shell/vi pour préparer la certification CKA."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
