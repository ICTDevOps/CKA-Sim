import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Drop-in replacements for next/link et next/navigation qui restent
// locale-aware automatiquement.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
