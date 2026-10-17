import Link from "next/link";
import { linkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-xl font-semibold">Project not found</h1>
      <p className="mt-2 text-sm text-muted">It may have been deleted, or it belongs to a different workspace.</p>
      <Link href="/dashboard" className={linkButton({ variant: "secondary" }) + " mt-6"}>
        Back to projects
      </Link>
    </div>
  );
}
