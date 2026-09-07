import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorker } from "../components/service-worker";
import { InstallPrompt } from "../components/install-prompt";
export const metadata: Metadata = { title: "MatchUp | eFootball tournaments", description: "Create, discover, and compete in eFootball tournaments.", manifest: "/manifest.webmanifest", appleWebApp: { capable: true, title: "MatchUp", statusBarStyle: "black-translucent" }, icons: { icon: "/icon.svg", apple: "/icon.svg" } };
export const viewport: Viewport = { themeColor: "#0b2116", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}<ServiceWorker/><InstallPrompt/></body></html>; }
