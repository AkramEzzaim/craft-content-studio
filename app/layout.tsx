import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Crochet Content Studio", description: "Private editorial workspace", robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en" data-scroll-behavior="smooth"><body>{children}</body></html>; }
