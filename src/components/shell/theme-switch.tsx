"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useMounted } from "@/lib/store"

export function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()
  const dark = mounted ? resolvedTheme === "dark" : true
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => setTheme(dark ? "light" : "dark")}
          aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
          className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
        >
          {dark ? <SunIcon className="size-4" strokeWidth={1.5} /> : <MoonIcon className="size-4" strokeWidth={1.5} />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{dark ? "Light theme" : "Dark theme"}</TooltipContent>
    </Tooltip>
  )
}
