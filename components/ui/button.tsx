import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "accent" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface BaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}

type ButtonAsButton = BaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
  };

type ButtonAsLink = BaseProps & {
  href: string;
  target?: string;
  rel?: string;
};

export type ButtonProps = ButtonAsButton | ButtonAsLink;

const base =
  "inline-flex items-center justify-center gap-2 rounded-brand-md font-medium transition-colors " +
  "disabled:pointer-events-none disabled:opacity-50 select-none whitespace-nowrap";

const variants: Record<ButtonVariant, string> = {
  // Cream fill on black — the default action.
  primary: "bg-fg text-surface hover:bg-fg/90 shadow-brand-sm",
  // Hairline outline.
  secondary: "border border-line/20 text-fg hover:border-line/40 hover:bg-line/5",
  // Text only.
  ghost: "text-fg-muted hover:text-fg",
  // Sand accent — reserve for the single highest-intent action on a screen.
  accent: "bg-accent text-surface hover:bg-accent-hover shadow-brand-sm",
  // Rust.
  danger: "bg-accent-rust text-fg hover:bg-accent-rust/90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

export function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const { variant = "primary", size = "md", className, children, href, target, rel } = props;
    return (
      <Link
        href={href}
        target={target}
        rel={rel}
        className={cn(base, variants[variant], sizes[size], className)}
      >
        {children}
      </Link>
    );
  }

  const { variant = "primary", size = "md", className, children, href: _href, ...rest } = props;
  void _href;
  return (
    <button type="button" className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
    </button>
  );
}
