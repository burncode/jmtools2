import { convertFileSrc } from "@tauri-apps/api/core";
import { Assets, Container, Graphics, Sprite } from "pixi.js";
import type { Application } from "pixi.js";
import { useEffect, useRef, useState } from "react";

import { createPixiApplication } from "@/lib/pixi/createPixiApplication";

import type { WorkflowPreviewImage } from "./workflowPreviewAssets";

interface WorkflowPixiImagePreviewProps {
  image?: WorkflowPreviewImage;
}

const minimumStageSize = {
  height: 180,
  width: 280,
} as const;

export function WorkflowPixiImagePreview({ image }: WorkflowPixiImagePreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | undefined>(undefined);
  const textureUrlRef = useRef<string | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | undefined>();

  const previewKey = image?.absolutePath ?? image?.projectRelativePath ?? "empty";

  useEffect(() => {
    setLoadError(undefined);
  }, [previewKey]);

  useEffect(() => {
    const host = hostRef.current;
    const sourcePath = image?.absolutePath ?? image?.projectRelativePath;

    if (!host || !sourcePath) {
      return undefined;
    }

    const resolvedPath = sourcePath;
    const mountHost = host;
    let disposed = false;
    let resizeObserver: ResizeObserver | undefined;
    let resizeFrameId = 0;

    async function mountPreview() {
      try {
        const app = await createPixiApplication({
          antialias: true,
          backgroundColor: 0x0b1220,
          height: Math.max(mountHost.clientHeight, minimumStageSize.height),
          width: Math.max(mountHost.clientWidth, minimumStageSize.width),
        });

        if (disposed) {
          app.destroy(true);
          return;
        }

        appRef.current = app;
        mountHost.replaceChildren(app.canvas);

        const root = new Container();
        app.stage.addChild(root);

        const background = drawPreviewBackground(app.renderer.width, app.renderer.height);
        root.addChild(background);

        const textureUrl = convertFileSrc(resolvedPath);
        textureUrlRef.current = textureUrl;
        const texture = await Assets.load(textureUrl);
        if (disposed) {
          return;
        }

        const sprite = Sprite.from(texture);
        fitSprite(sprite, app.renderer.width, app.renderer.height);
        root.addChild(sprite);

        resizeObserver = new ResizeObserver(() => {
          if (resizeFrameId) {
            window.cancelAnimationFrame(resizeFrameId);
          }

          resizeFrameId = window.requestAnimationFrame(() => {
            const width = Math.max(mountHost.clientWidth, minimumStageSize.width);
            const height = Math.max(mountHost.clientHeight, minimumStageSize.height);
            app.renderer.resize(width, height);
            resizePreviewBackground(background, width, height);
            fitSprite(sprite, width, height);
          });
        });
        resizeObserver.observe(mountHost);
      } catch (error) {
        if (!disposed) {
          setLoadError(error instanceof Error ? error.message : "图片预览加载失败。");
        }
      }
    }

    void mountPreview();

    return () => {
      disposed = true;
      if (resizeFrameId) {
        window.cancelAnimationFrame(resizeFrameId);
      }
      resizeObserver?.disconnect();
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = undefined;
      }
      if (textureUrlRef.current) {
        void Assets.unload(textureUrlRef.current);
        textureUrlRef.current = undefined;
      }
      mountHost.replaceChildren();
    };
  }, [previewKey, image?.absolutePath, image?.projectRelativePath]);

  if (!image?.absolutePath && !image?.projectRelativePath) {
    return <p className="workflow-muted">当前节点还没有可预览的图片输出。</p>;
  }

  if (loadError) {
    return <p className="workflow-field-error">{loadError}</p>;
  }

  return (
    <div className="workflow-pixi-image-preview">
      {image.label ? <p className="workflow-type-caption workflow-pixi-image-preview-label">{image.label}</p> : null}
      <div className="workflow-pixi-image-preview-stage" ref={hostRef} />
    </div>
  );
}

function drawPreviewBackground(width: number, height: number) {
  const graphics = new Graphics();
  resizePreviewBackground(graphics, width, height);
  return graphics;
}

function resizePreviewBackground(graphics: Graphics, width: number, height: number) {
  graphics.clear();
  graphics.rect(0, 0, width, height).fill(0x111827);
  graphics.rect(0, 0, width, height).fill({ alpha: 0.18, color: 0x64748b });
}

function fitSprite(sprite: Sprite, width: number, height: number) {
  const padding = 16;
  const maxWidth = Math.max(width - padding * 2, 1);
  const maxHeight = Math.max(height - padding * 2, 1);
  const scale = Math.min(maxWidth / sprite.texture.width, maxHeight / sprite.texture.height, 1);

  sprite.scale.set(scale);
  sprite.x = (width - sprite.texture.width * scale) / 2;
  sprite.y = (height - sprite.texture.height * scale) / 2;
}
