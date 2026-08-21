import { Loader2Icon } from 'lucide-react';

// Shared instant-navigation fallback for every /app/* route while its server
// component fetches. A more specific loading.tsx (e.g. settings) overrides this.
export default function AppLoading() {
  return (
    <div className='xs:pt-20 relative flex h-full w-full scrollbar-gutter-stable items-center justify-center overflow-y-auto pt-16 pb-14 md:pb-0'>
      <Loader2Icon className='text-muted-foreground size-8 animate-spin' />
    </div>
  );
}
