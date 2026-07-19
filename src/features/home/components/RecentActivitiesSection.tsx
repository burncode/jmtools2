import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { recentActivities } from "../homeFixtures";

export function RecentActivitiesSection() {
  return (
    <section className="home-section" aria-label="最近活动">
      <div className="section-heading">
        <div>
          <p className="panel-label">最近活动</p>
          <h3>素材处理记录</h3>
        </div>
        <Button type="button" variant="ghost">
          查看全部活动
        </Button>
      </div>
      <div className="activity-grid">
        {recentActivities.map((activity) => (
          <article className="activity-card" key={activity.name}>
            <div className="activity-preview">{activity.kind}</div>
            <h4>{activity.name}</h4>
            <div>
              <Badge variant="outline">{activity.kind}</Badge>
              <span>{activity.time}</span>
            </div>
            <small>{activity.status}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
