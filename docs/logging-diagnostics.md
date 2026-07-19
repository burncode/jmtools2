# JMTools 诊断与日志

## 日志目录

应用启动后，日志写入 Tauri `app_log_dir()`（通常为 `%AppData%/.../logs`）。每日滚动两个文件：

| 文件 | 用途 |
|------|------|
| `jmtools.log` | 人类可读的 compact 文本，适合开发期终端/手工阅读 |
| `jmtools.jsonl` | 结构化 JSON Lines，**设置 → 诊断与日志** 查看器主数据源 |

在设置页可点击「打开日志目录」直接定位文件夹。

## tracing target 约定

| target | 域 |
|--------|-----|
| `jmtools::commands` | Tauri command 边界（含 `CommandSpanGuard` 耗时） |
| `jmtools::local_inference` | sd-cpp、limits、capabilities、本地测试出图 |
| `jmtools::workflow` | 工作流 runtime、暂停/恢复、run 生命周期 |
| `jmtools::character` | 角色候选图、视图、入库 |
| `jmtools::frontend` | 前端 `appLogger` 桥接（`write_app_log`） |

## 结构化字段

JSONL 行内常见字段：

- `task_id`：角色/生成任务（如 `workflow-candidates-*`）
- `run_id`：工作流运行 ID（如 `run-*`）
- `command`：Tauri 命令名或 sd-cli 摘要
- `scope`：前端模块（如 `workflow.run`、`character.create.archive`）
- `duration_ms`：命令或子进程耗时

敏感信息默认脱敏：`logRedactPrompts=true` 时 Prompt 只保留长度与短摘要；API Key 中间段替换为 `***`。

## 排查示例

### 本地测试出图失败

1. 设置 → **诊断与日志**
2. 模块选 `jmtools::local_inference`
3. 关键词搜 `sd-cli` 或 `OOM`
4. 查看详情侧栏中的 `stderr` 摘要

### 工作流人工节点暂停后无法恢复

1. 在工作流 UI 复制 `run_id`
2. 诊断页 `run_id` 输入框粘贴并刷新
3. 同时查看工作流 **运行日志** 抽屉（节点级）与应用日志（命令级）

### 角色入库失败

1. 从角色工坊或工作流上下文获取 `task_id`
2. 诊断页按 `task_id` 筛选
3. 关注 `jmtools::character` 与 `jmtools::frontend` 的 error 行

## 日志级别

应用内 **设置 → 诊断与日志 → 最低输出级别** 写入 SQLite（`app.log.settings`），保存后立即热更新 filter。

环境变量 `RUST_LOG` 若已设置，会在启动时作为 `EnvFilter` 默认值；应用内级别仍通过原子 filter 控制输出层。

## 前端 appLogger

```typescript
import { appLogger } from "@/lib/logger";

await appLogger.error("运行工作流失败", {
  scope: "workflow.run",
  workflowId: workflow.id,
  runId: activeRunId,
  errorMessage,
});
```

高频 Tauri 命令（`run_workflow`、`resume_workflow_run`、`generate_character_master_*`、`test_local_image_generation`）经 `invokeWithLog` 自动记录耗时。

## 导出

诊断页「导出筛选结果」将当前筛选条件下的 JSONL 行写入用户选择的路径，便于附带 issue 或离线分析。
