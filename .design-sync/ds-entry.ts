/**
 * design-sync bundle entry — Drosia is a Next.js app with no package build,
 * so this barrel IS the design-system surface: the reusable UI + brand layer
 * (user-scoped 2026-07-15), plus LocaleProvider (preview/provider wrapper,
 * excluded from cards via componentSrcMap null). Screens/maps/admin are
 * app-context-bound and deliberately not exported.
 */
export { Button, ButtonLink } from "../components/ui/Button";
export { AppBar } from "../components/ui/AppBar";
export { BottomNav } from "../components/ui/BottomNav";
export { CategoryIcon } from "../components/ui/CategoryIcon";
export { LangSwitch } from "../components/ui/LangSwitch";
export { PhotoPlaceholder } from "../components/ui/Photo";
export { SeverityPill, SeverityCounter } from "../components/ui/Severity";
export { StatusTimeline } from "../components/ui/StatusTimeline";
export { ThemeToggle } from "../components/ui/ThemeToggle";
export { VoteBar } from "../components/ui/VoteBar";
export { DrosiaMark, DrosiaWordmark } from "../components/brand/Logo";
export { LocaleProvider, useLocale } from "../components/LocaleProvider";
