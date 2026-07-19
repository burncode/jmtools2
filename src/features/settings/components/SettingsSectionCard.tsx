import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { SettingsSection } from "./SettingsPanelPrimitives";

interface SettingsSectionCardProps {
  children: ReactNode;
  description: string;
  icon: LucideIcon;
  title: string;
}

export function SettingsSectionCard({ children, description, icon: Icon, title }: SettingsSectionCardProps) {
  return (
    <SettingsSection description={description} icon={Icon} title={title}>
      {children}
    </SettingsSection>
  );
}
