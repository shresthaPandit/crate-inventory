"use client"

import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false} disableTransitionOnChange>
      <TooltipProvider delayDuration={300}>
        {children}
        <Toaster position="top-center" closeButton duration={5000} />
      </TooltipProvider>
    </ThemeProvider>
  )
}
