"use client"

import { useMounted } from "@/lib/store"
import { CommandMenu } from "./command-menu"
import { GlobalSheets } from "./global-sheets"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"

function ShellSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 pt-6 sm:px-6 lg:px-8" aria-hidden>
      <div className="flex flex-col gap-2">
        <div className="h-7 w-48 rounded-md bg-raised" />
        <div className="h-4 w-72 rounded-md bg-raised/60" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[132px] rounded-xl border border-border bg-card" />
        ))}
      </div>
      <div className="h-80 rounded-xl border border-border bg-card" />
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const mounted = useMounted()
  return (
    <div className="flex min-h-dvh w-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        {mounted ? (
          <>
            {children}
            <GlobalSheets />
            <CommandMenu />
          </>
        ) : (
          <ShellSkeleton />
        )}
      </div>
    </div>
  )
}
