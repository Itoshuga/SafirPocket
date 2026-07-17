import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

const join = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(' ');

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function Button({ className, type = 'button', ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={join(
          'inline-flex min-h-11 items-center justify-center rounded-xl bg-sapphire-500 px-5 py-2.5 font-semibold text-white shadow-lg shadow-sapphire-900/20 transition hover:bg-sapphire-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sapphire-300 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={join(
          'min-h-11 w-full rounded-xl border border-white/10 bg-ink-800/70 px-4 text-white placeholder:text-slate-500 focus:border-sapphire-400 focus:outline-none focus:ring-2 focus:ring-sapphire-500/20',
          className,
        )}
        {...props}
      />
    );
  },
);

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={join('rounded-2xl border border-white/10 bg-ink-900/75 p-5 shadow-xl', className)}
      {...props}
    />
  );
}

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={join(
        'inline-flex rounded-full border border-sapphire-300/20 bg-sapphire-500/10 px-2.5 py-1 text-xs font-semibold text-sapphire-200',
        className,
      )}
      {...props}
    />
  );
}

export function Spinner({ label = 'Chargement' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2" role="status">
      <span className="size-5 animate-spin rounded-full border-2 border-current border-r-transparent" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="presentation">
      <section
        className="w-full max-w-lg rounded-2xl bg-ink-900 p-6"
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg p-2 hover:bg-white/10"
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card className="py-12 text-center">
      <h2 className="text-xl font-bold">{title}</h2>
      {children ? <div className="mt-2 text-slate-400">{children}</div> : null}
    </Card>
  );
}

export function ErrorState({ message = 'Une erreur est survenue.' }: { message?: string }) {
  return (
    <Card role="alert" className="border-red-400/30 bg-red-950/20 text-red-200">
      {message}
    </Card>
  );
}

export function PageContainer({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <main
      className={join('mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8', className)}
      {...props}
    />
  );
}
