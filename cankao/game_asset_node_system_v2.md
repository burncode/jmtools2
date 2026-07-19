
# 🎮 游戏资产生成节点系统 2.0 设计规范

## 🧠 1. 系统定位
本系统是 **Game Asset Compiler Graph（游戏资产编译图）**，用于将角色/动作/风格/提示词结构化生成游戏资产。

---

## 🧩 2. 核心理念

### 节点 = 能力单元（Skill Unit）
节点不是流程步骤，而是：
输入 + 参数 + 控制 = 输出

### 三层架构
- 🟢 语义层（Semantic Layer）
- 🟡 控制层（Control Layer）
- 🔵 资产层（Asset Layer）

---

## 🧱 3. 节点标准结构

```json
{
  "identity": {},
  "inputs": {},
  "params": {},
  "outputs": {}
}
```

---

## 🎨 4. 节点类型体系

### 🟢 输入节点
- Character Seed Node
- Style Reference Node
- Action Input Node

---

### 🟡 语义节点
- Outfit Node
- Style Compiler Node
- Prompt Builder Node

---

### 🔵 控制节点
- Pose Control Node
- Consistency Lock Node
- Reference Strength Node

---

### 🟣 生成节点
- Character Generator Node
- Variation Node
- Batch Generator Node

---

### 🟠 处理节点
- Background Remove Node
- Sprite Split Node
- Atlas Pack Node
- Upscale Node

---

### 🧱 游戏结构节点
- Animation Set Node
- State Machine Node
- Character Schema Node
- Export Node

---

## 🎯 5. Prompt规范

### 标准结构
subject + style + action + environment + lighting + quality

### JSON结构
```json
{
  "subject": "",
  "style": "",
  "action": "",
  "scene": "",
  "lighting": ""
}
```

### Negative Prompt
blurry, low quality, deformed, watermark

---

## 🧬 6. 风格系统

Style = Reference + Palette + Lighting + Constraint

```json
{
  "render_type": "pixel",
  "palette": "DB32",
  "lighting": "flat",
  "detail": 0.6
}
```

---

## 🔁 7. 标准数据流

Character Seed → Style → Outfit → Prompt → Control → Generate → Process → Export

---

## 🚀 8. UI规范

- 参数分组（Identity / Control / Semantic / Output）
- 输出预览
- 权重控制
- hover语义提示

---

## 🎮 9. 核心定义

节点系统 = 游戏资产编译器（Asset Compiler Graph）
