import type { ReactNode } from "react";

type AppPageShellSize = "settings" | "library" | "workbench" | "fluid";

interface AppPageShellProps {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: string;
  kicker?: string;
  size?: AppPageShellSize;
  title?: string;
}

export function AppPageShell({
  actions,
  children,
  className,
  description,
  kicker,
  size = "workbench",
  title,
}: AppPageShellProps) {
  return (
    <section className={["app-page-shell", className].filter(Boolean).join(" ")} data-size={size}>
      {title || description || kicker || actions ? (
        <header className="app-page-shell-header">
          <div>
            {kicker ? <span className="app-page-shell-kicker">{kicker}</span> : null}
            {title ? <h1>{title}</h1> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="app-page-shell-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="app-page-shell-body">{children}</div>
    </section>
  );
}
