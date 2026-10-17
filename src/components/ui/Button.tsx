import type { ButtonHTMLAttributes } from "react";

/** Shared button styling; forwards native attributes and permits local layout classes. */
export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
    return <button type="button" {...props} className={`min-h-11 border border-room-track-free bg-room-button px-4 py-2 font-pixel text-2xl text-room-tooltip-bg hover:bg-room-button-hover ${className}`} />;
}
