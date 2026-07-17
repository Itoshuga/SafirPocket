import type { ReactNode } from 'react';

export function PageHeading({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-[.22em] text-sapphire-300">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
        {children ? <div className="mt-2 max-w-2xl text-slate-400">{children}</div> : null}
      </div>
      {action}
    </div>
  );
}
