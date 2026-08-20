import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function UserAvatar({
  name,
  image,
  size = 'default',
  className,
  fontSize = 'md',
}: {
  name: string;
  image?: string | null;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  fontSize?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}) {
  return (
    <Avatar size={size} className={className} key={image || 'no-image'}>
      {image ? (
        <AvatarImage src={image || '/placeholder.svg'} alt={name} />
      ) : null}
      <AvatarFallback
        className={cn(
          'bg-primary/15 text-primary font-semibold',
          fontSize === 'sm'
            ? 'text-sm'
            : fontSize === 'lg'
              ? 'text-lg'
              : fontSize === 'xl'
                ? 'text-xl'
                : fontSize === '2xl'
                  ? 'text-2xl'
                  : fontSize === '3xl'
                    ? 'text-3xl'
                    : 'text-md',
        )}
      >
        {initialsFrom(name)}
      </AvatarFallback>
    </Avatar>
  );
}
