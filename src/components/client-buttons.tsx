"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Check, Copy, Moon, RefreshCw, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

export function RefreshButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      <RefreshCw className={pending ? "animate-spin" : undefined} />
      {pending ? "Searching… (about a minute)" : "Find new leads"}
    </Button>
  );
}

export function CopyButton({ text, label = "Copy message" }: { text: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : label}
    </Button>
  );
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button type="button" variant="ghost" size="icon" onClick={toggle} aria-label="Toggle dark mode">
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
