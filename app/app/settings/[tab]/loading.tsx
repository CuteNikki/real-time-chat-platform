import { Loader2Icon } from 'lucide-react';

export default function SettingsLoading() {
  return (
    <div className='xs:pt-20 relative flex h-full w-full scrollbar-gutter-stable items-center justify-center overflow-y-auto pt-16 pb-14 md:pb-0'>
      <Loader2Icon className='text-muted-foreground size-8 animate-spin' />
    </div>
  );
}
