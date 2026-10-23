import { Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ErrorStateProps {
  message: string | null;
  onRetrySample: () => void;
  onReset: () => void;
}

/** Friendly failure card with the two ways forward. */
export function ErrorState({ message, onRetrySample, onReset }: ErrorStateProps) {
  return (
    <Card className="p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-3">
        <TriangleAlert className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold">Analysis failed</h2>
      <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
        {message}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={onRetrySample}>
          <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
          Try sample data
        </Button>
        <Button variant="outline" onClick={onReset}>
          Choose another file
        </Button>
      </div>
    </Card>
  );
}
