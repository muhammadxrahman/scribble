import type { Metadata } from "next";
import { AuthProvider } from "@/contexts/AuthContext";
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";
import "./prosemirror.css";

export const metadata: Metadata = {
  title: "Scribble - Collaborative Document Editor",
  description: "Real-time collaborative document editing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
