'use client';

import { Slider as SliderPrimitive } from '@base-ui/react/slider';

import { cn } from '@/lib/utils';

function Slider({
  className,
  ...props
}: SliderPrimitive.Root.Props<number | readonly number[]>) {
  return (
    <SliderPrimitive.Root
      data-slot='slider'
      className={cn('w-full', className)}
      {...props}
    >
      <SliderPrimitive.Control className='relative flex h-5 w-full touch-none items-center'>
        <SliderPrimitive.Track className='bg-input relative h-1.5 w-full grow overflow-hidden rounded-full'>
          <SliderPrimitive.Indicator className='bg-primary absolute h-full rounded-full' />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className='border-primary bg-background focus-visible:ring-ring absolute size-4 -translate-x-1/2 rounded-full border shadow-sm transition-colors outline-none focus-visible:ring-2' />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
