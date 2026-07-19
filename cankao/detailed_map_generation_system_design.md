
# 地图生成系统设计文档 - AI 游戏素材生成工具

## 1. 产品定位
本模块目标是为独立游戏开发者提供**可自动生成、可编辑、可碰撞、可导出的结构化地图资源**，可直接导入 Godot、Tiled 或其他引擎。AI 仅负责提供规则、模板和局部素材生成，不直接生成最终 PNG 地图。

### 功能目标
- 自动化地图布局生成
- 支持多层地图（地形层、装饰层、对象层、碰撞层）
- 资源库管理与自动拼接
- 碰撞生成与导出
- Godot / Tiled 导出兼容
- AI辅助生成地图规则与素材

## 2. 总体架构

前端 (Tauri UI)
- 地图编辑面板
- 图块/对象资源库
- 碰撞编辑工具
- 导出控制

后端 (Rust Core Engine)
- MapCore 数据模型
- Map Generator
  - Layout Generator
  - Terrain Generator
  - Biome Generator
  - Object Generator
  - Road/River Generator
- Tile Mapper / AutoTile 系统
- 碰撞处理
- AI接口调用模块
- 图像处理流水线 (image/imageproc)
- 导出模块 (Godot/Tiled/JSON)

## 3. 数据模型设计

### 3.1 MapProject
```rust
struct MapProject {
    id: Uuid,
    name: String,
    width: usize,
    height: usize,
    tile_size: usize,
    tilesets: Vec<Tileset>,
    layers: Vec<Layer>,
    objects: Vec<GameObject>,
    collisions: Vec<CollisionLayer>,
    metadata: MapMetadata,
}
```

### 3.2 Layer
```rust
struct Layer {
    id: Uuid,
    name: String,
    kind: LayerKind, // Terrain | Decoration | Object | Collision
    visible: bool,
    opacity: f32,
    tiles: Vec<TileCell>,
}
```

### 3.3 TileCell
```rust
struct TileCell {
    x: usize,
    y: usize,
    tile_id: String,
    tileset_id: String,
    flip_x: bool,
    flip_y: bool,
    rotation: u8,
    properties: HashMap<String, String>,
}
```

### 3.4 CollisionLayer / CollisionShape
```rust
struct CollisionLayer {
    id: Uuid,
    name: String,
    shapes: Vec<CollisionShape>
}

enum CollisionShape {
    Rect(Rect),
    Polygon(Vec<Vec2>),
    Circle(Circle),
}
```

## 4. 地图生成模块

### 4.1 Layout Generator
- 区域划分
- 主城、村庄、河流、道路布局
- 算法支持：petgraph、pathfinding (A*)、delaunator

### 4.2 Terrain Generator
- 生成高度图、湿度图、温度图
- 输出 biome map
- 算法支持：noise-rs (Perlin/Simplex/FBM)

### 4.3 Object Generator
- 树木、石头、建筑、宝箱、NPC
- AI辅助生成建筑/装饰纹理
- 放置规则：随机/策略/模板

### 4.4 Tile Mapper / AutoTile
- 根据区域和地形 mask 选择正确 tile
- 支持 Wang Tile 或 Godot Terrain Set
- 生成边缘、角落、中心 tile

### 4.5 道路与河流生成器
- 自动保证连通性
- 支持道路宽度、曲线、桥梁
- 河流可生成 Tile 和碰撞层

### 4.6 AI地图规划器
- 接受用户输入的模板/描述
- 返回结构化规则：区域类型、尺寸、特殊建筑/功能
- AI只输出模板/规则，不生成最终图块

### 4.7 AI地图素材生成
- 根据模板生成局部纹理、建筑、装饰
- 可直接加入 tileset 库或对象库

## 5. 碰撞系统

- Tile碰撞：由 tileset metadata 定义 walkable 或 collision shape
- Object碰撞：建筑、树木等独立碰撞体
- Region碰撞：大面积水域、悬崖
- 碰撞层可多层叠加
- 导出时同步到 Godot TileMap 或 Tiled JSON

## 6. 资源管理

### 6.1 Tile资源
- 基础地形 tile：Grass、Water、Road、Snow 等
- AutoTile 属性 + tags + collision shape

### 6.2 Object资源
- 树、石头、篱笆、灯等
- 每个对象带碰撞属性

### 6.3 Building资源
- 房屋、商店、城堡
- 包含层级、碰撞、出口/入口 metadata

### 6.4 Biome资源
- Forest、Snow、Desert、Swamp
- 可影响 Terrain Generator 输出

### 6.5 Template资源
- 港口小镇、地下迷宫、雪地村庄、兽人营地
- 作为 AI 输入模板使用

## 7. 导出方案

### Godot
- tileset.png
- tileset.tres
- map.tscn
- collision.json
- metadata.json

### Tiled
- TMX / JSON
- PNG tileset

### 自定义引擎
- JSON + SpriteSheet / 图块元数据

## 8. 开源库/工具参考

- Rust图像处理: `image`, `imageproc`, `fast_image_resize`
- AI推理: `onnxruntime`, Python sidecar (可选)
- 地图算法: `noise-rs`, `petgraph`, `pathfinding`, `delaunator`
- Tile规则: Godot Terrain Set, Tiled Wang Tile
- 序列化: `serde` / `serde_json`

## 9. 推荐开发路线

1. MapCore + TileMap编辑器 + 碰撞系统 + Tiled JSON导出
2. 图块集管理 + AutoTile + 地形规则
3. AI地图规划器：生成模板/规则/布局
4. AI素材生成器：生成局部纹理/建筑/装饰
5. Godot导出器 + 插件支持
6. 完整流水线：AI生成模板 → Map Generator → TileMap → 导出可直接使用的游戏资源
