import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Slider({
  className,
  defaultValue,
  value,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn("relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50", className)}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      {...props}
    >
      <SliderPrimitive.Track
        className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted"
        data-slot="slider-track"
      >
        <SliderPrimitive.Range className="absolute h-full bg-primary" data-slot="slider-range" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className="block size-4 rounded-full border border-primary/40 bg-background shadow-sm ring-ring/50 transition-colors focus-visible:ring-3 focus-visible:outline-none disabled:pointer-events-none"
        data-slot="slider-thumb"
      />
    </SliderPrimitive.Root>
  );
}

export { Slider };
