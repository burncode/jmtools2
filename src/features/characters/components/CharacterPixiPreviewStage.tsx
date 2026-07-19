import { Assets, Container, Graphics, Sprite } from "pixi.js";
import type { Application, Ticker } from "pixi.js";
import { useEffect, useRef } from "react";

import { createPixiApplication } from "@/lib/pixi/createPixiApplication";

import { hasCharacterImageSource, resolveCharacterImageSrc } from "../characterImageSrc";
import type { CharacterActionId, CharacterAssetRecord } from "../types";

interface CharacterPixiPreviewStageProps {
  actionId: CharacterActionId;
  assetMode: "auto" | "original" | "transparent";
  direction: string;
  fps: number;
  frameIndex: number;
  isPlaying: boolean;
  loopMode: "loop" | "once";
  onionSkinEnabled?: boolean;
  onFrameChange: (frameIndex: number) => void;
  onPlaybackComplete: () => void;
  projectRoot: string;
  record: CharacterAssetRecord;
  totalFrames: number;
  viewKind: string;
}

interface PreviewScene {
  app: Application;
  assetSprite?: Sprite;
  assetUrl?: string;
  character: Container;
  grid: Graphics;
  onionBehind: Container;
  onionAhead: Container;
  shadow: Graphics;
}

const minimumStageSize = {
  height: 240,
  width: 320,
} as const;

function resolveStageSize(host: HTMLElement) {
  const width = host.clientWidth > 0 ? host.clientWidth : minimumStageSize.width;
  const height =
    host.clientHeight > 0 ? Math.max(host.clientHeight, minimumStageSize.height) : minimumStageSize.height;

  return { height, width };
}

export function CharacterPixiPreviewStage({
  actionId,
  assetMode,
  direction,
  fps,
  frameIndex,
  isPlaying,
  loopMode,
  onionSkinEnabled = false,
  onFrameChange,
  onPlaybackComplete,
  projectRoot,
  record,
  totalFrames,
  viewKind,
}: CharacterPixiPreviewStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | undefined>(undefined);
  const sceneRef = useRef<PreviewScene | undefined>(undefined);
  const elapsedMsRef = useRef(0);
  const frameIndexRef = useRef(frameIndex);
  const isPlayingRef = useRef(isPlaying);
  const loopModeRef = useRef(loopMode);
  const fpsRef = useRef(fps);
  const onFrameChangeRef = useRef(onFrameChange);
  const onPlaybackCompleteRef = useRef(onPlaybackComplete);
  const actionIdRef = useRef(actionId);
  const assetModeRef = useRef(assetMode);
  const directionRef = useRef(direction);
  const recordRef = useRef(record);
  const totalFramesRef = useRef(totalFrames);
  const viewKindRef = useRef(viewKind);
  const projectRootRef = useRef(projectRoot);
  const onionSkinEnabledRef = useRef(onionSkinEnabled);

  useEffect(() => {
    projectRootRef.current = projectRoot;
  }, [projectRoot]);

  useEffect(() => {
    onionSkinEnabledRef.current = onionSkinEnabled;
  }, [onionSkinEnabled]);

  useEffect(() => {
    actionIdRef.current = actionId;
    assetModeRef.current = assetMode;
    directionRef.current = direction;
    frameIndexRef.current = frameIndex;
    recordRef.current = record;
    viewKindRef.current = viewKind;
    drawPreviewScene({
      actionId,
      assetMode,
      direction,
      frameIndex,
      onionSkinEnabled,
      projectRoot,
      record,
      scene: sceneRef.current,
      totalFrames,
      viewKind,
    });
  }, [actionId, assetMode, direction, frameIndex, onionSkinEnabled, projectRoot, record, totalFrames, viewKind]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    loopModeRef.current = loopMode;
  }, [loopMode]);

  useEffect(() => {
    fpsRef.current = fps;
  }, [fps]);

  useEffect(() => {
    onFrameChangeRef.current = onFrameChange;
  }, [onFrameChange]);

  useEffect(() => {
    onPlaybackCompleteRef.current = onPlaybackComplete;
  }, [onPlaybackComplete]);

  useEffect(() => {
    totalFramesRef.current = totalFrames;
  }, [totalFrames]);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return undefined;
    }

    const mountHost = host;
    let isDisposed = false;
    let resizeObserver: ResizeObserver | undefined;

    async function mountPixiStage() {
      const stageSize = resolveStageSize(mountHost);
      const app = await createPixiApplication({
        backgroundColor: 0x07101d,
        height: stageSize.height,
        width: stageSize.width,
      });

      if (isDisposed) {
        app.destroy(true);
        return;
      }

      app.canvas.className = "character-pixi-canvas";
      mountHost.append(app.canvas);

      const scene = createPreviewScene(app);
      app.stage.addChild(scene.grid, scene.shadow, scene.onionBehind, scene.character, scene.onionAhead);
      appRef.current = app;
      sceneRef.current = scene;

      const resizeStage = () => {
        const { height, width } = resolveStageSize(mountHost);

        app.renderer.resize(width, height);
        drawPreviewScene({
          actionId: actionIdRef.current,
          assetMode: assetModeRef.current,
          direction: directionRef.current,
          frameIndex: frameIndexRef.current,
          onionSkinEnabled: onionSkinEnabledRef.current,
          projectRoot: projectRootRef.current,
          record: recordRef.current,
          scene,
          totalFrames: totalFramesRef.current,
          viewKind: viewKindRef.current,
        });
      };

      resizeObserver = new ResizeObserver(resizeStage);
      resizeObserver.observe(mountHost);
      resizeStage();

      const tick = (ticker: Ticker) => {
        if (!isPlayingRef.current) {
          return;
        }

        elapsedMsRef.current += ticker.deltaMS;
        const frameDuration = 1000 / Math.max(1, fpsRef.current);

        if (elapsedMsRef.current < frameDuration) {
          return;
        }

        elapsedMsRef.current %= frameDuration;
        const frameCount = Math.max(1, totalFramesRef.current);
        const isLastFrame = frameIndexRef.current >= frameCount - 1;

        if (isLastFrame && loopModeRef.current === "once") {
          isPlayingRef.current = false;
          onPlaybackCompleteRef.current();
          return;
        }

        const nextFrame = (frameIndexRef.current + 1) % frameCount;
        frameIndexRef.current = nextFrame;
        onFrameChangeRef.current(nextFrame);
      };

      app.ticker.add(tick);
    }

    void mountPixiStage();

    return () => {
      isDisposed = true;
      resizeObserver?.disconnect();
      appRef.current?.destroy(true);
      appRef.current = undefined;
      sceneRef.current = undefined;
    };
  }, []);

  return <div className="character-pixi-stage" ref={hostRef} />;
}

function createPreviewScene(app: Application): PreviewScene {
  return {
    app,
    character: new Container(),
    grid: new Graphics(),
    onionAhead: new Container(),
    onionBehind: new Container(),
    shadow: new Graphics(),
  };
}

function drawPreviewScene({
  actionId,
  assetMode = "auto",
  direction,
  frameIndex,
  onionSkinEnabled = false,
  projectRoot,
  record,
  scene,
  totalFrames = 1,
  viewKind,
}: {
  actionId: CharacterActionId;
  assetMode?: "auto" | "original" | "transparent";
  direction: string;
  frameIndex: number;
  onionSkinEnabled?: boolean;
  projectRoot: string;
  record: CharacterAssetRecord;
  scene?: PreviewScene;
  totalFrames?: number;
  viewKind: string;
}) {
  if (!scene) {
    return;
  }

  scene.onionBehind.removeChildren().forEach((child) => child.destroy());
  scene.onionAhead.removeChildren().forEach((child) => child.destroy());
  scene.onionBehind.alpha = 0.35;
  scene.onionAhead.alpha = 0.35;

  const width = scene.app.screen.width;
  const height = scene.app.screen.height;
  const centerX = width / 2;
  const centerY = height / 2 + 12;
  const actionOffset = getActionOffset(actionId, frameIndex);
  const imageUrl = getPreferredPreviewImage(record, projectRoot, assetMode, viewKind);

  drawGrid(scene.grid, width, height);
  drawShadow(scene.shadow, centerX, centerY + 86, actionOffset.shadowScale);

  if (onionSkinEnabled && totalFrames > 1) {
    const previousFrame = (frameIndex - 1 + totalFrames) % totalFrames;
    const nextFrame = (frameIndex + 1) % totalFrames;
    const previousOffset = getActionOffset(actionId, previousFrame);
    const nextOffset = getActionOffset(actionId, nextFrame);

    if (!imageUrl) {
      drawCharacter(scene.onionBehind, {
        actionId,
        centerX,
        centerY: centerY + previousOffset.y,
        direction,
        frameIndex: previousFrame,
        palette: record.palette,
        swing: previousOffset.swing,
      });
      drawCharacter(scene.onionAhead, {
        actionId,
        centerX,
        centerY: centerY + nextOffset.y,
        direction,
        frameIndex: nextFrame,
        palette: record.palette,
        swing: nextOffset.swing,
      });
    }
  }

  if (imageUrl) {
    drawImageCharacter(scene, {
      centerX,
      centerY: centerY + 96 + actionOffset.y,
      imageUrl,
      swing: actionOffset.swing,
    });
    return;
  }

  scene.assetUrl = undefined;
  scene.assetSprite = undefined;
  drawCharacter(scene.character, {
    actionId,
    centerX,
    centerY: centerY + actionOffset.y,
    direction,
    frameIndex,
    palette: record.palette,
    swing: actionOffset.swing,
  });
}

function getPreferredPreviewImage(
  record: CharacterAssetRecord,
  projectRoot: string,
  assetMode: "auto" | "original" | "transparent",
  viewKind: string,
) {
  const viewImage = findCharacterView(record, viewKind, projectRoot);

  if (assetMode === "transparent") {
    return (
      resolveCharacterImageSrc(projectRoot, viewImage?.transparentImage) ||
      resolveCharacterImageSrc(projectRoot, viewImage?.rawImage) ||
      resolveCharacterImageSrc(projectRoot, record.masterImage)
    );
  }

  if (assetMode === "original") {
    return (
      resolveCharacterImageSrc(projectRoot, viewImage?.rawImage) ||
      resolveCharacterImageSrc(projectRoot, record.masterImage)
    );
  }

  return (
    resolveCharacterImageSrc(projectRoot, viewImage?.transparentImage) ||
    resolveCharacterImageSrc(projectRoot, viewImage?.rawImage) ||
    resolveCharacterImageSrc(projectRoot, record.masterImage)
  );
}

function findCharacterView(record: CharacterAssetRecord, viewKind: string, projectRoot: string) {
  const views = record.views ?? [];
  const hasImage = (view: (typeof views)[number]) =>
    hasCharacterImageSource(projectRoot, view.transparentImage) ||
    hasCharacterImageSource(projectRoot, view.rawImage);

  return (
    views.find((view) => view.kind === viewKind && hasImage(view)) ??
    views.find((view) => view.kind === viewKind) ??
    views.find((view) => view.kind === "front" || view.kind === "single") ??
    views.find((view) => hasImage(view))
  );
}

function drawImageCharacter(
  scene: PreviewScene,
  options: {
    centerX: number;
    centerY: number;
    imageUrl: string;
    swing: number;
  },
) {
  if (scene.assetUrl !== options.imageUrl) {
    scene.assetUrl = options.imageUrl;
    scene.assetSprite = undefined;
    scene.character.removeChildren().forEach((child) => child.destroy());

    void Assets.load(options.imageUrl)
      .then((texture) => {
        if (scene.assetUrl !== options.imageUrl) {
          return;
        }

        scene.character.removeChildren().forEach((child) => child.destroy());
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 1);
        sprite.roundPixels = true;
        scene.assetSprite = sprite;
        scene.character.addChild(sprite);
        layoutImageCharacter(sprite, options);
      })
      .catch(() => {
        if (scene.assetUrl === options.imageUrl) {
          scene.assetUrl = undefined;
          scene.assetSprite = undefined;
        }
      });
  }

  if (scene.assetSprite) {
    layoutImageCharacter(scene.assetSprite, options);
  }
}

function layoutImageCharacter(
  sprite: Sprite,
  options: {
    centerX: number;
    centerY: number;
    swing: number;
  },
) {
  const textureWidth = Math.max(1, sprite.texture.width);
  const textureHeight = Math.max(1, sprite.texture.height);
  const scale = Math.min(280 / textureWidth, 320 / textureHeight, 1.8);

  sprite.scale.set(scale);
  sprite.position.set(options.centerX, options.centerY);
  sprite.rotation = options.swing * 0.0015;
}

function drawGrid(grid: Graphics, width: number, height: number) {
  grid.clear();
  grid.rect(0, 0, width, height).fill(0x07101d);

  for (let x = 0; x <= width; x += 24) {
    grid.moveTo(x, 0).lineTo(x, height).stroke({ alpha: 0.12, color: 0x8bb6ee, width: 1 });
  }

  for (let y = 0; y <= height; y += 24) {
    grid.moveTo(0, y).lineTo(width, y).stroke({ alpha: 0.1, color: 0x8bb6ee, width: 1 });
  }

  grid.circle(width / 2, height * 0.78, Math.min(width, height) * 0.22).fill({ alpha: 0.08, color: 0xb8beda });
}

function drawShadow(shadow: Graphics, centerX: number, centerY: number, scale: number) {
  shadow.clear();
  shadow.ellipse(centerX, centerY, 72 * scale, 16 * scale).fill({ alpha: 0.38, color: 0x000000 });
}

function drawCharacter(
  character: Container,
  options: {
    actionId: CharacterActionId;
    centerX: number;
    centerY: number;
    direction: string;
    frameIndex: number;
    palette: string[];
    swing: number;
  },
) {
  character.removeChildren().forEach((child) => child.destroy());

  const bodyColor = parseColor(options.palette[0], 0x2f7df6);
  const metalColor = parseColor(options.palette[1], 0xc9d6e8);
  const accentColor = parseColor(options.palette[2], 0xf6c542);
  const skinColor = 0xd9a15f;
  const isBack = options.direction.includes("后");
  const isLeft = options.direction.includes("左");
  const directionFlip = isLeft ? -1 : 1;
  const attackReach = options.actionId === "attack" ? 18 : 0;
  const walkShift = options.actionId === "walk" ? Math.sin(options.frameIndex * 1.35) * 6 : 0;

  const head = new Graphics();
  head.roundRect(-28, -104, 56, 56, 8).fill(isBack ? metalColor : skinColor);
  head.rect(-28, -104, 56, 13).fill(isBack ? 0x334155 : 0x9a5b2b);
  head.position.set(options.centerX, options.centerY - 16 + walkShift * 0.18);

  const body = new Graphics();
  body.roundRect(-38, -48, 76, 96, 10).fill(metalColor);
  body.roundRect(-30, -39, 60, 78, 8).fill(0x29384d);
  body.rect(-22, -31, 44, 18).fill({ alpha: 0.34, color: 0xffffff });
  body.position.set(options.centerX, options.centerY + walkShift * 0.12);

  const shield = new Graphics();
  shield.roundRect(-28, -38, 56, 82, 8).fill(bodyColor);
  shield.rect(-28, 21, 56, 12).fill(accentColor);
  shield.position.set(options.centerX + directionFlip * (50 + attackReach * 0.35), options.centerY + options.swing * 0.16);
  shield.rotation = directionFlip * 0.04;

  const sword = new Graphics();
  sword.roundRect(-6, -48, 12, 104 + attackReach, 6).fill(0xdceaff);
  sword.rect(-14, 35 + attackReach, 28, 8).fill(accentColor);
  sword.position.set(options.centerX - directionFlip * (66 + attackReach), options.centerY + 8 - options.swing * 0.2);
  sword.rotation = directionFlip * (0.72 + options.swing * 0.015);

  character.addChild(sword, body, head, shield);
}

function getActionOffset(actionId: CharacterActionId, frameIndex: number) {
  if (actionId === "walk") {
    return {
      shadowScale: 1 + Math.sin(frameIndex * 1.2) * 0.05,
      swing: Math.sin(frameIndex * 1.2) * 9,
      y: Math.sin(frameIndex * 1.2) * 4,
    };
  }

  if (actionId === "attack") {
    const isStrikeFrame = frameIndex % 4 >= 2;

    return {
      shadowScale: isStrikeFrame ? 1.08 : 1,
      swing: isStrikeFrame ? 18 : -6,
      y: isStrikeFrame ? -2 : 1,
    };
  }

  return {
    shadowScale: 1 + Math.sin(frameIndex * 0.8) * 0.025,
    swing: Math.sin(frameIndex * 0.8) * 3,
    y: Math.sin(frameIndex * 0.8) * 2,
  };
}

function parseColor(value: string | undefined, fallback: number) {
  if (!value?.startsWith("#")) {
    return fallback;
  }

  const color = Number.parseInt(value.slice(1), 16);

  return Number.isFinite(color) ? color : fallback;
}
