"use client";

import { Toaster as Sonner } from "sonner";

// Minimal wrapper hardcoded to dark theme (no next-themes dependency --
// this app is permanently dark, unlike shadcn's default sonner registry item).
export function Toaster(props: React.ComponentProps<typeof Sonner>) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-white/10 group-[.toaster]:shadow-lg group-[.toaster]:backdrop-blur-md",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}
