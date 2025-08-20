import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Suuupra - EdTech Super-Platform",
  description: "Transform education with our comprehensive EdTech platform powered by AI, microservices, and cutting-edge technology.",
  keywords: "education, edtech, learning, AI, microservices, platform",
  authors: [{ name: "Suuupra Team" }],
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white min-h-screen`}
      >
        <AuthProvider>
          {children}
          <Toaster 
            theme="dark"
            position="top-right"
            richColors
            closeButton
          />
        </AuthProvider>
      </body>
    </html>
  );
}
