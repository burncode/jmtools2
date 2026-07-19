import type { ReactNode } from "react";

interface WorkbenchLayoutProps {
  aside?: ReactNode;
  className?: string;
  inspector?: ReactNode;
  main: ReactNode;
}

export function WorkbenchLayout({ aside, className, inspector, main }: WorkbenchLayoutProps) {
  return (
    <div className={["app-workbench-layout", className].filter(Boolean).join(" ")} data-has-aside={aside ? "true" : "false"}>
      {inspector ? <aside className="app-workbench-inspector">{inspector}</aside> : null}
      <main className="app-workbench-main">{main}</main>
      {aside ? <aside className="app-workbench-aside">{aside}</aside> : null}
    </div>
  );
}
