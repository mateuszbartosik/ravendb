import { clsx, type ClassValue } from "clsx";
import { toast } from "sonner";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function tryParseJson<T>(value: string): T | null {
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
}

/** Decides whether a shortcut hint reads "⌘K" or "Ctrl K". */
export const IS_MAC = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");

export async function copyToClipboard(value: string) {
    try {
        await navigator.clipboard.writeText(value);
        toast.success("Copied to clipboard");
    } catch {
        toast.error("Could not copy to clipboard");
    }
}
