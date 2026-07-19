import {
  Clock3,
  Grid3X3,
  List,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

import { AssetGridCard, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { CharacterLibraryRecord } from "../types";
import { resolveLibraryCardImage } from "../characterImageSrc";

interface CharacterAssetLibraryViewProps {
  error?: string;
  isLoading: boolean;
  onCreateNew: () => void;
  onDeleteRecord: (record: CharacterLibraryRecord) => void;
  onOpenRecord: (record: CharacterLibraryRecord) => void;
  onToggleFavorite: (record: CharacterLibraryRecord) => void;
  projectRoot: string;
  records: CharacterLibraryRecord[];
}

const characterFilters = [
  { icon: Sparkles, label: "全部角色", value: "all" },
  { icon: UserRound, label: "我的角色", value: "mine" },
  { icon: Clock3, label: "最近编辑", value: "recent" },
  { icon: Star, label: "收藏夹", value: "favorite" },
  { icon: Trash2, label: "回收站", value: "trash" },
] as const;

export function CharacterAssetLibraryView({
  error,
  isLoading,
  onCreateNew,
  onDeleteRecord,
  onOpenRecord,
  onToggleFavorite,
  projectRoot,
  records,
}: CharacterAssetLibraryViewProps) {
  const [activeFilter, setActiveFilter] = useState<(typeof characterFilters)[number]["value"]>("all");
  const [searchKeyword, setSearchKeyword] = useState("");
  const tagStats = getTagStats(records);
  const filteredRecords = useMemo(
    () => filterRecords(records, activeFilter, searchKeyword),
    [activeFilter, records, searchKeyword],
  );
  const activeFilterLabel = characterFilters.find((item) => item.value === activeFilter)?.label ?? "全部角色";

  return (
    <section className="character-library-view" aria-label="角色资产库">
      <aside className="character-library-sidebar">
        <Button className="character-create-tile" onClick={onCreateNew} type="button">
          <Plus aria-hidden="true" />
          <span>
            <strong>新建角色资产</strong>
            <small>AI 生成你的游戏角色</small>
          </span>
        </Button>

        <nav className="character-library-nav" aria-label="角色资产分类">
          {characterFilters.map((item) => {
            const Icon = item.icon;
            const count = getFilterCount(item.value, records);

            return (
              <button
                className={item.value === activeFilter ? "active" : ""}
                key={item.value}
                onClick={() => setActiveFilter(item.value)}
                type="button"
              >
                <Icon aria-hidden="true" size={17} />
                <span>{item.label}</span>
                <strong>{count}</strong>
              </button>
            );
          })}
        </nav>

        <section className="character-tag-panel">
          <header>
            <span>标签</span>
            <button aria-label="添加标签" type="button">
              <Plus aria-hidden="true" size={15} />
            </button>
          </header>
          {tagStats.length > 0 ? (
            <div className="character-tag-list">
              {tagStats.map((tag) => (
                <button key={tag.label} type="button">
                  <span style={{ "--tag-color": tag.color } as CSSProperties} />
                  {tag.label}
                  <strong>{tag.count}</strong>
                </button>
              ))}
            </div>
          ) : (
            <p>创建角色后会自动整理常用标签。</p>
          )}
        </section>
      </aside>

      <section className="character-library-main">
        <header className="character-asset-library-toolbar" aria-label="角色资产工具栏">
          <div className="character-asset-library-toolbar-title">
            <h2>
              {activeFilterLabel} <span>{filteredRecords.length}</span>
            </h2>
          </div>

          <label className="character-asset-library-toolbar-search">
            <Search aria-hidden="true" />
            <Input
              placeholder="搜索角色名称 / 标签"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
            />
          </label>

          <div className="character-asset-library-toolbar-filters">
            <Button type="button" variant="outline" size="sm">
              风格
            </Button>
            <Button type="button" variant="outline" size="sm">
              画布尺寸
            </Button>
            <Button type="button" variant="outline" size="sm">
              排序：最近更新
            </Button>
          </div>

          <div className="character-asset-library-toolbar-actions">
            <div className="character-view-switch">
              <button className="active" aria-label="网格视图" type="button">
                <Grid3X3 aria-hidden="true" size={17} />
              </button>
              <button aria-label="列表视图" type="button">
                <List aria-hidden="true" size={17} />
              </button>
            </div>
          </div>
        </header>

        <div className="character-library-content">
          {error ? <div className="character-library-error">{error}</div> : null}

          {isLoading ? (
            <div className="character-library-loading">正在读取角色资产...</div>
          ) : filteredRecords.length > 0 ? (
            <div className="character-card-grid">
              {filteredRecords.map((record, index) => (
                <CharacterAssetCard
                  index={index}
                  key={record.id}
                  onDeleteRecord={onDeleteRecord}
                  onOpenRecord={onOpenRecord}
                  onToggleFavorite={onToggleFavorite}
                  projectRoot={projectRoot}
                  record={record}
                />
              ))}
            </div>
          ) : (
            <CharacterEmptyState activeFilterLabel={activeFilterLabel} onCreateNew={onCreateNew} />
          )}
        </div>
      </section>
    </section>
  );
}

function CharacterAssetCard({
  index,
  onDeleteRecord,
  onOpenRecord,
  onToggleFavorite,
  projectRoot,
  record,
}: {
  index: number;
  onDeleteRecord: (record: CharacterLibraryRecord) => void;
  onOpenRecord: (record: CharacterLibraryRecord) => void;
  onToggleFavorite: (record: CharacterLibraryRecord) => void;
  projectRoot: string;
  record: CharacterLibraryRecord;
}) {
  const primaryTag = record.visualKeywords[0] ?? record.selectedPlanName;
  const cardImageUrl = resolveLibraryCardImage(projectRoot, record);

  return (
    <AssetGridCard
      className="character-asset-grid-card"
      deleteLabel={`删除 ${record.displayName}`}
      favorite={record.favorite}
      favoriteLabel={`收藏 ${record.displayName}`}
      meta={
        <>
          <span className="app-asset-grid-tag" data-tone="neutral">
            {record.size}
          </span>
          <span className="app-asset-grid-tag" data-tone="neutral">
            角色
          </span>
          {primaryTag ? (
            <span className="app-asset-grid-tag" data-tone={getAssetTagTone(primaryTag)}>
              {primaryTag}
            </span>
          ) : null}
        </>
      }
      openLabel={`打开 ${record.displayName}`}
      preview={
        cardImageUrl ? (
          <img
            alt={`${record.displayName} 母版图`}
            className="character-card-master-image rendering-pixelated"
            src={cardImageUrl}
          />
        ) : (
          <span className={`library-pixel-character variant-${(index % 6) + 1}`} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        )
      }
      timestamp={formatUpdateTime(record.updatedAt)}
      title={record.displayName}
      onDelete={() => onDeleteRecord(record)}
      onOpen={() => onOpenRecord(record)}
      onToggleFavorite={() => onToggleFavorite(record)}
    />
  );
}

function CharacterEmptyState({ activeFilterLabel, onCreateNew }: { activeFilterLabel: string; onCreateNew: () => void }) {
  return (
    <EmptyState
      className="character-empty-state"
      description="创建或切换角色筛选后，符合条件的角色会显示在这里。"
      eyebrow="角色资产库"
      icon={Sparkles}
      title={activeFilterLabel === "全部角色" ? "还没有角色资产" : `${activeFilterLabel}为空`}
      actions={
        <Button className="primary-action empty-create-button" onClick={onCreateNew} type="button">
          <Sparkles aria-hidden="true" />
          新建角色资产
        </Button>
      }
    >
      <span>支持 16bit / 32bit 像素风、PNG 序列帧和 Spritesheet 导出</span>
    </EmptyState>
  );
}

function getFilterCount(value: (typeof characterFilters)[number]["value"], records: CharacterLibraryRecord[]) {
  if (value === "all" || value === "mine") {
    return records.length;
  }

  if (value === "recent") {
    return Math.min(records.length, 8);
  }

  if (value === "favorite") {
    return records.filter((record) => record.favorite).length;
  }

  if (value === "trash") {
    return 0;
  }

  return records.length;
}

function filterRecords(
  records: CharacterLibraryRecord[],
  filter: (typeof characterFilters)[number]["value"],
  keyword: string,
) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  let filteredRecords = records;

  if (filter === "favorite") {
    filteredRecords = filteredRecords.filter((record) => record.favorite);
  } else if (filter === "recent") {
    filteredRecords = [...filteredRecords]
      .sort((first, second) => Number(second.updatedAt) - Number(first.updatedAt))
      .slice(0, 8);
  } else if (filter === "trash") {
    filteredRecords = [];
  }

  if (!normalizedKeyword) {
    return filteredRecords;
  }

  return filteredRecords.filter((record) => {
    const searchableText = [
      record.displayName,
      record.selectedPlanName,
      record.style,
      ...record.visualKeywords,
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(normalizedKeyword);
  });
}

function getAssetTagTone(label: string) {
  let hash = 0;

  for (let index = 0; index < label.length; index += 1) {
    hash = (hash + label.charCodeAt(index) * (index + 1)) % 9973;
  }

  return String(hash % 6);
}

function formatUpdateTime(value: string) {
  const timestamp = Number(value);

  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "刚刚更新";
  }

  const elapsedSeconds = Math.max(0, Math.floor(Date.now() / 1000) - timestamp);

  if (elapsedSeconds < 60) {
    return "刚刚更新";
  }

  if (elapsedSeconds < 3600) {
    return `${Math.floor(elapsedSeconds / 60)} 分钟前`;
  }

  if (elapsedSeconds < 86400) {
    return `${Math.floor(elapsedSeconds / 3600)} 小时前`;
  }

  return `${Math.floor(elapsedSeconds / 86400)} 天前`;
}

function getTagStats(records: CharacterLibraryRecord[]) {
  const colorList = ["#35d48b", "#ef4444", "#3b82f6", "#8b5cf6", "#f59e0b"];
  const counter = new Map<string, number>();

  for (const record of records) {
    const tag = record.visualKeywords[0] ?? record.selectedPlanName;
    counter.set(tag, (counter.get(tag) ?? 0) + 1);
  }

  return Array.from(counter.entries())
    .slice(0, 5)
    .map(([label, count], index) => ({
      color: colorList[index % colorList.length],
      count,
      label,
    }));
}

