import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./brand-theme.css";
import "./gold-theme.css";
import { ServiceWorker } from "../components/service-worker";
import { InstallPrompt } from "../components/install-prompt";
import { AuthNotice } from "../components/auth/auth-notice";

export const metadata: Metadata = { title: "MatchUp | Football competition platform", description: "Create, discover, and compete in real football tournaments.", manifest: "/manifest.webmanifest", appleWebApp: { capable: true, title: "MatchUp", statusBarStyle: "black-translucent" }, icons: { icon: "/icon.svg", apple: "/icon.svg" } };
export const viewport: Viewport = { themeColor: "#d79a32", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}<AuthNotice/><ServiceWorker/><InstallPrompt/></body></html>; }
