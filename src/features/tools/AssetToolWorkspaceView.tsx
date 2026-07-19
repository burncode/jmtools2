import { open } from "@tauri-apps/plugin-dialog";
import { AlertTriangle, CheckCircle2, Eraser, FileImage, Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanvasPanel, InspectorPanel, PanelSection, SegmentedControl, StatusBanner, WorkbenchLayout } from "@/components/shared";
import { defaultSettings } from "@/features/settings/settingsDefaults";
import { appLogger } from "@/lib/logger";
import { getAppSettings, loadAssetToolSourcePreview, runAssetTool } from "@/lib/tauri/commands";
import type { AppSettings } from "@/lib/tauri/commands";
import type { PipelineProject } from "../projects/types";
import { AssetToolPreview } from "./components/AssetToolPreview";
import { BackgroundRemovalToolPanel } from "./components/BackgroundRemovalToolPanel";
import type { AssetToolResult, BackgroundRemovalToolOptions } from "./types";

import "./AssetToolWorkspaceView.css";

interface AssetToolWorkspaceViewProps {
  project: PipelineProject;
}

type PreviewBackground = "checkerboard" | "dark" | "light";
type PreviewMode = "compare" | "source" | "result";

interface SelectedToolSource {
  path: string;
  previewUrl?: string;
}

const previewModeOptions = [
  { label: "对比", value: "compare" },
  { label: "原图", value: "source" },
  { label: "结果", value: "result" },
] as const;

const backgroundOptions = [
  { label: "棋盘格", value: "checkerboard" },
  { label: "深色", value: "dark" },
  { label: "浅色", value: "light" },
] as const;

export function AssetToolWorkspaceView({ project }: AssetToolWorkspaceViewProps) {
  const [source, setSource] = useState<SelectedToolSource>();
  const [result, setResult] = useState<AssetToolResult>();
  const [message, setMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("compare");
  const [previewBackground, setPreviewBackground] = useState<PreviewBackground>("checkerboard");
  const [options, setOptions] = useState<BackgroundRemovalToolOptions>(() => buildDefaultOptions(defaultSettings));
  const warnings = result?.warnings ?? [];

  useEffect(() => {
    let isMounted = true;

    getAppSettings()
      .then((settings) => {
        if (isMounted) {
          setOptions(buildDefaultOptions({ ...defaultSettings, ...settings }));
        }
      })
      .catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        void appLogger.error(`读取去背景默认设置失败：message=${errorMessage}`);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const resultMeta = useMemo(() => {
    if (!result) {
      return [];
    }

    return [
      { label: "尺寸", value: `${result.outputImage.width} x ${result.outputImage.height}` },
      { label: "质量分", value: result.score ? `${result.score}` : "未评分" },
      { label: "BBox", value: result.bbox ? `${result.bbox.width} x ${result.bbox.height}` : "未检测" },
    ];
  }, [result]);

  const handlePickImage = async () => {
    const selectedPath = await open({
      filters: [{ extensions: ["png", "jpg", "jpeg", "webp"], name: "图片文件" }],
      multiple: false,
      title: "选择要处理的素材图片",
    });

    if (typeof selectedPath !== "string") {
      return;
    }

    setResult(undefined);
    setMessage("正在读取预览图...");

    try {
      const preview = await loadAssetToolSourcePreview({
        projectRoot: project.rootPath,
        source: {
          kind: "absolutePath",
          path: selectedPath,
        },
      });

      setSource({
        path: selectedPath,
        previewUrl: preview.dataUrl,
      });
      setMessage(`已载入图片：${preview.width} x ${preview.height}，可以调整参数后执行去背景。`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setSource({ path: selectedPath });
      setMessage(`预览读取失败：${errorMessage}`);
      await appLogger.error(`读取素材工具预览失败：source=${selectedPath} message=${errorMessage}`);
    }
  };

  const handleRunTool = async () => {
    if (!source) {
      setMessage("请先上传一张素材图片。");
      return;
    }

    setIsProcessing(true);
    setMessage("正在处理图片...");

    try {
      const nextResult = await runAssetTool({
        backgroundRemoval: options,
        projectRoot: project.rootPath,
        source: {
          kind: "absolutePath",
          path: source.path,
        },
        toolId: "background-removal",
      });

      setResult(nextResult);
      setPreviewMode("result");
      setMessage("去背景完成，结果已写入项目缓存目录。");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMessage(`去背景失败：${errorMessage}`);
      await appLogger.error(`通用去背景工具失败：source=${source.path} message=${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section className="asset-tool-workspace" aria-label="素材工具工作台">
      <header className="asset-tool-page-header">
        <div>
          <p className="panel-label">素材工具</p>
          <h2>去背景工具</h2>
          <span>面向角色、道具、地图和 UI 图片的通用透明 PNG 处理工具。</span>
        </div>
        <Badge variant={result ? "secondary" : "outline"}>{result ? "已有结果" : "等待处理"}</Badge>
      </header>

      <WorkbenchLayout
        className="asset-tool-layout"
        inspector={
          <InspectorPanel
            footer={
              <div className="asset-tool-inspector-footer">
                <Button className="asset-tool-run-button" disabled={!source || isProcessing} onClick={() => void handleRunTool()} type="button">
                  <Eraser aria-hidden="true" />
                  {isProcessing ? "处理中..." : "执行去背景"}
                </Button>
                <span>{source ? "参数会应用到本次处理。" : "请先上传一张素材图片。"}</span>
              </div>
            }
            icon={Eraser}
            label="去背景参数"
            title="去背景工具"
          >
            <BackgroundRemovalToolPanel
              onOptionsChange={setOptions}
              onPickImage={() => void handlePickImage()}
              options={options}
              sourcePath={source?.path}
            />
          </InspectorPanel>
        }
        main={
          <CanvasPanel
            className="asset-tool-canvas-panel"
            label="去背景预览"
            title="处理预览"
            toolbar={
              <SegmentedControl
                ariaLabel="预览模式"
                className="asset-tool-toolbar-segment"
                onValueChange={(value) => setPreviewMode(value as PreviewMode)}
                options={previewModeOptions.map((option) => ({ label: option.label, value: option.value }))}
                value={previewMode}
              />
            }
            actions={
              <div className="asset-tool-canvas-actions">
                <SegmentedControl
                  ariaLabel="预览背景"
                  className="asset-tool-toolbar-segment"
                  onValueChange={(value) => setPreviewBackground(value as PreviewBackground)}
                  options={backgroundOptions.map((option) => ({ label: option.label, value: option.value }))}
                  value={previewBackground}
                />
                <Button disabled={!source || isProcessing} onClick={() => void handleRunTool()} size="sm" type="button">
                  <Eraser aria-hidden="true" />
                  重新处理
                </Button>
              </div>
            }
          >
            <AssetToolPreview
              background={previewBackground}
              mode={previewMode}
              result={result}
              sourcePreviewUrl={source?.previewUrl}
            />
          </CanvasPanel>
        }
        aside={
          <InspectorPanel icon={Info} label="处理结果" title="处理结果">
            {message ? (
              <StatusBanner
                className="asset-tool-status-banner"
                description={message}
                title={message.includes("失败") ? "处理失败" : "工具状态"}
                variant={message.includes("失败") ? "danger" : "info"}
              />
            ) : null}
            <PanelSection icon={FileImage} title="输出信息">
              {result ? (
                <div className="asset-tool-result-meta">
                  {resultMeta.map((item) => (
                    <div key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="asset-tool-muted">执行处理后会显示输出尺寸、bbox 和质量分。</p>
              )}
              {result ? <p className="asset-tool-output-path">{result.outputImage.projectRelativePath}</p> : null}
            </PanelSection>
            <PanelSection icon={warnings.length > 0 ? AlertTriangle : CheckCircle2} title="质量报告">
              {result && warnings.length === 0 ? <p className="asset-tool-muted">未发现明显问题。</p> : null}
              {!result ? <p className="asset-tool-muted">处理完成后会显示检查建议。</p> : null}
              {warnings.length > 0 ? (
                <ul className="asset-tool-warning-list">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </PanelSection>
          </InspectorPanel>
        }
      />
    </section>
  );
}

function buildDefaultOptions(settings: AppSettings): BackgroundRemovalToolOptions {
  return {
    alphaMatting: settings.backgroundRemovalAlphaMatting,
    cleanupStrength: settings.backgroundRemovalCleanupStrength,
    edgeOffset: 0,
    edgeSoftness: settings.backgroundRemovalEdgeSoftness,
    engine: settings.backgroundRemovalEngine,
    executablePath: settings.backgroundRemovalExecutablePath,
    holeFillMaxPixels: settings.backgroundRemovalHoleFillMaxPixels,
    manualBackgroundSamples: [],
    modelPath: settings.backgroundRemovalModelPath,
    preserveSmallParts: settings.backgroundRemovalPreserveSmallParts,
    rembgModel: settings.backgroundRemovalModel,
    spillSuppression: settings.backgroundRemovalSpillSuppression,
    tolerance: settings.backgroundRemovalTolerance,
  };
}
