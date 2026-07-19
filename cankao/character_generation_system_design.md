# 角色生成系统设计文档 - AI 游戏素材生成工具

> 技术栈假设：Tauri + Rust 桌面端，前端使用 React/Vue/Svelte 之一，AI 角色生成目前主要依赖外部 AI 接口，Rust 负责素材流水线、数据结构、图像处理、导出与项目管理。

---

## 1. 产品定位

角色生成系统的目标不是单纯“AI 生一张角色图”，而是生成一套可以进入游戏开发流程的结构化角色资产。

最终输出应该支持：

- 单角色立绘 / 精灵图
- 透明背景 PNG
- Front / Side / Back 多视图
- Idle / Walk / Run / Attack / Death 等动作帧
- PNG 序列
- SpriteSheet
- Atlas JSON
- Godot / Unity / Bevy / Phaser 可用资源包

核心原则：

```text
AI 负责生成视觉内容
Rust 负责结构化、规范化、去背景、切帧、导出
UI 负责把 Prompt 变成可视化配置
```

---

## 2. 核心问题

如果直接使用简单流程：

```text
输入 Prompt
↓
AI 生成角色图
↓
生成动作
↓
导出
```

会遇到很多问题：

### 2.1 一致性问题

同一个角色在不同视角、不同动作中可能出现：

- 脸变了
- 发型变了
- 武器变了
- 护甲细节变了
- 身高比例变了
- 颜色风格变了

### 2.2 动作帧抖动

AI 逐帧生成动作时容易出现：

- 身体轮廓闪烁
- 武器变形
- 脚底位置跳动
- 角色重心漂移
- 服装细节帧间不一致

### 2.3 背景与透明问题

AI 输出通常会带背景或伪透明背景，需要：

- 自动去背景
- Alpha 边缘清理
- 裁剪透明边界
- 统一画布尺寸
- 消除残留背景色

### 2.4 游戏可用性问题

单张 PNG 不等于游戏资产。游戏中还需要：

- 统一轴心点
- 统一脚底线
- 可配置碰撞盒 / 命中盒
- 动作元数据
- SpriteSheet 和 Atlas
- 引擎导入格式

---

## 3. 推荐角色生成流水线

推荐系统流程：

```text
角色配置
↓
Prompt / 参数生成
↓
AI 生成基础角色
↓
去背景
↓
角色规范化
↓
多视图生成
↓
动作生成
↓
帧修复
↓
动画预览
↓
导出
```

详细流程：

```text
素材库 / 属性选择
↓
CharacterConfig JSON
↓
Prompt Builder
↓
AI Provider Client
↓
Raw Image
↓
Background Removal
↓
Normalize / Crop / Anchor
↓
View Generator
↓
Animation Generator
↓
Frame Processor
↓
Sprite Exporter
```

---

## 4. UI 交互设计

角色生成 UI 的核心不是让用户写复杂 Prompt，而是通过可视化点击、拖拽、选择、滑块来构建角色。

### 4.1 页面结构

建议布局：

```text
┌─────────────────────────────────────────────┐
│ 顶部：项目名 / 模型选择 / 生成按钮 / 导出按钮 │
├──────────────┬──────────────────┬───────────┤
│ 左侧属性面板  │ 中央角色预览区      │ 右侧参数区 │
│              │                  │           │
│ 职业/种族     │ Front / Side / Back│ Seed      │
│ 发型/脸型     │ 多版本对比         │ Prompt    │
│ 服装/装备     │ 透明棋盘背景       │ 去背景参数 │
│ 武器/饰品     │ 动画预览           │ 导出设置   │
├──────────────┴──────────────────┴───────────┤
│ 底部：时间轴 / 帧列表 / 动作库 / 任务队列      │
└─────────────────────────────────────────────┘
```

### 4.2 左侧属性面板

分类建议：

```text
基础
- 种族
- 性别 / 体型
- 年龄感
- 头身比
- 风格

外观
- 发型
- 发色
- 眼睛
- 脸型
- 表情

装备
- 上衣
- 下装
- 护甲
- 披风
- 鞋子
- 手套

武器
- 剑
- 弓
- 法杖
- 盾牌
- 双刀
- 枪械

风格
- 像素风
- Q版
- 手绘
- 二次元
- 暗黑
- 低多边形感

视图
- Front
- Side
- Back
- 3/4 View

动作
- Idle
- Walk
- Run
- Attack
- Cast
- Jump
- Hurt
- Death
```

### 4.3 可视化 Prompt 操作方式

用户操作：

```text
点击「骑士」
点击「白发」
点击「金色重甲」
点击「长剑」
点击「像素风」
```

系统生成结构化配置：

```json
{
  "class": "knight",
  "hair": {
    "style": "short",
    "color": "white"
  },
  "armor": {
    "type": "heavy",
    "color": "gold"
  },
  "weapon": "long_sword",
  "style": "pixel_art"
}
```

再由 Prompt Builder 转成 AI 请求。

---

## 5. 素材库与 AI 生成的关系

素材库不应该只是资源仓库，而应该是 AI 生成的控制器。

### 5.1 错误设计

```text
素材库 = 存放图片
AI生成 = 另一个独立功能
```

这样会导致用户无法复用角色设定，也很难保持一致性。

### 5.2 推荐设计

```text
素材库 = Prompt 控制器 + 风格控制器 + 生成模板库
```

素材库中每个条目都可以包含：

```json
{
  "id": "armor_heavy_001",
  "name": "重甲 001",
  "category": "armor",
  "preview": "armor_heavy_001.png",
  "prompt": "heavy knight armor",
  "negative_prompt": "modern clothes, sci-fi armor",
  "tags": ["armor", "knight", "metal"],
  "style_hint": "fantasy medieval",
  "lora": null,
  "weight": 0.8
}
```

用户选择素材库条目，本质上是选择 Prompt 片段、风格约束、LoRA 或参考图。

---

## 6. LoRA 控制器概念

LoRA 可以理解为一种轻量模型插件，用于控制特定风格、角色、职业或装备。

在 UI 中不要直接暴露“LoRA”这个技术词给普通用户，可以包装成：

```text
职业风格
角色模板
画风包
装备风格包
种族包
```

### 6.1 UI 与 LoRA 映射

```text
用户选择：像素风
后台：加载 pixel_art_lora

用户选择：骑士
后台：加载 knight_lora

用户选择：RPG Maker 风格
后台：加载 rpg_sprite_lora
```

### 6.2 当前项目使用外部 AI 接口时的处理

如果外部接口支持 LoRA：

```json
{
  "prompt": "...",
  "lora": [
    {"name": "pixel_art", "weight": 0.7},
    {"name": "knight", "weight": 0.6}
  ],
  "seed": 12345
}
```

如果外部接口不支持 LoRA，则通过：

- Prompt 模板
- 参考图
- 风格词库
- 固定 seed
- 角色配置 JSON
- 多轮生成约束

来尽量提高一致性。

---

## 7. 角色配置数据模型

### 7.1 CharacterProject

```rust
pub struct CharacterProject {
    pub id: Uuid,
    pub name: String,
    pub config: CharacterConfig,
    pub views: Vec<CharacterView>,
    pub animations: Vec<CharacterAnimation>,
    pub assets: CharacterAssetBundle,
    pub metadata: CharacterMetadata,
}
```

### 7.2 CharacterConfig

```rust
pub struct CharacterConfig {
    pub identity: CharacterIdentity,
    pub appearance: AppearanceConfig,
    pub outfit: OutfitConfig,
    pub equipment: EquipmentConfig,
    pub style: StyleConfig,
    pub generation: GenerationConfig,
}
```

### 7.3 CharacterIdentity

```rust
pub struct CharacterIdentity {
    pub race: String,
    pub class_type: String,
    pub body_type: String,
    pub age_style: String,
    pub personality_tags: Vec<String>,
}
```

### 7.4 AppearanceConfig

```rust
pub struct AppearanceConfig {
    pub hair_style: String,
    pub hair_color: String,
    pub eye_color: String,
    pub skin_tone: String,
    pub expression: String,
    pub head_ratio: f32,
}
```

### 7.5 EquipmentConfig

```rust
pub struct EquipmentConfig {
    pub weapon_main: Option<String>,
    pub weapon_offhand: Option<String>,
    pub shield: Option<String>,
    pub accessory: Vec<String>,
}
```

### 7.6 StyleConfig

```rust
pub struct StyleConfig {
    pub art_style: String,      // pixel, chibi, anime, hand_painted
    pub resolution: u32,        // 128, 256, 512
    pub color_palette: Option<String>,
    pub outline: bool,
    pub view_mode: ViewMode,
}
```

### 7.7 GenerationConfig

```rust
pub struct GenerationConfig {
    pub provider: String,
    pub model: String,
    pub seed: Option<u64>,
    pub prompt: String,
    pub negative_prompt: String,
    pub steps: Option<u32>,
    pub cfg_scale: Option<f32>,
    pub reference_image: Option<String>,
}
```

---

## 8. 角色视图系统

### 8.1 推荐视图策略

不建议只生成单角色正面图。更适合游戏开发的是：

```text
Front + Side + Back
```

因为：

- Side 可以镜像成 Left / Right
- Front 用于向下方向
- Back 用于向上方向
- 适合 RPG / ARPG / 农场 / 俯视角游戏

### 8.2 视图数据模型

```rust
pub enum CharacterViewKind {
    Front,
    Side,
    Back,
    ThreeQuarter,
}

pub struct CharacterView {
    pub id: Uuid,
    pub kind: CharacterViewKind,
    pub image_path: PathBuf,
    pub transparent_path: Option<PathBuf>,
    pub normalized_path: Option<PathBuf>,
    pub anchor: AnchorPoint,
    pub bbox: BoundingBox,
}
```

### 8.3 多视图生成方案

方案 A：统一角色配置分别生成

```text
CharacterConfig
├─ Front Prompt
├─ Side Prompt
└─ Back Prompt
```

方案 B：Front 作为参考图生成 Side / Back

```text
Front Image
↓
Reference Image / Image-to-Image
↓
Side / Back
```

方案 C：先生成角色设定图，再拆成多视图任务

```text
角色设定 JSON
↓
生成 Front
↓
生成 Side
↓
生成 Back
↓
一致性评分
```

### 8.4 一致性检查

需要检查：

- 主色是否一致
- 发色是否一致
- 武器是否一致
- 身高比例是否一致
- 头身比是否一致
- 轮廓大小是否接近
- 脚底位置是否一致

可以先做基础图像统计，不必一开始做复杂 AI 识别。

---

## 9. 去背景系统

### 9.1 推荐流程

```text
Raw Image
↓
Background Removal
↓
Alpha Cleanup
↓
Trim Transparent Border
↓
Normalize Canvas
↓
Anchor Alignment
```

### 9.2 商用开源优先方案

如果要开源 + 商用，需要注意模型授权。

推荐优先考虑：

```text
rembg / U²-Net
MODNet
SAM 辅助手动分割
```

注意：部分 RMBG 版本可能是非商用授权，需要单独确认，不应默认纳入商用开源版本。

### 9.3 Rust 图像处理库

```toml
image = "0.25"
imageproc = "0.25"
fast_image_resize = "4"
```

用途：

- PNG 读写
- Alpha 裁剪
- 缩放
- 合成
- 边缘处理
- SpriteSheet 打包

### 9.4 Alpha 清理参数

UI 参数建议：

```text
Alpha 阈值：0-255
边缘羽化：0-10
去杂点：开/关
透明边界裁剪：开/关
保留阴影：开/关
背景残留清理：开/关
```

---

## 10. 角色规范化系统

这是角色动画可用性的关键。

### 10.1 为什么需要规范化

如果每帧角色位置不同，就会出现：

```text
动画播放时角色上下跳动
攻击时脚底漂移
走路时身体重心乱跳
```

### 10.2 规范化目标

每张角色图都需要统一：

- 画布尺寸
- 角色中心点
- 脚底位置
- 角色缩放比例
- 透明边界
- 朝向
- 锚点 Anchor

### 10.3 推荐标准

例如：

```text
画布：128x128 / 256x256
脚底线：Y = 112 / 224
中心线：X = 64 / 128
Anchor：Bottom Center
```

### 10.4 Anchor 数据模型

```rust
pub struct AnchorPoint {
    pub x: f32,
    pub y: f32,
    pub mode: AnchorMode,
}

pub enum AnchorMode {
    BottomCenter,
    Center,
    Custom,
}
```

---

## 11. 动作生成系统

### 11.1 三种路线

#### 路线 A：骨骼驱动

```text
角色图
↓
拆层
↓
关键点
↓
Rig
↓
动作库
↓
渲染帧
```

优点：

- 一致性最好
- 成本低
- 动作可复用
- 适合批量角色

缺点：

- 自动拆层难
- 自动 Rig 难
- 对 Q 版、怪物、披风、武器支持复杂

#### 路线 B：AI 关键帧生成

```text
角色参考图
↓
生成 Idle / Walk / Attack 关键帧
↓
去背景
↓
统一画布
↓
帧修复
```

优点：

- 开发较快
- 视觉效果自由
- 适合 MVP

缺点：

- 一致性难
- 成本较高
- 帧间容易闪烁

#### 路线 C：视频 / 动画模型生成

```text
角色图 + 动作描述
↓
视频模型
↓
拆帧
↓
去背景
↓
SpriteSheet
```

优点：

- 未来潜力大

缺点：

- 当前不够稳定
- 可控性差
- 不适合作为第一版核心路线

### 11.2 推荐路线

第一版推荐：

```text
AI 生成关键帧
+
Rust 帧规范化
+
动画预览
+
SpriteSheet 导出
```

第二版加入：

```text
半自动关键点
+
半自动 Rig
+
动作模板库
```

第三版再考虑：

```text
自动拆层
+
自动 Rig
+
AI 补全遮挡
```

---

## 12. 自动 Rig 的技术难点

自动 Rig 是高难度功能，不建议第一版做完全自动化。

### 12.1 难点

- AI 生成角色不是标准人体
- Q 版角色比例变化大
- 像素风关键点不明显
- 披风、武器、翅膀、尾巴难处理
- 手臂腿部可能被衣服或装备遮挡
- 单张 PNG 没有图层
- 被遮挡部分需要 AI 补全

### 12.2 推荐产品策略

不要叫“全自动 Rig”，而是做：

```text
智能骨骼建议
+
用户手动微调
```

流程：

```text
自动识别头/身体/手/脚
↓
生成默认骨骼
↓
用户拖动修正
↓
保存角色 Rig 模板
```

### 12.3 Rig 数据模型

```rust
pub struct Skeleton {
    pub id: Uuid,
    pub bones: Vec<Bone>,
    pub slots: Vec<Slot>,
    pub skins: Vec<SkinPart>,
}

pub struct Bone {
    pub id: Uuid,
    pub name: String,
    pub parent: Option<Uuid>,
    pub start: Vec2,
    pub end: Vec2,
    pub rotation_limit: Option<RotationLimit>,
}
```

---

## 13. 动画数据模型

### 13.1 CharacterAnimation

```rust
pub struct CharacterAnimation {
    pub id: Uuid,
    pub name: String,
    pub view: CharacterViewKind,
    pub action: ActionKind,
    pub fps: u32,
    pub looped: bool,
    pub frames: Vec<AnimationFrame>,
    pub events: Vec<AnimationEvent>,
}
```

### 13.2 AnimationFrame

```rust
pub struct AnimationFrame {
    pub index: usize,
    pub image_path: PathBuf,
    pub duration_ms: u32,
    pub anchor: AnchorPoint,
    pub bbox: BoundingBox,
    pub hitbox: Option<HitBox>,
    pub hurtbox: Option<HurtBox>,
}
```

### 13.3 动作类型

```rust
pub enum ActionKind {
    Idle,
    Walk,
    Run,
    Attack,
    Cast,
    Jump,
    Hurt,
    Death,
    Custom(String),
}
```

### 13.4 动画事件

```rust
pub struct AnimationEvent {
    pub frame_index: usize,
    pub event_type: String,
    pub payload: serde_json::Value,
}
```

可用于：

- 攻击命中帧
- 脚步声
- 施法特效
- 跳跃落地
- 死亡消失

---

## 14. 帧修复与质量检测

### 14.1 常见问题

- 帧间抖动
- 透明边缘闪烁
- 武器忽长忽短
- 脸部变化
- 颜色漂移
- 角色脚底线不一致
- 画布位置偏移

### 14.2 自动检测指标

可以先实现简单指标：

```text
BoundingBox 差异
Alpha 面积变化
主体中心点变化
主色分布差异
脚底 Y 坐标差异
画布边界溢出
```

### 14.3 修复方式

```text
统一 Anchor
统一画布
重新缩放
Alpha 阈值清理
边缘羽化
异常帧标记
人工重生成
```

### 14.4 UI 提示

在时间轴上标记异常帧：

```text
Frame 03：脚底偏移过大
Frame 05：主体面积变化异常
Frame 07：透明边缘残留
```

---

## 15. SpriteSheet 导出系统

### 15.1 导出类型

支持：

```text
PNG 序列
SpriteSheet PNG
Atlas JSON
Godot 导入包
Unity 导入包
Bevy Atlas JSON
Phaser JSON
```

### 15.2 SpriteSheet 布局

```rust
pub struct SpriteSheetConfig {
    pub frame_width: u32,
    pub frame_height: u32,
    pub columns: u32,
    pub padding: u32,
    pub spacing: u32,
    pub trim: bool,
}
```

### 15.3 Atlas JSON 示例

```json
{
  "character": "knight_001",
  "image": "knight_001_spritesheet.png",
  "frame_width": 128,
  "frame_height": 128,
  "animations": {
    "front_idle": {
      "fps": 8,
      "loop": true,
      "frames": [0, 1, 2, 3]
    },
    "front_walk": {
      "fps": 12,
      "loop": true,
      "frames": [4, 5, 6, 7, 8, 9]
    }
  }
}
```

---

## 16. Godot 导出设计

### 16.1 导出内容

建议导出：

```text
character.png
character_spritesheet.png
character_atlas.json
character_animations.json
character_metadata.json
```

Godot 专用可进一步导出：

```text
character.tres
character.tscn
AnimatedSprite2D 配置
SpriteFrames 资源
```

### 16.2 Godot 动画映射

```text
front_idle
front_walk
front_attack
side_idle
side_walk
side_attack
back_idle
back_walk
back_attack
```

### 16.3 碰撞 / 命中盒

对于角色，建议导出：

```text
hurtbox
hitbox
interaction_box
shadow_box
```

而不是只导出图片。

---

## 17. Rust / Tauri 工程结构

推荐目录：

```text
src-tauri/src/
├─ commands/
│  ├─ character_commands.rs
│  ├─ generation_commands.rs
│  └─ export_commands.rs
├─ core/
│  ├─ character.rs
│  ├─ animation.rs
│  ├─ spritesheet.rs
│  ├─ asset.rs
│  └─ project.rs
├─ ai/
│  ├─ provider.rs
│  ├─ prompt_builder.rs
│  ├─ task.rs
│  └─ result_parser.rs
├─ image_pipeline/
│  ├─ background_remove.rs
│  ├─ alpha_cleanup.rs
│  ├─ normalize.rs
│  ├─ crop.rs
│  ├─ resize.rs
│  └─ compose.rs
├─ animation/
│  ├─ frame_processor.rs
│  ├─ quality_check.rs
│  ├─ timeline.rs
│  └─ rig.rs
├─ export/
│  ├─ spritesheet_exporter.rs
│  ├─ godot_exporter.rs
│  ├─ unity_exporter.rs
│  └─ generic_json.rs
├─ storage/
│  ├─ asset_db.rs
│  ├─ cache.rs
│  └─ project_store.rs
└─ utils/
   ├─ image_hash.rs
   ├─ fs.rs
   └─ uuid.rs
```

---

## 18. AI Provider 模块设计

由于当前项目使用外部 AI 接口，建议做统一 Provider 抽象，避免绑定某个厂商。

### 18.1 Trait 设计

```rust
#[async_trait]
pub trait AiProvider {
    async fn generate_image(&self, request: GenerateImageRequest) -> Result<GenerateImageResponse>;
    async fn image_to_image(&self, request: ImageToImageRequest) -> Result<GenerateImageResponse>;
    async fn remove_background(&self, request: RemoveBgRequest) -> Result<RemoveBgResponse>;
}
```

### 18.2 GenerateImageRequest

```rust
pub struct GenerateImageRequest {
    pub prompt: String,
    pub negative_prompt: String,
    pub width: u32,
    pub height: u32,
    pub seed: Option<u64>,
    pub style: Option<String>,
    pub reference_image: Option<PathBuf>,
    pub metadata: serde_json::Value,
}
```

### 18.3 任务队列

AI 生成是耗时任务，需要任务队列：

```rust
pub struct GenerationTask {
    pub id: Uuid,
    pub task_type: GenerationTaskType,
    pub status: TaskStatus,
    pub progress: f32,
    pub input: serde_json::Value,
    pub output: Option<serde_json::Value>,
}
```

任务状态：

```text
Pending
Running
Succeeded
Failed
Cancelled
```

---

## 19. Prompt Builder 设计

### 19.1 Prompt 不应散落在 UI 中

所有 Prompt 生成应该集中到 Prompt Builder。

```text
CharacterConfig
↓
PromptTemplate
↓
Prompt
↓
AI Provider
```

### 19.2 Prompt 模板示例

```text
{style}, {body_type} {race} {class_type},
{hair_color} {hair_style},
wearing {armor},
holding {weapon},
{view},
full body,
game character sprite,
clean silhouette,
plain background
```

### 19.3 Negative Prompt 模板

```text
multiple characters,
extra limbs,
bad anatomy,
cropped body,
complex background,
text,
watermark,
low quality,
blurry,
inconsistent weapon
```

### 19.4 多视图 Prompt

Front：

```text
front view, standing pose, full body
```

Side：

```text
side view, standing pose, full body, same character design
```

Back：

```text
back view, standing pose, full body, same outfit and weapon
```

---

## 20. 项目文件格式

### 20.1 推荐结构

```text
character_project/
├─ project.character.json
├─ config/
│  └─ character_config.json
├─ raw/
│  ├─ front_raw.png
│  ├─ side_raw.png
│  └─ back_raw.png
├─ processed/
│  ├─ front_transparent.png
│  ├─ side_transparent.png
│  └─ back_transparent.png
├─ animations/
│  ├─ front_idle/
│  ├─ front_walk/
│  └─ front_attack/
├─ exports/
│  ├─ spritesheet.png
│  ├─ atlas.json
│  └─ godot/
└─ cache/
```

### 20.2 project.character.json 示例

```json
{
  "version": "1.0",
  "id": "character_knight_001",
  "name": "白发骑士",
  "config": "config/character_config.json",
  "views": [
    {
      "kind": "front",
      "path": "processed/front_transparent.png",
      "anchor": {"x": 64, "y": 112}
    }
  ],
  "animations": [
    {
      "name": "front_idle",
      "fps": 8,
      "frames": ["animations/front_idle/000.png"]
    }
  ]
}
```

---

## 21. UI 页面建议

### 21.1 角色生成页

功能：

- 属性选择
- Prompt 预览
- 模型/风格选择
- Seed 设置
- 多版本生成
- 一键去背景

### 21.2 多视图页

功能：

- Front / Side / Back 三视图
- 一致性检查
- 重生成某一视图
- 对齐脚底线
- 统一尺寸

### 21.3 动作生成页

功能：

- 选择动作
- 选择帧数
- 生成关键帧
- 时间轴预览
- 异常帧检测

### 21.4 SpriteSheet 导出页

功能：

- 选择动作
- 设置 FPS
- 设置排列方式
- 导出 PNG / JSON / Godot

### 21.5 素材库页

功能：

- 发型库
- 装备库
- 武器库
- 风格库
- Prompt 片段库
- LoRA / 模板库

---

## 22. 开源库建议

### 22.1 Rust 图像处理

```toml
image = "0.25"
imageproc = "0.25"
fast_image_resize = "4"
```

### 22.2 异步与任务

```toml
tokio = "1"
reqwest = "0.12"
serde = "1"
serde_json = "1"
uuid = "1"
anyhow = "1"
thiserror = "1"
```

### 22.3 本地数据库

```toml
rusqlite = "0.32"
```

或：

```toml
sled = "0.34"
```

### 22.4 文件监听

```toml
notify = "6"
```

### 22.5 图像相似度 / Hash

可自行实现基础 hash，也可以后期引入：

```text
img_hash
```

---

## 23. 推荐开发路线

### V1：角色生成 MVP

目标：能生成单角色透明 PNG。

功能：

```text
角色属性 UI
Prompt Builder
外部 AI 接口
去背景
透明 PNG 保存
项目文件保存
```

### V2：多视图角色

目标：生成 Front / Side / Back。

功能：

```text
多视图 Prompt
固定 Seed
参考图生成
三视图预览
脚底线对齐
一致性检查
```

### V3：基础动作帧

目标：生成 Idle / Walk / Attack PNG 序列。

功能：

```text
动作 Prompt 模板
关键帧生成
时间轴预览
帧规范化
异常帧标记
```

### V4：SpriteSheet 导出

目标：可直接进入游戏引擎。

功能：

```text
SpriteSheet 打包
Atlas JSON
Godot SpriteFrames
Unity slicing metadata
```

### V5：半自动 Rig

目标：提高动画一致性和复用性。

功能：

```text
关键点建议
骨骼编辑器
动作模板库
拆层辅助
```

### V6：完整角色生产线

目标：从角色配置到完整动画包。

```text
角色配置
↓
多视图生成
↓
动作生成
↓
去背景
↓
规范化
↓
帧修复
↓
SpriteSheet
↓
Godot/Unity/Bevy 导出
```

---

## 24. 风险与规避

### 24.1 AI 接口成本

风险：

- 动作帧生成调用次数多
- 多视图生成成本高
- 用户反复重生成导致费用不可控

规避：

- 任务预估消耗
- 低清草稿模式
- 批量确认后高清生成
- 本地缓存
- 重用 seed 与结果

### 24.2 一致性不足

规避：

- 固定 CharacterConfig
- 固定 Seed
- 使用参考图
- 多视图一致性检测
- 异常帧重生成

### 24.3 商用授权

规避：

- 外部 AI 接口明确商用条款
- 模型 / LoRA 授权记录
- 开源版本避免打包非商用模型
- 素材库条目保存 license 字段

### 24.4 自动 Rig 过难

规避：

- 不在 V1 承诺全自动 Rig
- 先做半自动骨骼建议
- 支持人工修正
- 保存 Rig 模板复用

---

## 25. 总结

角色生成系统的核心不是“生成一张好看的角色图”，而是构建一套完整的角色资产生产线。

最推荐的产品方向：

```text
可视化角色配置
+
AI 生成
+
自动去背景
+
多视图规范化
+
动作帧生成
+
SpriteSheet 导出
```

长期方向：

```text
AI 角色生成器
+
Aseprite 风格帧动画工具
+
Spine/Live2D 风格半自动 Rig
+
Godot/Unity 一键导出
```

最终用户真正需要的是：

```text
5 分钟得到一个能放进游戏引擎里的完整角色动画资源包
```
