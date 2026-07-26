import React from "react";
import { cn } from "../../lib/utils";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "brand";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  pulse?: boolean;
  size?: "sm" | "default" | "lg";
}

export function Badge({
  children,
  variant = "neutral",
  pulse = false,
  size = "default",
  className,
  ...props
}: BadgeProps) {
  const variantStyles: Record<BadgeVariant, string> = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/60",
    warning: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800/60",
    danger: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-400 dark:border-red-800/60",
    info: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-800/60",
    neutral: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    brand: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-400 dark:border-indigo-800/60",
  };

  const dotColors: Record<BadgeVariant, string> = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
    info: "bg-blue-500",
    neutral: "bg-slate-400",
    brand: "bg-indigo-500",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[11px] font-medium gap-1 rounded-md",
    default: "px-2.5 py-1 text-xs font-semibold gap-1.5 rounded-lg",
    lg: "px-3.5 py-1.5 text-sm font-bold gap-2 rounded-xl",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center border font-sans tracking-tight transition-colors",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", dotColors[variant])} />
          <span className={cn("relative inline-flex rounded-full h-2 w-2", dotColors[variant])} />
        </span>
      )}
      {children}
    </span>
  );
}

export default Badge;
