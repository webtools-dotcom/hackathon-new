import { FileSpreadsheet, ListChecks, ShieldCheck, Sparkles } from "lucide-react";
import { UploadPanel, type UploadPanelProps } from "./upload-panel";
import { PrivacyPreview } from "./privacy-preview";

const HOW_IT_WORKS = [
  {
    icon: FileSpreadsheet,
    title: "Drop a sales export",
    body: "Any CSV from your POS or billing app. It is parsed and profiled on this device.",
  },
  {
    icon: ShieldCheck,
    title: "Personal data is masked",
    body: "Names, phones and emails are detected and replaced before anything is sent.",
  },
  {
    icon: Sparkles,
    title: "Gemini plans, code computes",
    body: "Gemini picks allow-listed operations; a deterministic engine does the maths.",
  },
  {
    icon: ListChecks,
    title: "Actions are fact-checked",
    body: "Every number Gemini cites is checked against the computed results.",
  },
];

/** Landing state: headline, upload, live privacy preview and the four-step explainer. */
export function Hero({ onRun, onError }: Pick<UploadPanelProps, "onRun" | "onError">) {
  return (
    <div className="relative isolate">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-8 -z-10 h-[520px] bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:40px_40px] opacity-60 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]"
      />
      <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-10">
        <div className="space-y-8 lg:col-span-7 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              For restaurants, kirana stores and clinics
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground sm:text-6xl sm:leading-[1.05]">
              Ask your sales ledger <span className="text-primary">what changed.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Tijori plans the analysis with Gemini, does every calculation
              in your browser, and hands you three actions with the numbers
              behind them. Customer names and phone numbers never leave this
              page.
            </p>
          </div>

          <UploadPanel onRun={onRun} onError={onError} />
        </div>

        <div className="lg:col-span-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <PrivacyPreview />
        </div>
      </div>

      <ol className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {HOW_IT_WORKS.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="bg-background p-5">
            <div className="flex items-center gap-2 text-primary">
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
            </div>
            <p className="mt-3 text-sm font-medium">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
