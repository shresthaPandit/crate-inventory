import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Providers } from "@/components/providers"
import { AppShell } from "@/components/shell/app-shell"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

// Screens render in the browser from locally stored sample data, so there is
// no server-rendered segment for instant-navigation validation to check.
export const instant = false

export const metadata: Metadata = {
  title: {
    default: "Crate · Deccan Electric Supply",
    template: "%s · Crate",
  },
  description: "Stock, sales and purchasing for Deccan Electric Supply's three godowns",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
