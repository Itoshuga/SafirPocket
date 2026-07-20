import { PackageOpen } from 'lucide-react';
import { cn } from '@safir/ui';

export function BoosterArtwork({
  imageUrl,
  name,
  className,
}: {
  imageUrl: string | null;
  name: string;
  className?: string;
}) {
  if (imageUrl) {
    return (
      <div
        role="img"
        aria-label={name}
        className={cn('bg-surface-muted bg-contain bg-center bg-no-repeat', className)}
        style={{ backgroundImage: `url(${JSON.stringify(imageUrl).slice(1, -1)})` }}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={`${name}, visuel indisponible`}
      className={cn('grid place-items-center bg-surface-muted text-primary', className)}
    >
      <PackageOpen className="size-10" aria-hidden="true" />
    </div>
  );
}
