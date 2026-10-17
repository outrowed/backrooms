import type { SelectHTMLAttributes } from "react";

/** Shared select styling; forwards native attributes and permits local layout classes. */
export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
    return <select {...props} className={`min-h-11 w-full border border-room-border-subtle bg-room-card px-3 py-2 text-lg text-room-glow ${className}`} />;
}
