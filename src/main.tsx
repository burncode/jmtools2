import React from "react";
import ReactDOM from "react-dom/client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { CharacterMotionPresetLibraryView } from "./features/characters/motion/CharacterMotionPresetLibraryView";
import { isCharacterMotionPresetLibraryWindow } from "./features/characters/motion/characterMotionPresetLibraryWindow";
import "./features/characters/motion/character-motion-preset-library.css";
import { StylePresetLibraryView } from "./features/style-presets/StylePresetLibraryView";
import { isStylePresetLibraryWindow } from "./features/style-presets/stylePresetLibraryWindow";
import "./features/style-presets/style-preset-library.css";
import "./features/style-presets/style-preset-editor.css";
import { initializeLogger } from "./lib/logger";
import { initAppTheme, applyAppAccentColor } from "./lib/theme";

import App from "./App";

import "./styles/tokens.css";
import "./styles/accent-palettes.css";
import "./styles/typography.css";
import "./App.css";
import "./components/shared/shared.css";

void initializeLogger();

function resolveRootComponent() {
  if (isStylePresetLibraryWindow()) {
    return StylePresetLibraryView;
  }
  if (isCharacterMotionPresetLibraryWindow()) {
    return CharacterMotionPresetLibraryView;
  }
  return App;
}

const RootComponent = resolveRootComponent();
const isAuxiliaryWindow = isStylePresetLibraryWindow() || isCharacterMotionPresetLibraryWindow();

if (isAuxiliaryWindow) {
  initAppTheme("dark");
  applyAppAccentColor("blue");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TooltipProvider>
      <RootComponent />
    </TooltipProvider>
  </React.StrictMode>,
);
