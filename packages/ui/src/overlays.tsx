import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ComponentProps, ReactNode } from 'react';
import { Button, IconButton } from './primitives.js';
import { cn } from './utils.js';

function DialogSurface({
  title,
  description,
  children,
  footer,
  drawer = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  drawer?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out motion-reduce:animate-none" />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 border border-border bg-surface shadow-dialog focus:outline-none',
          drawer
            ? 'inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-lg p-5 data-[state=open]:animate-in data-[state=closed]:animate-out sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-h-[85vh] sm:w-[min(34rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:p-6'
            : 'left-1/2 top-1/2 w-[min(32rem,calc(100vw-2rem))] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg p-6 data-[state=open]:animate-in data-[state=closed]:animate-out',
          'motion-reduce:animate-none',
        )}
      >
        <div className="pr-10">
          <DialogPrimitive.Title className="text-lg font-semibold text-foreground">
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
              {description}
            </DialogPrimitive.Description>
          ) : null}
        </div>
        <DialogPrimitive.Close asChild>
          <IconButton label="Fermer" variant="ghost" size="sm" className="absolute right-4 top-4">
            <span aria-hidden="true">×</span>
          </IconButton>
        </DialogPrimitive.Close>
        <div className="mt-5">{children}</div>
        {footer ? (
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function Dialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
      <DialogSurface title={title} description={description} footer={footer}>
        {children}
      </DialogSurface>
    </DialogPrimitive.Root>
  );
}

export function Drawer(props: Parameters<typeof Dialog>[0]) {
  const { open, onOpenChange, trigger, title, description, children, footer } = props;
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
      <DialogSurface title={title} description={description} footer={footer} drawer>
        {children}
      </DialogSurface>
    </DialogPrimitive.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger = false,
  loading = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <DialogPrimitive.Close asChild>
            <Button variant="ghost">{cancelLabel}</Button>
          </DialogPrimitive.Close>
          <Button
            variant={danger ? 'danger' : 'primary'}
            loading={loading}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        Cette action doit être explicitement confirmée.
      </p>
    </Dialog>
  );
}

const menuItemClass =
  'flex min-h-9 cursor-default select-none items-center gap-2 rounded-sm px-2.5 text-sm outline-none data-[highlighted]:bg-surface-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-45';
export const DropdownMenu = {
  Root: DropdownMenuPrimitive.Root,
  Trigger: DropdownMenuPrimitive.Trigger,
  Content: ({
    className,
    sideOffset = 6,
    ...props
  }: ComponentProps<typeof DropdownMenuPrimitive.Content>) => (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-44 rounded-md border border-border bg-surface p-1.5 shadow-dialog',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  ),
  Item: ({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Item>) => (
    <DropdownMenuPrimitive.Item className={cn(menuItemClass, className)} {...props} />
  ),
  Separator: ({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Separator>) => (
    <DropdownMenuPrimitive.Separator className={cn('my-1 h-px bg-border', className)} {...props} />
  ),
  Label: ({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Label>) => (
    <DropdownMenuPrimitive.Label
      className={cn('px-2.5 py-1.5 text-xs font-semibold text-muted-foreground', className)}
      {...props}
    />
  ),
};

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={350}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={6}
            className="z-50 max-w-64 rounded-sm bg-foreground px-2.5 py-1.5 text-xs text-background shadow-sm"
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-foreground" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

export function Popover({
  trigger,
  children,
  align = 'center',
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
}) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={6}
          className="z-50 w-72 rounded-md border border-border bg-surface p-4 shadow-dialog outline-none"
        >
          {children}
          <PopoverPrimitive.Arrow className="fill-surface" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export function Tabs({
  value,
  onValueChange,
  tabs,
  children,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  tabs: Array<{ value: string; label: string }>;
  children: ReactNode;
}) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange}>
      <TabsPrimitive.List
        className="flex max-w-full gap-1 overflow-x-auto border-b border-border"
        aria-label="Sections"
      >
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.value}
            value={tab.value}
            className="-mb-px min-h-10 border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus-ring data-[state=active]:border-primary data-[state=active]:text-primary"
          >
            {tab.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  );
}
Tabs.Content = function TabsContent({
  value,
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      value={value}
      className={cn(
        'pt-5 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        className,
      )}
      {...props}
    />
  );
};

export function Toast({
  tone = 'neutral',
  title,
  description,
  action,
}: {
  tone?: 'neutral' | 'success' | 'danger';
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'rounded-md border bg-surface p-4 shadow-dialog',
        tone === 'neutral' && 'border-border',
        tone === 'success' && 'border-success/30',
        tone === 'danger' && 'border-danger/30',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
    </div>
  );
}
