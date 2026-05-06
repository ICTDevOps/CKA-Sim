"use client";

import { useTranslations } from "next-intl";
import { forwardRef, useImperativeHandle, useRef } from "react";

interface PromptProps {
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
  onSubmit: () => void;
  prefix?: string;
}

export interface PromptHandle {
  focus: () => void;
  clear: () => void;
}

/**
 * Champ de saisie monospace stylisé en terminal.
 *
 * Pourquoi pas xterm.js au MVP : xterm.js est conçu pour émuler un PTY complet
 * (codes ANSI, scroll buffer, modes), ce dont nous n'avons pas besoin pour
 * "tape une commande, valide". Un input contrôlé est plus simple, plus
 * accessible, et nous garde la porte ouverte vers xterm.js plus tard si on
 * veut un vrai mode "lab" exécutant des commandes.
 */
export const Prompt = forwardRef<PromptHandle, PromptProps>(function Prompt(
  { value, disabled, onChange, onSubmit, prefix = "$" },
  ref
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations("session");
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => onChange("")
  }));

  return (
    <label className="flex w-full items-center gap-2 rounded-md border border-terminal-dim/50 bg-black/40 px-3 py-2 focus-within:border-terminal-accent">
      <span className="select-none text-terminal-accent" aria-hidden>
        {prefix}
      </span>
      <input
        ref={inputRef}
        type="text"
        autoFocus
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          }
        }}
        className="flex-1 bg-transparent text-terminal-fg outline-none placeholder:text-terminal-dim disabled:opacity-60"
        placeholder={t("promptPlaceholder")}
        aria-label={t("promptAriaLabel")}
      />
    </label>
  );
});
