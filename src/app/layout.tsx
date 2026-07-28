import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Navbar from "@/components/Navbar";
import { LocaleProvider } from "@/components/LocaleProvider";
import BannedGate from "@/components/BannedGate";
import PresenceHeartbeat from "@/components/PresenceHeartbeat";

export const metadata: Metadata = {
  title: "Qwin Devs — Where Developers Build. Share. Connect. Grow.",
  description:
    "Qwin Devs is a developer community to publish projects, share posts, and support creators with Qwin Currency."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-qwin-primary focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to main content
        </a>
        <Providers>
          <LocaleProvider>
            <BannedGate>
              <PresenceHeartbeat />
              <Navbar />
              <main id="main-content" className="mx-auto max-w-6xl px-4 py-6">
                {children}
              </main>
            </BannedGate>
          </LocaleProvider>
        </Providers>
      </body>
    </html>
  );
}
