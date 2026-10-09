import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] w-full animate-in fade-in-50 duration-200">
      <div className="flex flex-col items-center gap-3 p-8 rounded-2xl bg-white/70 border border-slate-100 shadow-sm backdrop-blur-sm">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          Loading Page...
        </p>
      </div>
    </div>
  );
}
