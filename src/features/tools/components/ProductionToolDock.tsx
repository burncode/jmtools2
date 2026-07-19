import { ArrowRight, CircleDot } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { productionToolDefinitions } from "../toolRegistry";
import type { ProductionToolDefinition, ProductionToolStatus } from "../types";

import "./ProductionToolDock.css";

interface ProductionToolDockProps {
  hasSourceAsset: boolean;
  onToolSelect?: (tool: ProductionToolDefinition) => void;
  variant?: "cards" | "toolbar";
}

const statusLabels: Record<ProductionToolStatus, string> = {
  available: "可使用",
  designing: "设计中",
  planned: "规划中",
};

export function ProductionToolDock({ hasSourceAsset, onToolSelect, variant = "cards" }: ProductionToolDockProps) {
  if (variant === "toolbar") {
    return (
      <TooltipProvider>
        <div className="production-tool-toolbar" aria-label="素材处理工具">
          {productionToolDefinitions.map((tool) => (
            <ProductionToolButton hasSourceAsset={hasSourceAsset} key={tool.id} onSelect={onToolSelect} tool={tool} />
          ))}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <section className="production-tool-dock" aria-label="素材处理工具">
      <header>
        <div>
          <span className="step-dot">工具</span>
          <div>
            <strong>后处理工具</strong>
            <small>{hasSourceAsset ? "基于当前候选图继续处理素材" : "生成候选图后可进入去背景、视图风格和切割流程"}</small>
          </div>
        </div>
      </header>

      <div className="production-tool-grid">
        {productionToolDefinitions.map((tool) => (
          <ProductionToolCard hasSourceAsset={hasSourceAsset} key={tool.id} onSelect={onToolSelect} tool={tool} />
        ))}
      </div>
    </section>
  );
}

function ProductionToolButton({
  hasSourceAsset,
  onSelect,
  tool,
}: {
  hasSourceAsset: boolean;
  onSelect?: (tool: ProductionToolDefinition) => void;
  tool: ProductionToolDefinition;
}) {
  const Icon = tool.icon;
  const isActionable = hasSourceAsset && tool.status !== "planned" && Boolean(onSelect);
  const disabledReason = hasSourceAsset ? statusLabels[tool.status] : "生成候选图后可用";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className="production-tool-toolbar-button"
          data-status={tool.status}
          disabled={!isActionable}
          onClick={() => onSelect?.(tool)}
          size="sm"
          type="button"
          variant="outline"
        >
          <Icon aria-hidden="true" />
          {tool.label}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="production-tool-tooltip" side="bottom" sideOffset={8}>
        <strong>{tool.label}</strong>
        <span>{isActionable ? statusLabels[tool.status] : disabledReason}</span>
        <p>{tool.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function ProductionToolCard({
  hasSourceAsset,
  onSelect,
  tool,
}: {
  hasSourceAsset: boolean;
  onSelect?: (tool: ProductionToolDefinition) => void;
  tool: ProductionToolDefinition;
}) {
  const Icon = tool.icon;
  const isActionable = hasSourceAsset && tool.status !== "planned";

  return (
    <article className="production-tool-card" data-disabled={isActionable ? "false" : "true"} data-status={tool.status}>
      <div className="production-tool-icon">
        <Icon aria-hidden="true" />
      </div>
      <div className="production-tool-copy">
        <div>
          <strong>{tool.label}</strong>
          <span>
            <CircleDot aria-hidden="true" />
            {statusLabels[tool.status]}
          </span>
        </div>
        <p>{tool.description}</p>
      </div>
      <Button disabled={!isActionable} onClick={() => onSelect?.(tool)} size="sm" type="button" variant="outline">
        进入
        <ArrowRight aria-hidden="true" />
      </Button>
    </article>
  );
}
