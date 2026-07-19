import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type IconButtonProps = ComponentProps<typeof Button>;

export function IconButton({ className, size = "icon", variant = "outline", ...props }: IconButtonProps) {
  return <Button className={cn("app-icon-button", className)} size={size} variant={variant} {...props} />;
}
