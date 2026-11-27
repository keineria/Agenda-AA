import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Agenda tu cita · AA Solutions Services", template: "%s · AA Solutions Services" },
  description:
    "Agenda tu cita con AA Solutions Services: impuestos, ITIN, registraciones, compañías y más. Presencial en Linden, NJ o virtual.",
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/favicon.png` },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#8b7cf6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Poppins:wght@500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
