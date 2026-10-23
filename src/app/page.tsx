import { SiteHeader } from "@/components/site-header";
import { AnalystApp } from "@/components/analyst/analyst-app";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <AnalystApp />
      </main>
      <footer className="border-t px-4 py-6 text-center text-xs text-muted-foreground text-balance">
        Built for Prompt War 2026 · Gemini via Google AI Studio · Your data stays in your browser
      </footer>
    </div>
  );
}
