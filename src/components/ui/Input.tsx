import type { InputHTMLAttributes } from "react";

/** Shared input styling; forwards native attributes and permits local layout classes. */
export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
    return <input {...props} className={`min-h-11 w-full border border-room-border-subtle bg-room-card px-3 py-2 text-lg text-room-glow ${className}`} />;
}
