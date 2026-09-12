import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./brand-theme.css";
import "./ui-interaction.css";
import { ServiceWorker } from "../components/service-worker";
import { InstallPrompt } from "../components/install-prompt";
import { AuthNotice } from "../components/auth/auth-notice";
import { RequestOverlays } from "../components/requests/request-overlays";
import { PresenceProvider } from "../components/presence-provider";
export const metadata: Metadata = { title: "MatchUp | Football competition platform", description: "Create, discover, and compete in real football tournaments.", manifest: "/manifest.webmanifest", appleWebApp: { capable: true, title: "MatchUp", statusBarStyle: "black-translucent" }, icons: { icon: "/icon.svg", apple: "/icon.svg" } };
export const viewport: Viewport = { themeColor: "#167bd1", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}<PresenceProvider/><AuthNotice/><RequestOverlays/><ServiceWorker/><InstallPrompt/></body></html>; }
