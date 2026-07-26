import React from "react";
import { cn } from "../../lib/utils";
import Button from "./Button";
import { PackageOpen, AlertCircle, RefreshCw } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon = <PackageOpen className="h-10 w-10 text-slate-400 dark:text-slate-500" />,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-8 text-center sm:p-12",
        className
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/60 dark:border-slate-700/60 mb-4">
        {icon}
      </div>
      <h3 className="font-heading text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400 font-normal leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <div className="mt-6">
          <Button onClick={onAction} variant="primary">
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message = "An error occurred while loading data. Please try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 p-8 text-center sm:p-10",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 mb-3">
        <AlertCircle className="h-7 w-7" />
      </div>
      <h3 className="font-heading text-base font-bold text-red-950 dark:text-red-200">{title}</h3>
      <p className="mt-1 max-w-xs text-xs text-red-800/80 dark:text-red-300/80">{message}</p>
      {onRetry && (
        <div className="mt-5">
          <Button onClick={onRetry} variant="danger" size="sm" className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </Button>
        </div>
      )}
    </div>
  );
}
