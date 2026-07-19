import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GradientPrimaryButtonProps = ComponentProps<typeof Button>;

export function GradientPrimaryButton({ className, ...props }: GradientPrimaryButtonProps) {
  return <Button className={cn("app-gradient-primary-button", className)} {...props} />;
}
