import { Badge } from "@/components/ui/badge";

interface CreateSelectedPlanCardProps {
  focus?: string;
  name: string;
  score?: number | string;
}

export function CreateSelectedPlanCard({ focus, name, score }: CreateSelectedPlanCardProps) {
  return (
    <section className="character-create-selected-summary app-semantic-section-card" data-accent="violet">
      <header>
        <strong>当前候选</strong>
        <Badge variant="secondary">{score ?? "--"} 分</Badge>
      </header>
      <p>{name}</p>
      {focus ? <small>{focus}</small> : null}
    </section>
  );
}
