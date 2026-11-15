import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const StatCard = ({
  title,
  value,
  subtitle,
  trend,
  trendDirection = "up", // 'up' | 'down' | 'neutral'
  icon: Icon,
  colorScheme = "emerald", // 'emerald' | 'blue' | 'amber' | 'rose' | 'purple'
  badge,
}) => {
  const colorMap = {
    emerald: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/20",
      glow: "hover:border-emerald-500/40",
    },
    blue: {
      bg: "bg-blue-500/10",
      text: "text-blue-400",
      border: "border-blue-500/20",
      glow: "hover:border-blue-500/40",
    },
    amber: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "border-amber-500/20",
      glow: "hover:border-amber-500/40",
    },
    rose: {
      bg: "bg-rose-500/10",
      text: "text-rose-400",
      border: "border-rose-500/20",
      glow: "hover:border-rose-500/40",
    },
    purple: {
      bg: "bg-purple-500/10",
      text: "text-purple-400",
      border: "border-purple-500/20",
      glow: "hover:border-purple-500/40",
    },
  };

  const scheme = colorMap[colorScheme] || colorMap.emerald;

  return (
    <div className={`glass-card p-5 transition-all duration-200 ${scheme.glow}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
          <div className="flex items-baseline gap-2 mt-1.5">
            <h3 className="text-2xl font-bold text-white tracking-tight">{value}</h3>
            {badge && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {badge}
              </span>
            )}
          </div>
        </div>

        {Icon && (
          <div className={`p-2.5 rounded-xl ${scheme.bg} ${scheme.text} border ${scheme.border}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {(subtitle || trend) && (
        <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
          {trend && (
            <div className="flex items-center gap-1 font-medium">
              {trendDirection === "up" && <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
              {trendDirection === "down" && <TrendingDown className="w-3.5 h-3.5 text-rose-400" />}
              {trendDirection === "neutral" && <Minus className="w-3.5 h-3.5 text-slate-400" />}
              <span
                className={
                  trendDirection === "up"
                    ? "text-emerald-400"
                    : trendDirection === "down"
                    ? "text-rose-400"
                    : "text-slate-400"
                }
              >
                {trend}
              </span>
            </div>
          )}
          {subtitle && <span className="text-slate-400 truncate ml-auto">{subtitle}</span>}
        </div>
      )}
    </div>
  );
};
