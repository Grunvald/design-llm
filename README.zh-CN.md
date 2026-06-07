# baoyu-design

**在你自己的本地 Agent 上运行 Claude Design —— Cursor、Claude Code、Claude Desktop，或任何能读写文件的编码 Agent。**

[English](README.md) · [简体中文](README.zh-CN.md)

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg) ![Best with Opus 4.8](https://img.shields.io/badge/Best%20with-Opus%204.8-d97757) ![Harness](https://img.shields.io/badge/Cursor%20%C2%B7%20Claude%20Code-supported-1f6feb)

`baoyu-design` 把 **Claude Design**（[claude.ai/design](https://claude.ai/design) 背后的设计引擎）打包成一个可移植的 **Agent Skill（技能）**。把它放进本地 Agent，你就能在自己的编辑器里获得这个网站绝大部分的能力：精致的 UI 稿、可交互原型、线框图、落地页、仪表盘、移动 App、幻灯片 —— 全部以「自包含 HTML」的形式产出。

不依赖网站，不需要额外订阅，也不用上传。活儿由你机器上已有的 Agent 完成，所有产物都留在你自己的仓库里。

---

## 为什么在本地跑

- **摆脱对网站的依赖。** 不必离开编辑器，就能用上 `claude.ai/design` 绝大部分的功能 —— 同一套方法论、同样的工艺标准、同样的产出格式。
- **搭配 Opus 4.8 效果最佳。** 这个技能本身是一份冗长且要求很高的设计指令，模型越强、效果越好。建议搭配 **Claude Opus 4.8** 获得最佳结果；在其他能力足够的模型上也能良好运行。
- **用「指」代替「描述」来迭代。** 因为产物就是跑在 `localhost` 上的普通 HTML，你可以充分借助 Agent 自带的网页预览与元素标注能力（例如 Cursor 的浏览器 / DevTools）：在实时预览里直接点选某个按钮，说出想改成什么，Agent 就会去改对应的源码 —— 这是一条紧凑、可视化的「二次编辑」回路，在网站上很难做到。
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
│   └── cursor.md         # Cursor 的工具映射
├── built-in-skills/      # 24 个专项子技能（幻灯片、移动端、导出……）
└── starter-components/   # 设备外壳、幻灯片舞台、画布、动画引擎……
```

当你提出设计需求时，Agent 会读取 `SKILL.md`，从 `system-prompt.md` 加载核心方法论，判断自己运行在 Cursor 还是 Claude Code 并读取对应的参考文档，然后只按需载入这次任务用得到的子技能。这种拆分让「工艺规则」与具体 Agent 无关，而每个环境各自去解析自己的工具来完成「提问」「预览」「截图」「校验」。

---

## 快速开始

### 前置条件

- 一个本地 Agent —— **[Cursor](https://cursor.com)**、**[Claude Code](https://claude.com/claude-code)**，或安装器支持的其余 70+ 个 Agent（Codex、Cline、Roo Code、GitHub Copilot……）。其中 Cursor 与 Claude Code 在技能里内置了一等的工具参考文档。
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

# 先列出仓库里有哪些技能
npx skills add JimLiu/baoyu-design --list
```

它会把技能装到 Claude Code 的 `.claude/skills/`、Cursor 的 `.agents/skills/`（加上 `-g` 则装到 `~/` 级别的用户目录）。

**备选方式 —— 直接把仓库 URL 发给 Agent。** 不想安装任何东西？把链接贴进对话，让 Agent 自己去拉取技能：

> 阅读 https://github.com/JimLiu/baoyu-design 并按照其中的 `skills/baoyu-design/SKILL.md`，帮我设计一个冥想 App 的设置页面。

Agent 会 clone 或抓取该仓库、加载 `SKILL.md` 然后开干 —— 临时用一次特别合适。

### 开始使用

技能装好（或被抓取）之后，直接用自然语言描述设计任务即可 —— 它会根据自身描述自动激活：

> 帮我设计一个冥想 App 设置页面的 3 个高保真方案。

在 Claude Code 里你也可以用 `/baoyu-design` 显式触发。Agent 会问几个澄清问题、在 `designs/` 下生成 HTML，并通过 `localhost` 预览。**在实时预览里点选任意元素，说出想改成什么** —— Agent 就会去改对应源码，完成一次快速、可视化的二次编辑。

### 预览服务器

交付物通过 HTTP 预览（多文件原型无法从 `file://` 加载）。通常 Agent 会自动帮你起服务；若要手动运行：

```bash
python3 -m http.server 4311 --directory designs
# 然后打开 http://localhost:4311/<项目名>/<文件名>.html
```

---

## 示例 Prompt

- *「用这张截图里的品牌风格，设计 3 个高保真的定价页方案。」*
- *「做一个可以真正交互的引导流程原型 —— 要有真实状态、过渡动画、表单校验。」*
- *「根据这份 PRD 做一套 10 页的幻灯片，用于工程全员会。」*
- *「为一个移动端记账 App 的首页画几个布局线框方案。」*
- *「照着这个代码库复刻 composer 的 UI，然后导出成独立 HTML。」*

想要最好的效果，**请给它设计上下文** —— 截图、UI Kit、Figma 链接或代码库。从真实上下文出发，是对质量影响最大的一个杠杆；如果你不提供，技能也会主动向你索要。

---

## 致谢与许可

本项目把 **Anthropic** 出品、驱动 [claude.ai/design](https://claude.ai/design) 的设计技能 **Claude Design** 重新打包，使其得以在本地 Agent 上运行。这是一个独立的社区项目，与 Anthropic 无隶属或背书关系。

由 **Jim Liu 宝玉** 重新打包并维护。基于 [MIT 许可证](LICENSE) 发布。
