import type { IconType } from "react-icons"
import { SiAstro } from "react-icons/si"
import { SiAngular } from "react-icons/si"
import { SiExpress } from "react-icons/si"
import { SiNestjs } from "react-icons/si"
import { SiNextdotjs } from "react-icons/si"
import { SiNodedotjs } from "react-icons/si"
import { SiNuxt } from "react-icons/si"
import { SiReact } from "react-icons/si"
import { SiRemix } from "react-icons/si"
import { SiSvelte } from "react-icons/si"
import { SiVite } from "react-icons/si"
import { SiVuedotjs } from "react-icons/si"

const FRAMEWORK_LABELS: Record<string, string> = {
  NEXTJS: "Next.js",
  VITE: "Vite",
  REACT: "React",
  VUE: "Vue",
  NUXT: "Nuxt",
  SVELTE: "Svelte",
  SVELTEKIT: "SvelteKit",
  ASTRO: "Astro",
  ANGULAR: "Angular",
  REMIX: "Remix",
  NESTJS: "NestJS",
  EXPRESS: "Express",
  UNKNOWN: "Node.js",
}

/** Human-readable framework name; falls back to Node.js for unknown values. */
export function formatFramework(framework?: string | null) {
  if (!framework) return "Node.js"
  return FRAMEWORK_LABELS[framework.toUpperCase()] ?? framework
}

type FrameworkIcon = { icon: IconType; color: string }

const DEFAULT_FRAMEWORK_ICON: FrameworkIcon = {
  icon: SiNodedotjs,
  color: "text-lime-500",
}

const FRAMEWORK_ICONS: Record<string, FrameworkIcon> = {
  NEXTJS: { icon: SiNextdotjs, color: "text-foreground" },
  VITE: { icon: SiVite, color: "text-violet-400" },
  REACT: { icon: SiReact, color: "text-cyan-400" },
  VUE: { icon: SiVuedotjs, color: "text-emerald-400" },
  NUXT: { icon: SiNuxt, color: "text-emerald-400" },
  SVELTE: { icon: SiSvelte, color: "text-orange-500" },
  SVELTEKIT: { icon: SiSvelte, color: "text-orange-500" },
  ASTRO: { icon: SiAstro, color: "text-fuchsia-500" },
  ANGULAR: { icon: SiAngular, color: "text-rose-500" },
  REMIX: { icon: SiRemix, color: "text-sky-400" },
  NESTJS: { icon: SiNestjs, color: "text-rose-500" },
  EXPRESS: { icon: SiExpress, color: "text-foreground" },
  UNKNOWN: DEFAULT_FRAMEWORK_ICON,
}

/**
 * Brand icon for a framework. Accepts the API's uppercase enum values
 * ("NEXTJS") or lowercase identifiers ("nextjs"); unknown/null falls back
 * to the Node.js icon.
 */
export function FrameworkLogo({
  framework,
  className = "size-4",
}: {
  framework?: string | null
  className?: string
}) {
  const { icon: Icon, color } =
    FRAMEWORK_ICONS[(framework ?? "UNKNOWN").toUpperCase()] ??
    DEFAULT_FRAMEWORK_ICON

  return (
    <span
      title={formatFramework(framework)}
      className={["flex shrink-0 items-center justify-center", color].join(" ")}
    >
      <Icon className={className} aria-hidden />
    </span>
  )
}
