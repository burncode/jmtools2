import type { ReactNode } from "react";

interface AssetLibraryLayoutProps {
  children: ReactNode;
  className?: string;
  sidebar?: ReactNode;
  toolbar?: ReactNode;
}

export function AssetLibraryLayout({ children, className, sidebar, toolbar }: AssetLibraryLayoutProps) {
  return (
    <div className={["app-asset-library-layout", className].filter(Boolean).join(" ")}>
      {sidebar ? <aside className="app-asset-library-sidebar">{sidebar}</aside> : null}
      <section className="app-asset-library-content">
        {toolbar ? <div className="app-asset-library-toolbar">{toolbar}</div> : null}
        <div className="app-asset-library-grid">{children}</div>
      </section>
    </div>
  );
}
