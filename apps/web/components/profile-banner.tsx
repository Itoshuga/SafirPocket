import { Gem } from 'lucide-react';
import { cn } from '@safir/ui';
import { resolveBannerUrl } from '@/lib/banner-url';

export function ProfileBanner({
  bannerUrl,
  positionY,
  alt,
  className,
}: {
  bannerUrl: string | null;
  positionY: number;
  alt: string;
  className?: string;
}) {
  const source = resolveBannerUrl(bannerUrl);
  return (
    <div
      data-testid="profile-banner"
      role="img"
      aria-label={source ? alt : `${alt}, bannière par défaut`}
      className={cn(
        'relative aspect-[2.4/1] w-full overflow-hidden bg-primary-soft sm:aspect-[3.5/1]',
        className,
      )}
      style={
        source
          ? {
              backgroundImage: `url(${JSON.stringify(source)})`,
              backgroundPosition: `center ${Math.max(0, Math.min(100, positionY))}%`,
              backgroundSize: 'cover',
            }
          : undefined
      }
    >
      {!source ? (
        <div className="absolute inset-0 grid place-items-center text-primary/30">
          <Gem className="size-12 sm:size-16" aria-hidden="true" />
        </div>
      ) : null}
    </div>
  );
}
