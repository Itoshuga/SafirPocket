'use client';

import { PackageOpen } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
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

export function TransparentBoosterArtwork({
  imageUrl,
  name,
  className,
  priority = false,
}: {
  imageUrl: string | null;
  name: string;
  className?: string;
  priority?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = Boolean(imageUrl && failedUrl === imageUrl);

  return (
    <div
      data-testid="transparent-booster-artwork"
      data-image-state={!imageUrl ? 'missing' : failed ? 'error' : 'loaded'}
      className={cn('relative size-full bg-transparent', className)}
    >
      {imageUrl && !failed ? (
        <Image
          src={imageUrl}
          alt={`Booster ${name}`}
          fill
          sizes="(max-width: 1023px) 78vw, 34vw"
          className="object-contain"
          priority={priority}
          unoptimized
          draggable={false}
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : (
        <div
          role="img"
          aria-label={`${name}, visuel indisponible`}
          data-testid="booster-artwork-fallback"
          className="absolute inset-[12%] grid place-items-center rounded-md border border-border bg-surface-muted text-primary"
        >
          <PackageOpen className="size-10" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
