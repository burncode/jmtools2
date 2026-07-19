import { Moon, Search, Settings, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AppTheme } from "@/lib/theme";

interface HomeTopbarProps {
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  theme: AppTheme;
}

export function HomeTopbar({ onOpenSettings, onToggleTheme, theme }: HomeTopbarProps) {
  const isDark = theme === "dark" || (theme === "system" && document.documentElement.dataset.theme === "dark");

  return (
    <header className="home-topbar">
      <label className="global-search">
        <Search aria-hidden="true" size={18} />
        <Input aria-label="搜索项目" placeholder="搜索项目、模板、工具..." />
      </label>
      <div className="topbar-actions" aria-label="首页操作">
        <Button aria-label={isDark ? "切换到浅色主题" : "切换到深色主题"} onClick={onToggleTheme} type="button" variant="outline">
          {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          {isDark ? "浅色" : "深色"}
        </Button>
        <Button onClick={onOpenSettings} type="button" variant="outline">
          <Settings aria-hidden="true" />
          设置
        </Button>
      </div>
    </header>
  );
}
