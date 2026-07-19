import { Plus, X } from "lucide-react";
import { useRef, useState } from "react";

interface PaletteSwatchGridProps {
  colors: string[];
  maxColors: number;
  onChange: (colors: string[]) => void;
  readOnly?: boolean;
  removable?: boolean;
}

function normalizeHexColor(color: string): string {
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed;
  }
  return "#000000";
}

export function PaletteSwatchGrid({
  colors,
  maxColors,
  onChange,
  readOnly = false,
  removable = true,
}: PaletteSwatchGridProps) {
  const editInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const editingIndexRef = useRef<number | null>(null);
  const [editColor, setEditColor] = useState("#000000");
  const [addColor, setAddColor] = useState("#808080");

  function openEditPicker(index: number) {
    if (readOnly) {
      return;
    }
    editingIndexRef.current = index;
    setEditColor(normalizeHexColor(colors[index] ?? "#000000"));
    requestAnimationFrame(() => {
      editInputRef.current?.click();
    });
  }

  function openAddPicker() {
    editingIndexRef.current = null;
    requestAnimationFrame(() => {
      addInputRef.current?.click();
    });
  }

  function handleEditChange(value: string) {
    const index = editingIndexRef.current;
    if (index === null || index < 0 || index >= colors.length) {
      return;
    }
    const nextColors = [...colors];
    nextColors[index] = value;
    onChange(nextColors);
    setEditColor(value);
  }

  function handleAddChange(value: string) {
    if (colors.length >= maxColors) {
      return;
    }
    onChange([...colors, value]);
    setAddColor(value);
  }

  function handleRemove(index: number) {
    onChange(colors.filter((_, itemIndex) => itemIndex !== index));
  }

  const canAdd = !readOnly && colors.length < maxColors;
  const canRemove = !readOnly && removable;

  return (
    <div className="app-palette-swatch-grid">
      <input
        aria-hidden="true"
        className="app-palette-swatch-input-hidden"
        onChange={(event) => handleEditChange(event.target.value)}
        ref={editInputRef}
        tabIndex={-1}
        type="color"
        value={editColor}
      />
      <input
        aria-hidden="true"
        className="app-palette-swatch-input-hidden"
        onChange={(event) => handleAddChange(event.target.value)}
        ref={addInputRef}
        tabIndex={-1}
        type="color"
        value={addColor}
      />

      {colors.map((color, index) => (
        <div className="app-palette-swatch-item" key={`${color}-${index}`}>
          <button
            aria-label={`编辑色板 ${index + 1}`}
            className="app-palette-swatch-button"
            onClick={() => openEditPicker(index)}
            style={{ backgroundColor: normalizeHexColor(color) }}
            title={color}
            type="button"
          />
          {canRemove ? (
            <button
              aria-label={`删除色板 ${index + 1}`}
              className="app-palette-swatch-remove"
              onClick={() => handleRemove(index)}
              type="button"
            >
              <X aria-hidden="true" />
            </button>
          ) : null}
          <span className="app-palette-swatch-hex">{color}</span>
        </div>
      ))}

      {canAdd ? (
        <div className="app-palette-swatch-item">
          <button aria-label="添加颜色" className="app-palette-add-button" onClick={openAddPicker} type="button">
            <Plus aria-hidden="true" />
          </button>
          <span className="app-palette-swatch-hex">添加</span>
        </div>
      ) : null}
    </div>
  );
}
