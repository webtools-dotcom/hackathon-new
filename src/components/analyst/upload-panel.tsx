"use client";

import * as React from "react";
import { Upload, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SAMPLE_CSV, SAMPLE_FILE_NAME } from "@/lib/sample-data";

interface UploadPanelProps {
  onRun: (input: {
    csvText: string;
    fileName: string;
    question?: string;
    demo: boolean;
  }) => void;
  onError: (code: string) => void;
  disabled?: boolean;
}

export function UploadPanel({ onRun, onError, disabled }: UploadPanelProps) {
  const [question, setQuestion] = React.useState("");
  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      onError("empty_file");
      return;
    }
    if (file.size > 5_000_000) {
      onError("file_too_large");
      return;
    }
    try {
      const text = await file.text();
      onRun({
        csvText: text,
        fileName: file.name,
        question: question.trim() || undefined,
        demo: false,
      });
    } catch {
      onError("empty_file");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) {
      void processFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="question-input"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          What do you want to know? (optional)
        </label>
        <Input
          id="question-input"
          placeholder="Why did sales dip in August?"
          maxLength={200}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={disabled}
        />
      </div>

      <div>
        <label
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`group flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/50"
          } ${disabled ? "pointer-events-none opacity-50" : ""}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            disabled={disabled}
            onChange={handleFileChange}
            aria-label="Upload sales CSV file"
          />
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:text-primary">
            <Upload className="h-5 w-5" aria-hidden="true" />
          </div>
          <span className="text-sm font-medium">
            Drop your sales CSV here, or{" "}
            <span className="text-primary underline underline-offset-4">browse</span>
          </span>
          <span className="mt-1 text-xs text-muted-foreground">
            CSV up to 5 MB. Processed in your browser.
          </span>
        </label>
      </div>

      <div className="flex flex-col items-start gap-1 pt-2 sm:flex-row sm:items-center sm:gap-3">
        <Button
          type="button"
          onClick={() =>
            onRun({
              csvText: SAMPLE_CSV,
              fileName: SAMPLE_FILE_NAME,
              question: question.trim() || undefined,
              demo: true,
            })
          }
          disabled={disabled}
          className="w-full sm:w-auto"
        >
          <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
          Try sample data
        </Button>
        <span className="text-xs text-muted-foreground">
          Spice Route Kitchen · 3 Pune outlets · Jul to Oct 2026
        </span>
      </div>
    </div>
  );
}
