import { productionModules } from "../workspaceFixtures";
import { useWorkspaceStore } from "../../../stores/workspaceStore";

export function ProductionModuleGrid() {
  const setActivePanel = useWorkspaceStore((state) => state.setActivePanel);

  return (
    <section className="workspace-panel" aria-label="生产模块入口">
      <div className="section-heading">
        <div>
          <p className="panel-label">生产模块</p>
          <h3>进入不同工坊继续开发</h3>
        </div>
      </div>
      <div className="module-entry-grid">
        {productionModules.map((item) => {
          const Icon = item.icon;

          return (
            <button className={`module-entry accent-${item.accent}`} key={item.label} onClick={() => setActivePanel(item.panel)} type="button">
              <div className="module-entry-icon">
                <Icon aria-hidden="true" size={24} />
              </div>
              <div>
                <strong>{item.label}</strong>
                <p>{item.description}</p>
              </div>
              <div className="module-entry-meta">
                <span>{item.metric}</span>
                <em>{item.status}</em>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
