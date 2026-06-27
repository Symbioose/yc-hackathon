import "./globals.css";
export const metadata = { title: "Sealed Agent — Acme Bank" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
