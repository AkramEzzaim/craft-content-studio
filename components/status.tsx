import type { Status } from "@/lib/types";
export function StatusBadge({ status }: { status: Status }) { return <span className={`status status-${status}`}><i/>{status === "generated" ? "AI draft" : status}</span>; }
export function Score({ value, label }: { value: number; label: string }) { return <div className="score"><div className="score-ring" style={{ "--score": `${value}%` } as React.CSSProperties}><strong>{value}</strong></div><span>{label}<small>out of 100</small></span></div>; }
