import type { Metadata, Viewport } from 'next';
// import "./editor.css"

export const metadata: Metadata = {
  title: "Reason - Research Manager",
  description:
    "A powerful research manager with nested documents, rich-text editing, and full-text search",
  authors: [{ name: "Reason" }],
  openGraph: {
    title: "Reason - Research Manager",
    description:
      "A powerful research manager with nested documents, rich-text editing, and full-text search",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@Reason",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const dynamic = 'force-dynamic';

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Root sidebar is bypassed via segments check, render editor full-screen
  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      {children}
    </div>
  );
}
