import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./brand-theme.css";
import "./ui-interaction.css";
import "./chat-ui.css";
import { ServiceWorker } from "../components/service-worker";
import { InstallPrompt } from "../components/install-prompt";
import { AuthNotice } from "../components/auth/auth-notice";
import { RequestOverlays } from "../components/requests/request-overlays";
import { RealtimeMatchOverlay } from "../components/realtime-match-overlay";
import { PresenceProvider } from "../components/presence-provider";
import { ChatVisualEnhancer } from "../components/chat/chat-visual-enhancer";
import { ChatMetadataEnhancer } from "../components/chat/chat-metadata-enhancer";
import { PrivateHeaderEnhancer } from "../components/chat/private-header-enhancer";
import { MessageFriendsCardEnhancer } from "../components/chat/message-friends-card-enhancer";
import { ThemeProvider } from "../components/theme-provider";

export const metadata: Metadata = {
  title: "MatchUp | Football competition platform",
  description: "Create, discover, and compete in real football tournaments.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "MatchUp", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#167bd1",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><ThemeProvider>{children}<PresenceProvider/><AuthNotice/><RequestOverlays/><RealtimeMatchOverlay/><ChatVisualEnhancer/><ChatMetadataEnhancer/><PrivateHeaderEnhancer/><MessageFriendsCardEnhancer/><ServiceWorker/><InstallPrompt/></ThemeProvider></body></html>;
}
