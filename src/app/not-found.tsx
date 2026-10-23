import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md text-center shadow-sm">
        <CardHeader className="p-6 pb-2">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FileQuestion className="h-6 w-6" aria-hidden="true" />
          </div>
          <CardTitle className="text-xl font-semibold tracking-tight">
            Page not found
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground mt-1">
            The page you are looking for does not exist.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-4">
          <Link href="/" className={buttonVariants()}>
            Back to home
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
