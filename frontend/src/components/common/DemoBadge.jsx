import React from 'react';
import { Sparkles, Info } from 'lucide-react';

export const DemoBadge = ({ text = "DEMO DATA PREVIEW", size = "sm" }) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 ${
        size === "xs" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"
      }`}
      title="This data is realistic sample data for frontend preview. Real database sync will be enabled in backend stages."
    >
      <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
      <span>{text}</span>
    </span>
  );
};

export const DemoNoticeBanner = ({ pageName }) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
      <div className="flex items-center gap-2">
        <Info className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          Showing simulated high-volume supermarket records for <strong className="text-white">{pageName}</strong>. All interactions update local frontend state.
        </span>
      </div>
      <DemoBadge text="STAGE 2 PREVIEW" size="xs" />
    </div>
  );
};
