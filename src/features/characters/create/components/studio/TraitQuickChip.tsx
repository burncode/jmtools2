interface TraitQuickChipProps {
  label: string;
  onClick: () => void;
}

export function TraitQuickChip({ label, onClick }: TraitQuickChipProps) {
  return (
    <button className="app-trait-quick-chip" onClick={onClick} type="button">
      <span aria-hidden="true" className="app-trait-quick-chip-prefix">
        +
      </span>
      {label}
    </button>
  );
}
