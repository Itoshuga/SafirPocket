import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import * as SlotPrimitive from '@radix-ui/react-slot';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from './utils.js';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 motion-reduce:transition-none',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-hover/90',
        secondary: 'border border-border bg-surface-muted text-foreground hover:bg-surface-hover',
        outline: 'border border-border-strong bg-surface text-foreground hover:bg-surface-hover',
        ghost: 'bg-transparent text-foreground hover:bg-surface-hover',
        danger: 'bg-danger text-white hover:bg-danger/90',
      },
      size: {
        sm: 'h-8 rounded-sm px-3 text-xs',
        md: 'h-10 rounded-md px-4 text-sm',
        lg: 'h-11 rounded-md px-5 text-sm',
        icon: 'size-10 rounded-md p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingLabel?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    asChild = false,
    className,
    variant,
    size,
    loading = false,
    loadingLabel = 'Chargement…',
    disabled,
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  if (asChild) {
    return (
      <SlotPrimitive.Slot
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        aria-busy={loading || undefined}
        {...props}
      >
        {children}
      </SlotPrimitive.Slot>
    );
  }
  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      type={type}
      {...props}
    >
      {loading ? <Spinner className="size-4" label={loadingLabel} /> : null}
      {loading ? <span>{loadingLabel}</span> : children}
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonProps, 'size' | 'children'> {
  label: string;
  children: ReactNode;
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 'md', className, ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      size="icon"
      className={cn(size === 'sm' && 'size-8 rounded-sm', className)}
      aria-label={label}
      title={label}
      {...props}
    />
  );
});

const controlClass =
  'h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground shadow-control outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-focus-ring/25 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted-foreground motion-reduce:transition-none';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, 'aria-invalid': invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(controlClass, invalid && 'border-danger focus:border-danger', className)}
        aria-invalid={invalid}
        {...props}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, 'aria-invalid': invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        controlClass,
        'min-h-24 resize-y py-2.5',
        invalid && 'border-danger focus:border-danger',
        className,
      )}
      aria-invalid={invalid}
      {...props}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(controlClass, 'appearance-auto pr-8', className)} {...props}>
        {children}
      </select>
    );
  },
);

export interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { className, onClear, value, ...props },
  ref,
) {
  return (
    <div className="relative">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <Input
        ref={ref}
        type="search"
        value={value}
        className={cn('pl-9 pr-9', className)}
        {...props}
      />
      {onClear && value ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Effacer la recherche"
          className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          ×
        </button>
      ) : null}
    </div>
  );
});

export function Checkbox({
  id,
  checked,
  onCheckedChange,
  disabled,
  label,
  description,
}: {
  id: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <CheckboxPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange?.(value === true)}
        disabled={disabled}
        className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-sm border border-border-strong bg-surface text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-45 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-white"
      >
        <CheckboxPrimitive.Indicator aria-hidden="true">✓</CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <label htmlFor={id} className="min-w-0 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-muted-foreground">{description}</span>
        ) : null}
      </label>
    </div>
  );
}

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function RadioGroup({
  value,
  onValueChange,
  options,
  label,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  options: RadioOption[];
  label: string;
}) {
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      aria-label={label}
      className="grid gap-2"
    >
      {options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-surface-hover"
        >
          <RadioGroupPrimitive.Item
            value={option.value}
            disabled={option.disabled}
            className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-border-strong bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring data-[state=checked]:border-primary"
          >
            <RadioGroupPrimitive.Indicator className="size-2.5 rounded-full bg-primary" />
          </RadioGroupPrimitive.Item>
          <span className="text-sm">
            <span className="font-medium">{option.label}</span>
            {option.description ? (
              <span className="mt-0.5 block text-muted-foreground">{option.description}</span>
            ) : null}
          </span>
        </label>
      ))}
    </RadioGroupPrimitive.Root>
  );
}

export function Switch({
  id,
  checked,
  onCheckedChange,
  label,
  disabled,
}: {
  id: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label htmlFor={id} className="flex items-center justify-between gap-4 text-sm font-medium">
      {label}
      <SwitchPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="relative h-6 w-10 rounded-full bg-border-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring data-[state=checked]:bg-primary disabled:opacity-45"
      >
        <SwitchPrimitive.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[18px]" />
      </SwitchPrimitive.Root>
    </label>
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-border bg-surface p-5 shadow-card', className)}
      {...props}
    />
  );
}

export function Panel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn('rounded-lg border border-border bg-surface p-5 sm:p-6', className)}
      {...props}
    />
  );
}

const badgeVariants = cva(
  'inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-surface-muted text-muted-foreground',
        primary: 'border-primary/15 bg-primary-soft text-primary',
        success: 'border-success/20 bg-success/10 text-success',
        warning: 'border-warning/25 bg-warning/10 text-warning',
        danger: 'border-danger/20 bg-danger/10 text-danger',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function Tag({
  removable,
  onRemove,
  children,
  className,
}: {
  removable?: boolean;
  onRemove?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded-sm bg-primary-soft px-2.5 text-xs font-medium text-primary',
        className,
      )}
    >
      {children}
      {removable ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Retirer"
          className="ml-1 rounded-sm px-0.5 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

export function Avatar({
  src,
  alt,
  fallback,
  size = 'md',
  className,
}: {
  src?: string | null;
  alt: string;
  fallback: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-primary-soft font-semibold text-primary',
        size === 'sm' && 'size-8 text-xs',
        size === 'md' && 'size-10 text-sm',
        size === 'lg' && 'size-16 text-lg',
        className,
      )}
    >
      {src ? (
        <img src={src} alt={alt} className="size-full object-cover" />
      ) : (
        <span aria-label={alt}>{fallback.slice(0, 2).toUpperCase()}</span>
      )}
    </span>
  );
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none',
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

export function Spinner({
  label = 'Chargement',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span className="inline-flex items-center" role="status">
      <span
        className={cn(
          'size-5 animate-spin rounded-full border-2 border-primary/25 border-t-primary motion-reduce:animate-none',
          className,
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Progress({ value, label }: { value: number; label: string }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{Math.round(safeValue)} %</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safeValue}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}
