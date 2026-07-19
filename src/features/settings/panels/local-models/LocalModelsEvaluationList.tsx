import { Badge } from "@/components/ui/badge";
import type { BackendEvaluationStatus } from "@/lib/tauri/localModels";

interface LocalModelsEvaluationListProps {
  evaluations: BackendEvaluationStatus[];
}

export function LocalModelsEvaluationList({ evaluations }: LocalModelsEvaluationListProps) {
  return (
    <div className="local-models-evaluation-list space-y-2">
      {evaluations.map((entry) => (
        <div
          className="local-models-evaluation-item flex items-start justify-between gap-3 rounded-md border border-border p-3"
          key={entry.id}
        >
          <div className="min-w-0 space-y-1">
            <strong className="block text-sm font-semibold text-foreground">{entry.label}</strong>
            <p className="text-xs leading-relaxed text-muted-foreground">{entry.summary}</p>
            <small className="block text-xs leading-relaxed text-muted-foreground/80">{entry.recommendation}</small>
          </div>
          <Badge className="shrink-0 self-start" variant={entry.integrated ? "default" : "outline"}>
            {entry.integrated ? "已集成" : entry.phase}
          </Badge>
        </div>
      ))}
    </div>
  );
}
