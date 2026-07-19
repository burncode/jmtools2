import { useState } from "react";

import { Button } from "@/components/ui/button";
import { runPostProcessSegment } from "@/lib/tauri/characterPipeline";
import { getAppSettings } from "@/lib/tauri/commands";
import { appLogger } from "@/lib/logger";

import type { CharacterAssetRecord } from "../../types";

interface PostProcessStepProps {
  character: CharacterAssetRecord;
  onComplete: () => void;
  onSkip: () => void;
  options: {
    runAnalyze: boolean;
    runNormalize: boolean;
    runRemoveBackground: boolean;
    runViews: boolean;
  };
  projectRoot: string;
  setOptions: (options: PostProcessStepProps["options"]) => void;
}

export function PostProcessStep({ character, onComplete, onSkip, options, projectRoot, setOptions }: PostProcessStepProps) {
  const [message, setMessage] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  async function handleRun() {
    if (!options.runAnalyze && !options.runNormalize && !options.runRemoveBackground && !options.runViews) {
      onSkip();
      return;
    }

    setIsRunning(true);
    setMessage("正在执行快捷后处理...");

    try {
      const settings = await getAppSettings();
      await runPostProcessSegment(
        projectRoot,
        character.id,
        options,
        options.runRemoveBackground
          ? {
              alphaMatting: settings.backgroundRemovalAlphaMatting,
              backgroundThreshold: settings.backgroundRemovalBackgroundThreshold,
              cleanupStrength: settings.backgroundRemovalCleanupStrength,
              customModelPath: settings.backgroundRemovalModelPath,
              edgeSoftness: settings.backgroundRemovalEdgeSoftness,
              engine: settings.backgroundRemovalEngine,
              executablePath: settings.backgroundRemovalExecutablePath,
              foregroundThreshold: settings.backgroundRemovalForegroundThreshold,
              holeFillMaxPixels: settings.backgroundRemovalHoleFillMaxPixels,
              model: settings.backgroundRemovalModel,
              preserveSmallParts: settings.backgroundRemovalPreserveSmallParts,
              spillSuppression: settings.backgroundRemovalSpillSuppression,
              tolerance: settings.backgroundRemovalTolerance,
            }
          : undefined,
      );
      setMessage("快捷后处理完成。");
      onComplete();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMessage(`后处理失败：${errorMessage}`);
      await appLogger.error(`角色快捷后处理失败：id=${character.id} message=${errorMessage}`);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <section className="character-wizard-panel character-wizard-postprocess">
      <h3>快捷后处理（可选）</h3>
      <p>入库后可立即执行以下步骤，也可跳过并在生产工作室中完成。</p>
      <label className="character-wizard-check">
        <input
          checked={options.runViews}
          onChange={(event) => setOptions({ ...options, runViews: event.target.checked })}
          type="checkbox"
        />
        <span>生成缺失视图</span>
      </label>
      <label className="character-wizard-check">
        <input
          checked={options.runRemoveBackground}
          onChange={(event) => setOptions({ ...options, runRemoveBackground: event.target.checked })}
          type="checkbox"
        />
        <span>去背景</span>
      </label>
      <label className="character-wizard-check">
        <input
          checked={options.runNormalize}
          onChange={(event) => setOptions({ ...options, runNormalize: event.target.checked })}
          type="checkbox"
        />
        <span>规范化视图</span>
      </label>
      <label className="character-wizard-check">
        <input
          checked={options.runAnalyze}
          onChange={(event) => setOptions({ ...options, runAnalyze: event.target.checked })}
          type="checkbox"
        />
        <span>图像预检</span>
      </label>
      {message ? <p className="character-tool-message">{message}</p> : null}
      <div className="character-create-wizard-footer-actions">
        <Button disabled={isRunning} onClick={() => void handleRun()} type="button">
          {isRunning ? "处理中..." : "执行并进入生产工作室"}
        </Button>
        <Button onClick={onSkip} type="button" variant="outline">
          跳过
        </Button>
      </div>
    </section>
  );
}
