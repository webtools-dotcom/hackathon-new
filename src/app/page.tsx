import { SiteHeader } from "@/components/site-header";
import { AnalystApp } from "@/components/analyst/analyst-app";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <AnalystApp />
      </main>
      <footer className="border-t px-4 py-6 text-center text-xs text-muted-foreground text-balance">
        Built for Prompt War 2026 · Gemini via Google AI Studio · Your data stays in your browser
      </footer>
    </div>
  );
}
