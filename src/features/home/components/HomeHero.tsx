import { FolderOpen, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

interface HomeHeroProps {
  onCreateProject: () => void;
  onOpenProject: () => void;
}

export function HomeHero({ onCreateProject, onOpenProject }: HomeHeroProps) {
  return (
    <section className="home-hero" aria-label="项目入口">
      <div className="hero-copy">
        <h2>
          从灵感到成品，
          <br />
          高效生成游戏素材
        </h2>
        <p>AI 赋能、专业工具、规范管理、一键导出</p>
        <div className="hero-actions">
          <Button className="primary-action hero-action" onClick={onCreateProject} type="button">
            <Plus aria-hidden="true" />
            新建素材项目
          </Button>
          <Button className="hero-action" onClick={onOpenProject} type="button" variant="outline">
            <FolderOpen aria-hidden="true" />
            打开项目
          </Button>
        </div>
      </div>
      <div className="hero-visual" aria-hidden="true">
        <div className="pixel-sky" />
        <div className="pixel-castle" />
        <div className="pixel-ground" />
      </div>
    </section>
  );
}
