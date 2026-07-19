# Game Asset Compiler Graph 架构

JMTools 节点工作台采用 **Game Asset Compiler Graph（游戏资产编译图）** 定位：将角色语义、风格、控制信号编译为 AI 可执行指令，再经生成与处理节点落盘为项目资产。

## 三层模型

| 层 | 职责 | 典型节点 |
|----|------|----------|
| **语义层**（semantic） | 描述「生成什么」 | `character.inputSeed`、`styleProfile`、`outfitProfile`、`ai.negativePrompt` |
| **控制层**（control） | 约束一致性与生成参数 | `control.consistencyLock`、`control.referenceStrength`、`control.seedLock` |
| **资产层**（asset） | 生成、处理、导出落盘 | `generatePlan`、`generateCandidates`、`removeBackground`、`atlasPack` |

编译中枢：`logic.promptCompiler` 将语义 + 控制输入编译为 `promptBundle` asset（含 AST、正负向 prompt、controlSignals）。

## 标准数据流

```text
Seed / Style / Outfit / Negative ──┐
Control nodes ─────────────────────┼──► promptCompiler ──► generatePlan ──► generateCandidates
                                   │                              │
                                   └──────────────────────────────┴──► create ──► 后处理 ──► 导出
```

## 描述符扩展

[`shared/workflow-nodes/nodes.json`](../shared/workflow-nodes/nodes.json) 可选字段：

- `layer`: `io` | `semantic` | `control` | `asset`
- `paramGroups`: Inspector 分组定义
- 参数项可选 `group` 引用分组 id

## Asset Kind

见 [`workflow-character-asset-schema.md`](workflow-character-asset-schema.md)，新增：

| kind | 说明 |
|------|------|
| `promptBundle` | Prompt Compiler 输出 |
| `controlProfile` | 控制层节点输出 |

## 明确推迟（defer）

- 子图（Subgraph）嵌套
- Live Compile 自动全图 rerun
- WASM / Python 多后端
- control/reference 连线类型分色（当前统一 data 边）
- Pose ControlNet 节点

## 相关文档

- [工作流引擎架构](workflow-engine-architecture.md)
- [角色生成流水线（节点视角）](character-generation-pipeline.md)
- [角色生产线 roadmap](character-pipeline-roadmap.md)
