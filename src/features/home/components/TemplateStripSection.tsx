import { Button } from "@/components/ui/button";

import type { ProjectTemplate } from "../../projects/types";
import { homeTemplates } from "../homeFixtures";

interface TemplateStripSectionProps {
  onCreateProjectFromTemplate: (template: ProjectTemplate) => void;
}

export function TemplateStripSection({ onCreateProjectFromTemplate }: TemplateStripSectionProps) {
  return (
    <section className="home-section template-strip-section" aria-label="从模板创建项目">
      <div className="section-heading">
        <div>
          <p className="panel-label">从模板创建项目</p>
          <h3>选择一个起点</h3>
        </div>
        <Button type="button" variant="ghost">
          查看全部模板
        </Button>
      </div>
      <div className="template-strip">
        {homeTemplates.map((item) => {
          const Icon = item.icon;

          return (
            <Button
              className="template-card"
              key={item.value}
              onClick={() => onCreateProjectFromTemplate(item.value)}
              type="button"
              variant="outline"
            >
              <Icon aria-hidden="true" size={28} />
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </Button>
          );
        })}
      </div>
    </section>
  );
}
