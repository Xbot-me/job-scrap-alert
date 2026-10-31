"use client";

import { usePathname, useRouter } from "next/navigation";

type Option = { value: string; label: string };

// URL-driven filters: every change is a navigation, so views are linkable and
// the server does the filtering.
export function Filters({
  params,
  countries,
}: {
  params: Record<string, string | undefined>;
  countries: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(next.size ? `${pathname}?${next}` : pathname);
  };

  const select = (key: string, label: string, options: Option[]) => (
    <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <span className="sr-only">{label}</span>
      <select
        value={params[key] ?? ""}
        onChange={(e) => set(key, e.target.value)}
        className="h-8 max-w-[11rem] rounded-md border border-border bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex flex-wrap items-center gap-2 py-3">
      {select("country", "Country", [{ value: "", label: "Any country" }, ...countries])}
      {select("mode", "Work mode", [
        { value: "", label: "Remote or on-site" },
        { value: "remote", label: "Remote only" },
        { value: "onsite", label: "On-site & hybrid" },
      ])}
      {select("type", "Type", [
        { value: "", label: "Any type" },
        { value: "gig", label: "Freelance & contract" },
        { value: "fulltime", label: "Full-time" },
      ])}
      <label className="ml-1 flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={params.email === "1"}
          onChange={(e) => set("email", e.target.checked ? "1" : "")}
          className="h-4 w-4 accent-[hsl(var(--primary))]"
        />
        Has email
      </label>
      <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={params.visa === "1"}
          onChange={(e) => set("visa", e.target.checked ? "1" : "")}
          className="h-4 w-4 accent-[hsl(var(--primary))]"
        />
        Visa / relocation
      </label>
    </div>
  );
}
