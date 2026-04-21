import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    QUEUED: "bg-violet-500/20 text-violet-400 border-violet-500/30",
    RUNNING: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    SUCCESS: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    PARTIALLY_FAILED: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    FAILED: "bg-red-500/20 text-red-400 border-red-500/30",
    TIMED_OUT: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    RETRYING: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    CANCELLED: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  }
  return colors[status] || "bg-slate-500/20 text-slate-400 border-slate-500/30"
}

export function getWorkerStatusColor(status: string): string {
  const colors: Record<string, string> = {
    HEALTHY: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    BUSY: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    STALE: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    DEAD: "bg-red-500/20 text-red-400 border-red-500/30",
  }
  return colors[status] || "bg-slate-500/20 text-slate-400 border-slate-500/30"
}