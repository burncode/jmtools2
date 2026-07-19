
# 🎮 游戏资产生成节点系统 2.0 设计规范（增强版）

## 🧠 1. 系统定位
Game Asset Compiler Graph：将角色/动作/风格/提示词编译为游戏资产的节点系统。

---

# 🧱 2. 节点标准结构

所有节点统一结构：

```json
{
  "id": "node_id",
  "type": "style.compiler",
  "name": "Style Compiler",
  "inputs": {},
  "outputs": {},
  "params": {},
  "ui": {},
  "meta": {}
}
```

---

# 🧬 3. 节点 JSON Schema 标准化（核心）

## 3.1 基础 Schema

```json
{
  "type": "object",
  "required": ["id", "type", "inputs", "outputs", "params"],
  "properties": {
    "id": { "type": "string" },
    "type": { "type": "string" },
    "name": { "type": "string" },

    "inputs": {
      "type": "object",
      "additionalProperties": {
        "type": "string"
      }
    },

    "outputs": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "type": { "type": "string" },
          "value": {}
        }
      }
    },

    "params": {
      "type": "object",
      "additionalProperties": true
    },

    "meta": {
      "type": "object",
      "properties": {
        "version": { "type": "string" },
        "category": { "type": "string" },
        "description": { "type": "string" }
      }
    }
  }
}
```

---

## 3.2 参数标准（Params Design Rule）

### 支持类型：

- string
- number
- boolean
- enum
- object
- array

### 示例：

```json
{
  "params": {
    "style": {
      "type": "enum",
      "value": "pixel_art",
      "options": ["pixel_art", "anime", "realistic"]
    },
    "strength": {
      "type": "number",
      "value": 0.8,
      "min": 0,
      "max": 1
    }
  }
}
```

---

## 3.3 输入输出连接规则

```text
output.type === input.expectedType
```

支持：

- strict match
- semantic match（AI推断兼容）

---

# 🎨 4. ComfyUI 风格 React 节点渲染规范

---

# 🧩 4.1 核心思想

React 节点 =

> 数据驱动 UI + 拖拽连接 + 实时编译

---

# 🧱 4.2 Node React 结构

```tsx
<Node>
  <NodeHeader />
  <NodeBody>
    <InputPorts />
    <ParamsPanel />
    <OutputPorts />
  </NodeBody>
</Node>
```

---

# 🎯 4.3 节点 UI 规范

## 4.3.1 Header

- name
- type badge
- status indicator
- collapse button

---

## 4.3.2 Input Port

```tsx
<InputPort
  id="style_input"
  type="style_profile"
/>
```

UI：

- 左侧圆点
- hover 显示类型
- 可断开连接

---

## 4.3.3 Output Port

- 右侧
- 可多输出
- 支持 preview

---

## 4.3.4 Params Panel

支持：

- slider
- dropdown
- toggle
- text input

---

# 🔗 4.4 Edge（连接线）规范

```ts
type Edge = {
  from: string;
  to: string;
  type: "data" | "control" | "reference";
};
```

---

## 视觉规则：

- data = 蓝色
- control = 紫色
- reference = 绿色

---

# 🧠 4.5 节点状态系统

```ts
type NodeState =
  | "idle"
  | "running"
  | "success"
  | "error";
```

UI：

- glow effect
- border color
- pulse animation

---

# ⚙️ 4.6 Graph Runtime（执行模型）

```text
1. collect nodes
2. build dependency graph
3. topological sort
4. execute nodes
5. propagate outputs
```

---

# 🎮 5. ComfyUI 风格增强能力

---

## 5.1 预览系统（Preview Node）

- image preview
- prompt preview
- metadata preview

---

## 5.2 实时编译（Live Compile）

- 参数变化 → prompt即时更新
- 节点自动 rerun

---

## 5.3 Subgraph（子图）

```text
Character Graph
   ↓
Style Graph
   ↓
Export Graph
```

---

# 🧬 6. 工业级扩展能力

---

## 6.1 Node Registry（节点注册表）

```json
{
  "type": "style.compiler",
  "inputs": [],
  "outputs": [],
  "executor": "StyleCompiler.run"
}
```

---

## 6.2 Backend Executor（后端执行）

支持：

- Python
- Rust service
- WASM runtime

---

## 6.3 AI Node Adapter

可接：

- Diffusion model
- LLM prompt engine
- ControlNet
- Video model

---

# 🚀 7. 系统核心升级总结

---

## ❌ 旧版本

- 节点 = 功能块
- UI = 表单
- prompt = 拼接字符串

---

## ✅ 新版本

- 节点 = 编译单元
- UI = React data-driven graph
- prompt = 编译产物
- graph = 程序化资产系统

---

# 🎯 8. 一句话定义

> 🎮 本系统是一个“基于React可视化编译器的游戏资产生成引擎”
