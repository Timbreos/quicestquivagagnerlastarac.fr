import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NoZoom } from "@/components/shell/NoZoom";

export const metadata: Metadata = {
  title: "Qui c'est qui va gagner la Starac",
  description: "Ligue privée de pronostics sur le classement final des élèves de la Star Academy.",
  applicationName: "Qui c'est qui va gagner la Starac",
  robots: { index: false, follow: false },
};

// Pas de zoom : l'app se tient au doigt, comme une app native. Les tailles de
// texte et les cibles de 44 px sont calibrées pour ne pas en avoir besoin.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#3A1F8C",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,400;0,600;0,700;0,800;1,700;1,800&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-dvh">
        <NoZoom />
        {children}
      </body>
    </html>
  );
}
