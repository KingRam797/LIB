import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "SpendWHERE",
  description: "Your eggs deserve more baskets.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#0b1410",
          color: "#e8f5ee",
          minHeight: "100vh",
        }}
      >
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1rem" }}>
          <header style={{ marginBottom: "2rem" }}>
            <a href="/" style={{ color: "#3ecf8e", textDecoration: "none", fontWeight: 700, fontSize: "1.4rem" }}>
              Spend<span style={{ color: "#e8f5ee" }}>W</span>HERE
            </a>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
