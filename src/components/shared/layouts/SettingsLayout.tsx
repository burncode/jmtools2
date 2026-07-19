import type { ReactNode } from "react";

interface SettingsLayoutProps {
  editor: ReactNode;
  sidebar: ReactNode;
}

export function SettingsLayout({ editor, sidebar }: SettingsLayoutProps) {
  return (
    <div className="app-settings-layout">
      {sidebar}
      {editor}
    </div>
  );
}
