import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer touch-manipulation",
  {
    variants: {
      variant: {
        primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/20 dark:bg-brand-600 dark:hover:bg-brand-500",
        secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
        outline: "border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900",
        ghost: "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100 text-slate-600 dark:text-slate-400",
        danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-600/20 dark:bg-red-600 dark:hover:bg-red-500",
        success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 dark:bg-emerald-600 dark:hover:bg-emerald-500",
        warning: "bg-amber-600 text-white hover:bg-amber-700 shadow-sm shadow-amber-600/20 dark:bg-amber-600 dark:hover:bg-amber-500",
      },
      size: {
        sm: "h-9 px-3 text-xs rounded-lg",
        default: "h-11 px-5 py-2 text-sm rounded-xl",
        lg: "h-13 px-7 text-base rounded-2xl font-bold",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span>{children}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
export default Button;