import { Badge } from "@/components/ui/badge";

import { recentWorkItems } from "../workspaceFixtures";

export function RecentWorkPanel() {
  return (
    <section className="workspace-panel" aria-label="最近工作">
      <div className="section-heading compact-heading">
        <div>
          <p className="panel-label">最近工作</p>
          <h3>可继续编辑的素材</h3>
        </div>
      </div>
      <div className="recent-work-list">
        {recentWorkItems.map((item) => (
          <article className="recent-work-row" key={item.name}>
            <div className="recent-work-thumb">{item.type}</div>
            <div>
              <strong>{item.name}</strong>
              <p>
                {item.module} · {item.status} · {item.detail}
              </p>
            </div>
            <Badge variant="outline">{item.time}</Badge>
          </article>
        ))}
      </div>
    </section>
  );
}
