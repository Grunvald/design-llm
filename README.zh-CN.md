# baoyu-design

**在你自己的本地 Agent 上运行 Claude Design —— Cursor、Claude Code、Claude Desktop，或任何能读写文件的编码 Agent。**

[English](README.md) · [简体中文](README.zh-CN.md) · [更新日志](CHANGELOG.md)

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg) ![Best with Opus 4.8](https://img.shields.io/badge/Best%20with-Opus%204.8-d97757) ![Harness](https://img.shields.io/badge/Cursor%20%C2%B7%20Claude%20Code%20%C2%B7%20Codex-supported-1f6feb)

`baoyu-design` 把 **Claude Design**（[claude.ai/design](https://claude.ai/design) 背后的设计引擎）打包成一个可移植的 **Agent Skill（技能）**。把它放进本地 Agent，你就能在自己的编辑器里获得这个网站绝大部分的能力：精致的 UI 稿、可交互原型、线框图、落地页、仪表盘、移动 App、幻灯片 —— 全部以「自包含 HTML」的形式产出。

不依赖网站，不需要额外订阅，也不用上传。活儿由你机器上已有的 Agent 完成，所有产物都留在你自己的仓库里。

---

## 截图

Cursor、Codex、Claude 和 Claude Design 使用的是同一个 Reader Mac App Prompt。

| Cursor | Codex | Claude | Claude Design |
|---|---|---|---|
| <img src="assets/screenshots/cursor-reader-mac-app.webp" alt="Cursor 运行 baoyu-design" width="240"> | <img src="assets/screenshots/codex-reader-mac-app.webp" alt="Codex 运行 baoyu-design" width="240"> | <img src="assets/screenshots/claude-reader-mac-app.webp" alt="Claude 运行 baoyu-design" width="240"> | <img src="assets/screenshots/claude-design-reader-mac-app.webp" alt="Claude Design 使用同一 Reader Mac App Prompt 的效果" width="240"> |

<details>
<summary>展开查看共同使用的 Prompt</summary>

```markdown
帮我开发一款Reader Mac App，帮助我更好的阅读和收藏文章。数据都在本地。

## 信息采集

1. 主动添加
可以手动添加不同类型的信息：
- URL：输入 URL，自动抓取内容和图片
- 附件：上传PDF、视频、图片
- Markdown 编辑：类似于发布博客，输入标题、内容、发布图片
- 其他

2. 自动订阅
- RSS 订阅
- 社交媒体账号：X、微博、YouTube
- 其他

## 信息编辑和分类

1. 标签
每条内容都可以打标签

2. 分类、目录
可以创建树形目录，可以把内容放到不同的分类

3. 收藏
可以点击收藏

4. 编辑
每一条内容都可以编辑，有个内置的Markdown编辑

## AI 辅助

1. 自动翻译
可以支持不同语言的翻译

2. 总结和摘要
可以去对抓取了的内容进行摘要

3. 二次创作
可以基于一条或者多条内容进行二次创作

4. 集成 AI Chat

可以通过 AI Chat 去调用 AI Agent 辅助对内容进行处理
```

</details>

---

## 为什么在本地跑

- **摆脱对网站的依赖。** 不必离开编辑器，就能用上 `claude.ai/design` 绝大部分的功能 —— 同一套方法论、同样的工艺标准、同样的产出格式。
- **搭配 Opus 4.8 效果最佳。** 这个技能本身是一份冗长且要求很高的设计指令，模型越强、效果越好。建议搭配 **Claude Opus 4.8** 获得最佳结果；在其他能力足够的模型上也能良好运行。
- **用「指」代替「描述」来迭代。** 因为产物就是跑在 `localhost` 上的普通 HTML，你可以充分借助 Agent 自带的网页预览与元素标注能力（Cursor Browser / DevTools、Claude Preview 或 Codex Browser）：在实时预览里直接点选某个按钮，说出想改成什么，Agent 就会去改对应的源码 —— 这是一条紧凑、可视化的「二次编辑」回路，在网站上很难做到。
- **一切都归你所有。** 产物会落到 `designs/<项目名>/` 目录下，是可以纳入版本控制、二次分叉、导出或直接上线的自包含 HTML。

---

## 它能做什么

这个技能会驱动一套完整的设计流程 —— 先问澄清问题 → 收集设计上下文 → 产出一个或多个 HTML 交付物 → 预览并校验。它内置了 **24 个子技能**，外加一组开箱即用的组件脚手架。

| 类别 | 内置子技能 |
|---|---|
| **核心设计** | 高保真设计 · 可交互原型 · 线框图 · 前端美学方向 |
| **幻灯片** | 制作演示文稿 · 演讲者备注 |
| **移动与动效** | 移动端原型 · 动画视频 · 音效 |
| **设计系统** | 创建设计系统 · 设计组件（`.dc.html`）· 可调参数化 |
| **导出与交付** | 独立 HTML · PDF · PPTX（可编辑）· PPTX（截图）· 导出到 Figma · 导出到 Canva · 交接给 Claude Code |
| **AI 素材与集成** | Gemini 图像生成 · 在原型中调用 Claude · 读取 PDF |

**起步组件**（位于 [`starter-components/`](skills/baoyu-design/starter-components/)）让 Agent 不必从零手搓基础件：iOS / Android / macOS / 浏览器外壳、可平移缩放的设计画布、幻灯片舞台、时间轴动画引擎、参数调节面板，以及可填充的图片占位槽。

---

## 工作原理

整个技能就是纯 Markdown 加几个 JSX/JS 脚手架 —— 无需构建、无需运行时。

```
skills/baoyu-design/
├── SKILL.md              # 入口 —— 编排整个流程
├── system-prompt.md      # 设计方法论与工艺标准（唯一事实来源）
├── references/
│   ├── claude.md         # Claude Code 的工具映射
│   ├── cursor.md         # Cursor 的工具映射
│   └── codex.md          # Codex Agent 的工具映射
├── built-in-skills/      # 专项子技能（幻灯片、移动端、导入、导出……）
└── starter-components/   # 设备外壳、幻灯片舞台、画布、动画引擎……
```

当你提出设计需求时，Agent 会读取 `SKILL.md`，从 `system-prompt.md` 加载核心方法论，判断自己运行在 Cursor、Claude Code、Codex Agent，还是一个通用的可读写文件 harness；如果有匹配的参考文档，就读取对应文档，然后只按需载入这次任务用得到的子技能。这种拆分让「工艺规则」与具体 Agent 无关，而每个环境各自去解析自己的工具来完成「提问」「预览」「截图」「校验」。

---

## 快速开始

### 前置条件

- 一个本地 Agent —— **[Cursor](https://cursor.com)**、**[Claude Code](https://claude.com/claude-code)**、**[Codex](https://developers.openai.com/codex/)**，或安装器支持的其余 70+ 个 Agent（Cline、Roo Code、GitHub Copilot……）。其中 Cursor、Claude Code 与 Codex 在技能里内置了一等的工具参考文档。
- 模型选择 **Claude Opus 4.8**，效果最佳。
- **Node.js**（用于运行下面的 `npx` 安装器）。另外备一个 **Python 3** 跑本地预览服务器会很方便。

### 安装

**推荐方式 —— `skills` CLI。** [`npx skills`](https://github.com/vercel-labs/skills)（来自 Vercel Labs）会读取本仓库，找到 `skills/baoyu-design/`，并把它放进所检测到的 Agent 对应的目录里：

```bash
# 安装到当前项目（自动检测你的 Agent）
npx skills add JimLiu/baoyu-design

# …或全局安装，对所有项目生效
npx skills add JimLiu/baoyu-design -g

# 指定某个具体的 Agent
npx skills add JimLiu/baoyu-design --agent claude-code
npx skills add JimLiu/baoyu-design --agent cursor
npx skills add JimLiu/baoyu-design --agent codex

# 先列出仓库里有哪些技能
npx skills add JimLiu/baoyu-design --list
```

它会把技能装到 Claude Code 的 `.claude/skills/`，以及 Cursor/Codex 风格 Agent 的 `.agents/skills/`（加上 `-g` 则装到 `~/` 级别的用户目录）。

**备选方式 —— 直接把仓库 URL 发给 Agent。** 不想安装任何东西？把链接贴进对话，让 Agent 自己去拉取技能：

> 阅读 https://github.com/JimLiu/baoyu-design 并按照其中的 `skills/baoyu-design/SKILL.md`，帮我设计一个冥想 App 的设置页面。

Agent 会 clone 或抓取该仓库、加载 `SKILL.md` 然后开干 —— 临时用一次特别合适。

### 开始使用

技能装好（或被抓取）之后，直接用自然语言描述设计任务即可 —— 它会根据自身描述自动激活：

> 帮我设计一个冥想 App 设置页面的 3 个高保真方案。

在 Claude Code 里你也可以用 `/baoyu-design` 显式触发；在 Codex 里，如果 Skills 可用，可以提到 `$baoyu-design`。Agent 会问几个澄清问题、在 `designs/` 下生成 HTML，并通过 `localhost` 预览。**在实时预览里点选任意元素，说出想改成什么** —— Agent 就会去改对应源码，完成一次快速、可视化的二次编辑。

### 预览服务器

交付物通过 HTTP 预览（多文件原型无法从 `file://` 加载）。通常 Agent 会自动帮你起服务；若要手动运行：

```bash
python3 -m http.server 4311 --directory designs
# 然后打开 http://localhost:4311/<项目名>/<文件名>.html
```

---

## 设计系统

除了一次性的设计稿，这个技能还能让整个项目都遵循某个**设计系统** —— 也就是把一个品牌的 token、字体、组件和完整 UI Kit 打包成的、带版本的产物。设计系统和你的项目一起放在 `designs/` 下：你可以用**创建设计系统**子技能自己做一个，也可以直接放入一个现成的。系统一旦存在，下面两条流程就能让任意项目使用它。

### 导入现有设计系统

当你开始一个设计时，Agent 会先问你**保存到哪里**以及**使用哪个（些）设计系统** —— 它会发现 `designs/` 下的所有系统并列出来，你可以一个都不选（自由设计）、选一个，或选多个。如果一上来就点名某个系统，它会跳过这一步：

> 用 **Fluent 2** 设计系统，帮我设计一个设置页面。

对于你选中的每个系统，Agent 会把一份**自包含、锁定版本的副本**同步到项目里的 `_ds/<slug>/`，把它的 CSS 和组件 bundle 接入页面，并把这次绑定记录到项目的 `_d_meta.json` 里。正是这份本地副本让项目可移植、可复现 —— 不引用文件夹之外的任何东西；之后想拉取更新，重新跑一次导入即可。如果你选了多个系统，其中一个会成为**主系统** —— 它决定整体观感，并在 token 冲突时胜出，其余系统则贡献各自的特定组件。

### 使用已导入的设计系统

系统一旦绑定，它就是一份**具有约束力的视觉契约**，而非可有可无的建议：每个页面都用系统里真实的 token、字体、间距和组件来搭建，Agent 不会自创系统之外的颜色或样式。如果系统自带**起始点**（现成的页面或组件），你还可以从中挑一个作为种子，而不必从空白开始。

这份绑定会跟着项目走。之后再打开它，Agent 会读取 `_d_meta.json`、重新加载该系统，继续按同样的风格设计 —— 无需再次挑选。在此基础上，你可以**刷新**某个系统以拉取更新、**新增**另一个、**切换**主系统，或者把某个系统整个**移除**。

---

## 示例 Prompt

- *「用这张截图里的品牌风格，设计 3 个高保真的定价页方案。」*
- *「做一个可以真正交互的引导流程原型 —— 要有真实状态、过渡动画、表单校验。」*
- *「根据这份 PRD 做一套 10 页的幻灯片，用于工程全员会。」*
- *「为一个移动端记账 App 的首页画几个布局线框方案。」*
- *「照着这个代码库复刻 composer 的 UI，然后导出成独立 HTML。」*
- *「用我们的设计系统做一个仪表盘，从它自带的分析页起步。」*

想要最好的效果，**请给它设计上下文** —— 截图、UI Kit、Figma 链接或代码库。从真实上下文出发，是对质量影响最大的一个杠杆；如果你不提供，技能也会主动向你索要。

---

## 致谢与许可

本项目把 **Anthropic** 出品、驱动 [claude.ai/design](https://claude.ai/design) 的设计技能 **Claude Design** 重新打包，使其得以在本地 Agent 上运行。这是一个独立的社区项目，与 Anthropic 无隶属或背书关系。

由 **Jim Liu 宝玉** 重新打包并维护。基于 [MIT 许可证](LICENSE) 发布。
