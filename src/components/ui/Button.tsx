import type { ButtonHTMLAttributes } from "react";

/** Shared button styling; forwards native attributes and permits local layout classes. */
export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
    return <button type="button" {...props} className={`min-h-11 border border-[#b9c993] bg-[#a8ba7e] px-4 py-2 font-pixel text-2xl text-[#172719] hover:bg-[#c9d49b] ${className}`} />;
}
