import { Button } from "@/components/ui/button";

import { useWorkspaceStore } from "../../../stores/workspaceStore";
import { workspaceNavItems } from "../workspaceFixtures";

export function WorkspaceSidebar() {
  const activePanel = useWorkspaceStore((state) => state.activePanel);
  const setActivePanel = useWorkspaceStore((state) => state.setActivePanel);
  const productionItems = workspaceNavItems.filter((item) => item.group === "production");
  const managementItems = workspaceNavItems.filter((item) => item.group === "management");

  return (
    <aside className="project-sidebar" aria-label="项目工作台导航">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true">
          JM
        </div>
        <div>
          <p className="eyebrow">项目工作台</p>
          <h1>JMTools</h1>
        </div>
      </div>

      <nav className="project-nav" aria-label="生产模块">
        <p className="project-nav-label">生产模块</p>
        {productionItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.panel === activePanel;

          return (
            <Button className={`nav-item ${isActive ? "active" : ""}`} key={item.label} onClick={() => setActivePanel(item.panel)} type="button" variant="ghost">
              <Icon aria-hidden="true" size={18} />
              <span>{item.label}</span>
            </Button>
          );
        })}
      </nav>

      <nav className="project-nav project-nav-secondary" aria-label="项目管理">
        <p className="project-nav-label">项目管理</p>
        {managementItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.panel === activePanel;

          return (
            <Button className={`nav-item ${isActive ? "active" : ""}`} key={item.label} onClick={() => setActivePanel(item.panel)} type="button" variant="ghost">
              <Icon aria-hidden="true" size={18} />
              <span>{item.label}</span>
            </Button>
          );
        })}
      </nav>
    </aside>
  );
}
