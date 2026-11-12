import { Plus } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "@/components/app/ui";

/** "WS3/Top Bar" (e7uRA1): the workspace-wide action. Each page's own primary button stays the only black one. */
export function TopBar() {
  return (
    <div className="hidden h-[52px] items-center justify-end gap-2 border-b border-lk-line px-6 lg:flex">
      <Link href="/docs" className={buttonClass("ghost", "sm")}>
        Docs
      </Link>
      <Link href="/app/leads/find" className={buttonClass("secondary", "sm")}>
        <Plus /> Find leads
      </Link>
    </div>
  );
}
