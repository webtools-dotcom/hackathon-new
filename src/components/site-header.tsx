import { Vault } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader({ name = "Tijori" }: { name?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2 font-semibold">
          <Vault className="h-5 w-5 text-primary" aria-hidden="true" />
          <span>{name}</span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
