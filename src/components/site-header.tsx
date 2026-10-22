import { Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

// TODO: rename to your project name on the day
export function SiteHeader({ name = "ProjectName" }: { name?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-5 w-5 text-primary" />
          {name}
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
