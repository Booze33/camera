import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CV Gen",
  description: "Fix your CV",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#fff]">
        {children}
      </body>
    </html>
  );
}
