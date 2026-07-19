import { Hand, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

import { WorkflowCandidatePlanPicker } from "./components/WorkflowCandidatePlanPicker";
import type { WorkflowPreviewAssets } from "./workflowPreviewAssets";
import type { PendingManualInput } from "./workflowStore";

interface WorkflowManualGateDialogProps {
  onCancel: () => void;
  onConfirm: (decision: string | string[]) => void;
  pending?: PendingManualInput;
  projectRoot: string;
  submitting: boolean;
}

function buildPreviewAssets(pending: PendingManualInput): WorkflowPreviewAssets | undefined {
  if (!pending.previewImages?.length) {
    return undefined;
  }

  return {
    images: pending.previewImages.map((image, index) => ({
      absolutePath: image.absolutePath,
      label: image.label ?? `方案 ${index + 1}`,
      planId: image.planId,
      projectRelativePath: image.projectRelativePath,
    })),
    kind: "multi",
  };
}

export function WorkflowManualGateDialog({
  onCancel,
  onConfirm,
  pending,
  projectRoot,
  submitting,
}: WorkflowManualGateDialogProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const previewAssets = useMemo(
    () => (pending ? buildPreviewAssets(pending) : undefined),
    [pending],
  );

  useEffect(() => {
    if (pending) {
      setSelected(pending.options.length > 0 ? [pending.options[0].value] : []);
    }
  }, [pending]);

  if (!pending) {
    return null;
  }

  const allowMultiple = pending.allowMultiple;
  const selectedPlanId = allowMultiple ? "" : (selected[0] ?? "");

  function toggle(value: string) {
    setSelected((current) => {
      if (allowMultiple) {
        return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
      }

      return [value];
    });
  }

  function handleConfirm() {
    if (selected.length === 0) {
      return;
    }

    onConfirm(allowMultiple ? selected : selected[0]);
  }

  return (
    <div className="workflow-modal-backdrop" role="presentation">
      <section
        aria-label="人工节点选择"
        className="workflow-modal workflow-modal-compact"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="workflow-modal-header">
          <div className="workflow-manual-gate-title">
            <Hand aria-hidden="true" />
            <div>
              <strong className="workflow-type-section">人工节点</strong>
              <p className="workflow-type-caption">{pending.prompt}</p>
            </div>
          </div>
          <Button aria-label="取消运行" disabled={submitting} onClick={onCancel} type="button" variant="ghost">
            <X aria-hidden="true" />
          </Button>
        </header>

        <div className="workflow-modal-body">
          {previewAssets ? (
            <WorkflowCandidatePlanPicker
              assets={previewAssets}
              description="选择 1 个候选方案后继续入库。"
              onSelect={(planId) => setSelected(planId ? [planId] : [])}
              projectRoot={projectRoot}
              selectedPlanId={selectedPlanId}
              showAutoRecommend={false}
              title="候选方案"
            />
          ) : (
            <div className="workflow-manual-gate-options" role="group" aria-label="候选项">
              {pending.options.length === 0 ? (
                <p className="workflow-type-caption">该人工节点未配置候选项，请取消并补充候选项后重试。</p>
              ) : (
                pending.options.map((option) => {
                  const active = selected.includes(option.value);
                  return (
                    <button
                      aria-pressed={active}
                      className="workflow-manual-gate-option"
                      data-active={active}
                      disabled={submitting}
                      key={option.value}
                      onClick={() => toggle(option.value)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  );
                })
              )}
            </div>
          )}
          <p className="workflow-type-caption">{allowMultiple ? "可多选，确认后继续执行下游节点。" : "单选，确认后继续执行下游节点。"}</p>
        </div>

        <footer className="workflow-modal-footer">
          <Button disabled={submitting} onClick={onCancel} type="button" variant="ghost">
            取消运行
          </Button>
          <Button disabled={submitting || selected.length === 0} onClick={handleConfirm} type="button">
            {submitting ? "继续中…" : "确认并继续"}
          </Button>
        </footer>
      </section>
    </div>
  );
}
