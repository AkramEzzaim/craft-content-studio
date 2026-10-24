import { requireAuth } from "@/lib/auth";
import { Shell } from "@/components/shell";
export default async function StudioLayout({ children }: { children: React.ReactNode }) { await requireAuth(); return <Shell>{children}</Shell>; }
