# 04 — UI Components (shadcn/ui + forms)

**Phase:** 1 · **Depends on:** nothing · **P0**

Replaces DaisyUI + partial Radix with **shadcn/ui** — the 2026 default: copy-in Radix-based components that you own and can modify. Adds `react-hook-form` + Zod resolvers so forms share schemas with API routes.

## Goal

- shadcn/ui installed with a baseline component set.
- Tailwind theme tokens for light/dark.
- `react-hook-form` + `@hookform/resolvers` wired with Zod.
- All marketing components (Hero, Pricing, FAQ) rewritten with shadcn primitives.
- DaisyUI fully removed.

## Stack

- **[shadcn/ui](https://ui.shadcn.com)** — component source, not a library. Installed via CLI, lives in `components/ui/`.
- **`tailwindcss-animate`** — already present.
- **`react-hook-form`** + **`@hookform/resolvers`** + **`zod`** — form stack.
- **`sonner`** — toasts (modern replacement for react-hot-toast; shadcn integrates it).
- **`next-themes`** — dark mode.

## Steps

### 1. Install shadcn

```bash
pnpm dlx shadcn@latest init
```

Answer prompts:
- Style: **Default** (or **New York** if preferred).
- Base color: **Slate** or **Zinc**.
- CSS variables: **Yes**.
- `tailwind.config.ts`: **Yes**.
- Components alias: `@/components`.
- Utils alias: `@/lib/utils`.
- React Server Components: **Yes**.

This generates / updates:
- `components.json` (already exists — overwrite)
- `tailwind.config.ts` with shadcn tokens
- `app/globals.css` with CSS variables
- `lib/utils.ts` (`cn()` helper — merge with existing)

### 2. Install baseline components

```bash
pnpm dlx shadcn@latest add button input label textarea form \
  dialog dropdown-menu popover sheet tabs card badge \
  select checkbox radio-group switch slider \
  table tooltip separator skeleton avatar \
  alert alert-dialog sonner accordion \
  command navigation-menu scroll-area
```

That covers ~95% of SaaS UI needs. Add more (`calendar`, `date-picker`, `data-table`) as projects require them.

### 3. Add form deps

```bash
pnpm add react-hook-form @hookform/resolvers
```

`sonner` and `next-themes` are added via their respective shadcn components; verify they're installed.

### 4. Dark mode

Create `components/theme-provider.tsx`:

```tsx
"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

Wire it in `components/providers.tsx`:

```tsx
// components/providers.tsx
"use client";
import { ThemeProvider } from "./theme-provider";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  );
}
```

Use `<Providers>` in `app/layout.tsx` (already wired in doc 03 step 4).

Add a theme toggle:

```tsx
// components/theme-toggle.tsx
"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-5 w-5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-5 w-5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### 5. Form pattern (reference)

Every form should follow this shape. One Zod schema shared between the form and the API route.

```tsx
// components/forms/create-project-form.tsx
"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createProjectSchema, type CreateProjectInput } from "@/lib/validation/schemas";

export function CreateProjectForm() {
  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: "", description: "", budget: 0, timeline: "" },
  });

  async function onSubmit(values: CreateProjectInput) {
    const res = await fetch("/api/v1/project", { method: "POST", body: JSON.stringify(values) });
    if (!res.ok) { toast.error("Failed to create project"); return; }
    toast.success("Project created");
    form.reset();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl><Textarea {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" disabled={form.formState.isSubmitting}>Create</Button>
      </form>
    </Form>
  );
}
```

### 6. Rewrite marketing components

Port each of these (from the old `components/`) to use shadcn primitives:

| Old | New |
|-----|-----|
| `Hero.tsx` | `components/marketing/hero.tsx` — use `<Button>` |
| `Pricing.tsx` | `components/marketing/pricing.tsx` — use `<Card>`, `<Badge>` |
| `FAQ.tsx` | `components/marketing/faq.tsx` — use `<Accordion>` |
| `CTA.tsx` | `components/marketing/cta.tsx` |
| `Testimonials*.tsx` | `components/marketing/testimonials.tsx` (consolidate) |
| `FeaturesAccordion.tsx` | `components/marketing/features.tsx` — use `<Accordion>` |
| `ButtonSignin.tsx`, `ButtonAccount.tsx` | Delete — use Clerk's `<SignInButton>` / `<UserButton>` |
| `Modal.tsx` | Delete — use `<Dialog>` |
| `Notification.tsx`, `hooks/use-toast.js` | Delete — use `sonner`'s `toast()` |

Delete the originals after porting.

### 7. Remove DaisyUI

```bash
pnpm remove daisyui @headlessui/react react-hot-toast
```

Edit `tailwind.config.ts`:
- Remove `require("daisyui")` from `plugins`.
- Remove the `daisyui: { themes: [...] }` block.
- Keep `tailwindcss-animate`.

Grep for any DaisyUI class names and replace:

```bash
rg "btn-|card-|navbar|drawer|modal-" app/ components/
```

Common replacements:

| DaisyUI | shadcn/Tailwind |
|---------|-----------------|
| `btn btn-primary` | `<Button>` or `className="..."` via `buttonVariants()` |
| `card card-body` | `<Card><CardContent>` |
| `modal` | `<Dialog>` |
| `alert alert-info` | `<Alert>` |
| `navbar` | `<NavigationMenu>` or plain Tailwind |

### 8. Update `tailwind.config.ts`

After shadcn init, the config should look roughly like:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx,mdx}", "./components/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        // … rest from shadcn init
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

## Verification checklist

- [ ] `pnpm dev` renders with shadcn styles.
- [ ] `<Button>`, `<Input>`, `<Form>` work on a test page.
- [ ] Theme toggle flips between light/dark with no flash.
- [ ] `pnpm remove daisyui` ran successfully; `rg "daisyui"` returns zero.
- [ ] `rg "btn-|card-body|modal-(?:box|action)"` returns zero.
- [ ] `rg "react-hot-toast"` returns zero (replaced by sonner).
- [ ] A form submits with Zod validation errors rendering inline.

## Gotchas

- **shadcn init overwrites `components.json` and `app/globals.css`.** Back them up or diff-review before committing.
- **The CLI writes to `components/ui/`.** Don't hand-edit those files unless you intend to maintain the drift. Re-running `shadcn add` or `shadcn diff` keeps them fresh.
- **`sonner` vs shadcn's `toast` component.** Prefer `sonner` — shadcn dropped its original toast in favor of it.
- **Keep form schemas in `lib/validation/schemas.ts`** so API route handlers and forms import the same Zod object.
