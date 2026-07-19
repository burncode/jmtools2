import { useMemo, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { ImagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { createProject, listRecentProjects } from "../../lib/tauri/commands";
import type { PipelineProject, ProjectCategory, RecentProject } from "./types";
import { projectManifestFileName } from "./types";
import { projectCategories } from "./projectOptions";
import { normalizeSlug } from "./projectUtils";

interface NewProjectViewProps {
  onBack: () => void;
  onProjectCreated: (project: PipelineProject, recentProjects: RecentProject[]) => void;
}

export function NewProjectView({ onBack, onProjectCreated }: NewProjectViewProps) {
  const [projectName, setProjectName] = useState("幻想地牢素材库");
  const [projectSlug, setProjectSlug] = useState("fantasy_dungeon_assets");
  const [category, setCategory] = useState<ProjectCategory>("2dRpg");
  const [tagInput, setTagInput] = useState("像素风, 奇幻, 俯视角, 原型阶段");
  const [description, setDescription] = useState("用于像素风 RPG 原型的角色、地图、图集和音频素材流水线。");
  const [rootPath, setRootPath] = useState("D:\\JMTools\\Projects");
  const [coverImageSource, setCoverImageSource] = useState("");
  const [createStatus, setCreateStatus] = useState<"idle" | "creating" | "success" | "error">("idle");
  const [createMessage, setCreateMessage] = useState("");

  const tags = useMemo(
    () =>
      tagInput
        .split(/[,，\n]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tagInput],
  );

  const projectPathPreview = useMemo(() => {
    const basePath = rootPath.trim() || "未选择目录";
    const slug = projectSlug.trim() || "project_id";

    return `${basePath}\\${slug}`;
  }, [projectSlug, rootPath]);

  const categoryLabel = projectCategories.find((item) => item.value === category)?.label ?? "其他";
  const coverPreviewSrc = coverImageSource ? convertFileSrc(coverImageSource) : "";

  const handleProjectNameChange = (value: string) => {
    setProjectName(value);

    if (!projectSlug || projectSlug === normalizeSlug(projectName)) {
      setProjectSlug(normalizeSlug(value));
    }
  };

  const handleSelectProjectDirectory = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: "选择项目存储位置",
      });

      if (typeof selectedPath === "string") {
        setRootPath(selectedPath);
        setCreateStatus("idle");
        setCreateMessage("");
      }
    } catch (error) {
      setCreateStatus("error");
      setCreateMessage(error instanceof Error ? error.message : "当前环境无法打开系统目录选择器。");
    }
  };

  const handleSelectCoverImage = async () => {
    try {
      const selectedPath = await open({
        directory: false,
        filters: [
          {
            extensions: ["png", "jpg", "jpeg", "webp"],
            name: "图片文件",
          },
        ],
        multiple: false,
        title: "选择项目封面图",
      });

      if (typeof selectedPath === "string") {
        setCoverImageSource(selectedPath);
        setCreateStatus("idle");
        setCreateMessage("");
      }
    } catch (error) {
      setCreateStatus("error");
      setCreateMessage(error instanceof Error ? error.message : "当前环境无法打开系统文件选择器。");
    }
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      setCreateStatus("error");
      setCreateMessage("项目名称不能为空。");
      return;
    }

    if (!projectSlug.trim()) {
      setCreateStatus("error");
      setCreateMessage("项目标识不能为空。");
      return;
    }

    if (!rootPath.trim()) {
      setCreateStatus("error");
      setCreateMessage("请选择项目存储位置。");
      return;
    }

    setCreateStatus("creating");
    setCreateMessage("正在创建项目...");

    try {
      const project = await createProject({
        category,
        coverImageSource: coverImageSource || undefined,
        description,
        name: projectName,
        rootPath,
        slug: projectSlug,
        tags,
      });

      setCreateStatus("success");
      setCreateMessage(`项目已创建：${project.rootPath}`);
      onProjectCreated(project, await listRecentProjects());
    } catch (error) {
      setCreateStatus("error");
      setCreateMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <section className="workspace create-workspace" id="workspace">
      <header className="topbar">
        <div>
          <p className="eyebrow">新建项目</p>
          <h2>创建游戏资产项目</h2>
        </div>
        <div className="topbar-actions" aria-label="新建项目操作">
          <Button onClick={onBack} type="button" variant="outline">
            返回首页
          </Button>
          <Button className="primary-action" disabled={createStatus === "creating"} onClick={handleCreateProject} type="button">
            {createStatus === "creating" ? "创建中..." : "创建项目"}
          </Button>
        </div>
      </header>

      <section className="create-project-layout">
        <form
          className="project-form"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreateProject();
          }}
        >
          <section className="form-section">
            <div>
              <p className="panel-label">项目信息</p>
              <h3>基础信息</h3>
            </div>

            <label className="field-group">
              <span>项目名称 *</span>
              <Input maxLength={50} onChange={(event) => handleProjectNameChange(event.currentTarget.value)} value={projectName} />
            </label>

            <label className="field-group">
              <span>项目标识 *</span>
              <Input maxLength={30} onChange={(event) => setProjectSlug(normalizeSlug(event.currentTarget.value))} value={projectSlug} />
              <small>用于目录名和资源命名，只允许小写字母、数字、短横线和下划线。</small>
            </label>

            <label className="field-group">
              <span>项目分类 *</span>
              <select className="native-select" onChange={(event) => setCategory(event.currentTarget.value as ProjectCategory)} value={category}>
                {projectCategories.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group">
              <span>项目标签</span>
              <Input onChange={(event) => setTagInput(event.currentTarget.value)} value={tagInput} />
              <small>使用逗号分隔，例如：像素风, 奇幻, 横版, 原型阶段。</small>
            </label>

            <label className="field-group">
              <span>项目描述</span>
              <Textarea maxLength={200} onChange={(event) => setDescription(event.currentTarget.value)} value={description} />
            </label>

            <label className="field-group">
              <span>存储位置 *</span>
              <div className="path-row">
                <Input onChange={(event) => setRootPath(event.currentTarget.value)} value={rootPath} />
                <Button onClick={handleSelectProjectDirectory} type="button" variant="outline">
                  选择目录
                </Button>
              </div>
              <small>选择父目录后，JMTools 会在其中创建以项目标识命名的项目文件夹。</small>
            </label>
          </section>

          <section className="form-section">
            <div>
              <p className="panel-label">项目封面</p>
              <h3>封面图</h3>
            </div>
            <div className="cover-picker">
              <button className="cover-picker-preview" onClick={handleSelectCoverImage} type="button">
                {coverPreviewSrc ? <img alt="项目封面预览" src={coverPreviewSrc} /> : <ImagePlus aria-hidden="true" size={34} />}
              </button>
              <div>
                <strong>{coverImageSource ? "已选择封面图" : "未选择封面图"}</strong>
                <p>{coverImageSource || "可以稍后在项目工作台中编辑封面。"}</p>
                <Button onClick={handleSelectCoverImage} type="button" variant="outline">
                  选择封面
                </Button>
              </div>
            </div>
          </section>

          {createMessage ? <p className={`form-message ${createStatus}`}>{createMessage}</p> : null}
        </form>

        <aside className="project-preview" aria-label="项目预览">
          <p className="panel-label">项目预览</p>
          <div className="preview-cover">
            {coverPreviewSrc ? <img alt="" src={coverPreviewSrc} /> : null}
            <div className="preview-sky" />
            <div className="preview-grid" />
            <strong>{projectSlug || "project_id"}</strong>
          </div>

          <dl>
            <div>
              <dt>项目名称</dt>
              <dd>{projectName || "-"}</dd>
            </div>
            <div>
              <dt>项目标识</dt>
              <dd>{projectSlug || "-"}</dd>
            </div>
            <div>
              <dt>项目分类</dt>
              <dd>{categoryLabel}</dd>
            </div>
            <div>
              <dt>项目标签</dt>
              <dd>{tags.join("、") || "-"}</dd>
            </div>
            <div>
              <dt>存储位置</dt>
              <dd>{projectPathPreview}</dd>
            </div>
          </dl>

          <section className="directory-preview">
            <p className="panel-label">将创建的目录</p>
            <code>
              {projectSlug || "project_id"}/
              <br />
              ├─ {projectManifestFileName}
              <br />
              ├─ project/cover.*
              <br />
              ├─ assets/images
              <br />
              ├─ assets/sprites
              <br />
              ├─ assets/tiles
              <br />
              ├─ assets/audio
              <br />
              ├─ generated
              <br />
              ├─ exports
              <br />
              └─ cache
            </code>
          </section>
        </aside>
      </section>
    </section>
  );
}
