import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Własna skala pisma (tailwind.config.ts → fontSize). Bez tego tailwind-merge uznałby np. `text-sub`
// za kolor i wyrzucał go przy `text-[var(--txt2)]` przekazanym w className.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["meta", "note", "ui", "sub", "body", "read", "item", "heading", "figure"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
