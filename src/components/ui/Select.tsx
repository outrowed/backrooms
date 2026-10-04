import type { SelectHTMLAttributes } from "react";

/** Shared select styling; forwards native attributes and permits local layout classes. */
export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
    return <select {...props} className={`min-h-11 w-full border border-[#9baa7f] bg-[#10271d] px-3 py-2 text-lg text-[#fff5bb] ${className}`} />;
}
