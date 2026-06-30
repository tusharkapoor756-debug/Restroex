import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
}

export default function Button({
    variant = "primary",
    className = "",
    children,
    ...props
}: ButtonProps) {
    const variants = {
        primary:
            "bg-violet-600 hover:bg-violet-700 text-white",

        secondary:
            "bg-slate-100 hover:bg-slate-200 text-slate-900",

        outline:
            "border border-slate-300 bg-white hover:bg-slate-50 text-slate-900",

        ghost:
            "bg-transparent hover:bg-slate-100 text-slate-700",
    };

    return (
        <button
            className={`
        inline-flex
        items-center
        justify-center
        rounded-xl
        px-5
        py-2.5
        text-sm
        font-semibold
        transition-all
        duration-200
        ${variants[variant]}
        ${className}
      `}
            {...props}
        >
            {children}
        </button>
    );
}