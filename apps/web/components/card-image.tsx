'use client';

import { ImageOff } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@safir/ui';

export function CardImage({
  artworkPath,
  alt,
  priority = false,
  className,
}: {
  artworkPath: string | null;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = artworkPath
    ? artworkPath.startsWith('http://') || artworkPath.startsWith('https://')
      ? artworkPath
      : `/artwork/card/${artworkPath.split('/').map(encodeURIComponent).join('/')}`
    : null;
  return (
    <div
      className={cn(
        'relative aspect-[5/7] overflow-hidden rounded-md border border-border bg-surface-muted',
        className,
      )}
    >
      {src && !failed ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 220px"
          className="object-cover"
          priority={priority}
          unoptimized={src.startsWith('/artwork/')}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground">
          <span className="flex flex-col items-center gap-2 text-xs">
            <ImageOff className="size-7" aria-hidden="true" />
            Visuel indisponible
          </span>
        </div>
      )}
    </div>
  );
}
