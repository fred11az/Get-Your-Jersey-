import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';

type Variant = 'primary' | 'accent' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark hover:shadow-lg disabled:hover:bg-brand',
  accent: 'bg-accent text-white hover:bg-accent-dark hover:shadow-lg disabled:hover:bg-accent',
  ghost: 'bg-white text-ink border border-hairline hover:border-brand hover:text-brand',
  danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
};

const SIZES: Record<Size, string> = {
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3.5 text-base',
};

function classes(variant: Variant, size: Size, full?: boolean): string {
  return [
    'inline-flex items-center justify-center gap-2 rounded-[8px] font-semibold',
    'transition-all duration-150',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
    VARIANTS[variant],
    SIZES[size],
    full ? 'w-full' : '',
  ].join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  full,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button className={`${classes(variant, size, full)} ${className}`} {...rest}>
      {children}
    </button>
  );
}

interface ButtonLinkProps {
  href: string;
  variant?: Variant;
  size?: Size;
  full?: boolean;
  className?: string;
  children: ReactNode;
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  full,
  className = '',
  children,
}: ButtonLinkProps) {
  return (
    <Link href={href} className={`${classes(variant, size, full)} ${className}`}>
      {children}
    </Link>
  );
}
