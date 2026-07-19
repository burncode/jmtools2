import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface SettingsCardGridProps {
  children: ReactNode;
  wide?: boolean;
}

interface SettingsSectionProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  description: string;
  icon: LucideIcon;
  title: string;
}

interface SettingsCalloutProps {
  children: ReactNode;
  className?: string;
  icon: LucideIcon;
  title: string;
}

interface SettingsInfoPanelProps {
  actions?: ReactNode;
  children: ReactNode;
  description: string;
  icon: LucideIcon;
  title: string;
}

interface SettingsReadOnlyRowProps {
  label: string;
  value: ReactNode;
}

interface SettingsNoteProps {
  children: ReactNode;
}

export function SettingsCardGrid({ children, wide = false }: SettingsCardGridProps) {
  return <div className={wide ? "settings-card-grid settings-card-grid-wide" : "settings-card-grid"}>{children}</div>;
}

export function SettingsSection({
  children,
  className,
  contentClassName,
  description,
  icon: Icon,
  title,
}: SettingsSectionProps) {
  return (
    <section className={className ? `settings-card ${className}` : "settings-card"}>
      <header className="settings-card-title">
        <Icon aria-hidden="true" />
        <div>
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
      </header>
      {contentClassName ? <div className={contentClassName}>{children}</div> : children}
    </section>
  );
}

export function SettingsCallout({ children, className, icon: Icon, title }: SettingsCalloutProps) {
  return (
    <div className={className ? `settings-callout ${className}` : "settings-callout"}>
      <Icon aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <span>{children}</span>
      </div>
    </div>
  );
}

export function SettingsInfoPanel({ actions, children, description, icon: Icon, title }: SettingsInfoPanelProps) {
  return (
    <SettingsSection className="settings-info-panel" description={description} icon={Icon} title={title}>
      {children}
      {actions ? <div className="settings-info-actions">{actions}</div> : null}
    </SettingsSection>
  );
}

export function SettingsReadOnlyRow({ label, value }: SettingsReadOnlyRowProps) {
  return (
    <div className="settings-readonly-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function SettingsNote({ children }: SettingsNoteProps) {
  return <div className="settings-note">{children}</div>;
}
