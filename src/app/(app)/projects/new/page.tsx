import type { Metadata } from "next";
import { Wizard } from "@/components/wizard";

export const metadata: Metadata = { title: "New project" };

export default function NewProject() {
  return (
    <div className="mx-auto max-w-2xl">
      <Wizard />
    </div>
  );
}
