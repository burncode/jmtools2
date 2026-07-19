# 工作流角色域 Asset JSON 约定

工作流中间产物通过 **`asset` 端口**传递， envelope 结构统一为：

```json
{
  "kind": "<AssetKind>",
  "version": 1,
  "data": { }
}
```

节点输出格式：`{ "asset": { "kind", "version", "data" } }`

## AssetKind 枚举

| kind | 产出节点 | data 字段 |
|------|----------|-----------|
| `characterSeed` | `character.inputSeed` | `name`, `gender`, `age`, `race`, `class` |
| `styleProfile` | `character.styleProfile` | 见下方 **styleProfile 扩展字段** |

### styleProfile 扩展字段

兼容旧字段：`styleType`, `artReference`, `colorTheme`, `stylePrompt`。

| 字段 | 类型 | 说明 |
|------|------|------|
| `preset` | string | 内置预设 id |
| `visualDna` | object | `renderType`, `detail`, `contrast`, `saturation`, `sharpness`, `pixelDensity?`, `edgeStyle?` |
| `palette` | object | `mode`, `maxColors`, `paletteStrength`, `dithering`, `colors[]` |
| `lighting` | object | `type`, `shadowStrength`, `highlightStrength`, `ambient` |
| `constraints` | object | `paletteLock`, `lineStyleLock`, `identityLock`, `consistencyStrength` |
| `negativeHints` | string[] | 建议负向词，供 Prompt Compiler 合并 |
| `outfitProfile` | `character.outfitProfile` | `hairStyle`, `helmet`, `armorType`, `clothStyle`, `weaponType`, `weaponSize`, `cape`, `auraEffect`, `layers[]` |
| `promptText` | `ai.negativePrompt`, `logic.promptMerge` | `text`, `negativeText` |
| `promptBundle` | `logic.promptCompiler` | `prompt`, `negativePrompt`, `ast[]`, `controlSignals` |
| `controlProfile` | `control.consistencyLock`, `control.referenceStrength`, `control.seedLock` | `consistencyHash`, `referenceStrength`, `seed`, `styleLock` |
| `masterPlan` | `character.generatePlan` | 与 `CharacterMasterPlanInput` 字段一致 |
| `candidateImages` | `character.generateCandidates` | `taskId`, `items[]`（含 `planId`, `image`） |

`character` 端口仍表示已落盘的 `CharacterAssetRecord`，不是 asset envelope。

## 单节点验收 checklist

1. 画布仅放目标节点（+ 必要 mock 上游），参数填最小可运行集
2. Run 成功，`outputSummary` 与 Inspector 输出符合预期
3. 磁盘副作用（若有）路径在项目目录内且可复现
4. 不改 params 再 run → `cacheHit: true`
5. 改 params 再 run → 输出更新
6. descriptor `status` 为 `available`，palette 可添加

## 验证命令

```bash
bun run build
cd src-tauri && cargo check
```
