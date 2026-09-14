"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type Locale = "en" | "hi" | "pa";

export interface LanguageToggleProps {
  currentLocale?: Locale;
  onLocaleChange?: (locale: Locale) => void;
  className?: string;
}

export function LanguageToggle({
  currentLocale = "en",
  onLocaleChange,
  className,
}: LanguageToggleProps) {
  const [selected, setSelected] = React.useState<Locale>(currentLocale);

  const handleSelect = (locale: Locale) => {
    setSelected(locale);
    if (onLocaleChange) {
      onLocaleChange(locale);
    }
  };

  const options: { locale: Locale; label: string }[] = [
    { locale: "en", label: "EN" },
    { locale: "hi", label: "हिं" },
    { locale: "pa", label: "ਪੰ" },
  ];

  return (
    <div
      role="group"
      aria-label="Language selection"
      className={cn(
        "inline-flex items-center rounded-full border border-[#DADCE0] bg-white p-0.5 text-[12px] font-medium select-none shadow-none",
        className
      )}
    >
      {options.map(({ locale, label }) => (
        <button
          key={locale}
          type="button"
          onClick={() => handleSelect(locale)}
          aria-pressed={selected === locale}
          className={cn(
            "rounded-full px-2.5 py-1 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0B3D91]",
            selected === locale
              ? "bg-[#0B3D91] text-white"
              : "text-[#5F6368] hover:text-[#202124] hover:bg-[#F8F9FA]"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
