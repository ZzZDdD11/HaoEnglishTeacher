import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Shared score -> visual-variant mapping used across score/word/sentence displays. */
export function scoreVariant(score: number): "accent" | "warning" | "danger" {
  if (score >= 80) return "accent";
  if (score >= 60) return "warning";
  return "danger";
}
