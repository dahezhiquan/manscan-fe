# manscan-fe

ManScan 漏洞扫描引擎配套前端项目，当前用于承载模板库、漏洞看板、扫描任务创建与扫描结果查看等核心界面。仓库基于 `Vue 3` 和 `Vite` 构建，默认通过前端代理与本地 `8686` 端口的后端服务联调。  
如果你是第一次接手这个仓库，建议先阅读本文的“快速开始”和“开发规范”章节，再结合 [`SERVER_API.md`](./SERVER_API.md) 与 [`FE_API.md`](./FE_API.md) 进行接口开发。

## 目录

- [📦 项目简介](#-项目简介)
- [🚀 快速开始](#-快速开始)
- [🧰 技术栈](#-技术栈)
- [🧱 目录结构](#-目录结构)
- [🛠️ 开发规范](#-开发规范)
- [🔌 接口联调说明](#-接口联调说明)
- [❓ 常见问题](#-常见问题)

## 📦 项目简介

当前仓库提供的是 ManScan 的前端单页应用，围绕漏洞扫描场景组织页面与交互。  
从现有代码看，项目已覆盖以下主要能力：

- 首页与多类安全数据看板展示
- 模板库列表、模板筛选与模板详情查看
- 扫描任务创建、任务详情、日志流与历史日志查看
- 漏洞与资产相关的可视化卡片展示

项目采用手写轻量路由方式管理页面切换，不依赖 `vue-router`。接口调用统一收敛在 `src/api` 与 `src/utils/http.js`，便于前后端联调和后续维护。

## 🚀 快速开始

### 前置条件

- Node.js：仓库未通过 `package.json` 显式限制版本，建议使用较新的 LTS 版本
- npm：仓库当前提交了 `package-lock.json`，推荐直接使用 `npm`
- 后端服务：如需联调接口，请确保后端服务运行在 `http://localhost:8686`

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
npm run dev
```

启动后默认访问地址为：

```text
http://localhost:5173
```

当前 `Vite` 开发服务器配置了 `/api` 代理，请求会转发到：

```text
http://localhost:8686
```

### 构建生产包

```bash
npm run build
```

构建产物输出到 `dist/` 目录。

### 本地预览构建结果

```bash
npm run preview
```

### 推荐上手顺序

1. 安装依赖并启动前端开发服务。
2. 如需联调，确认后端接口已按 [`SERVER_API.md`](./SERVER_API.md) 启动。
3. 对照 [`FE_API.md`](./FE_API.md) 查看前端当前实际使用的接口。
4. 修改页面或接口后，按 [`CODE_STYLE.md`](./CODE_STYLE.md) 逐项自检。

## 🧰 技术栈

- `Vue 3`
  用于构建页面与组件，当前代码以 Composition API 和 `script setup` 为主。
- `Vite`
  用于本地开发、构建打包和开发代理配置，默认开发端口为 `5173`。
- `Fetch API`
  当前请求层基于浏览器原生 `fetch` 封装，统一在 `src/utils/http.js` 中处理标准响应包裹结构。
- `EventSource`
  用于扫描任务详情页的实时日志流订阅，对应扫描任务流式接口。
- 原生 CSS
  样式按页面和模块拆分在 `src/styles/` 下，未引入额外 UI 框架。

## 🧱 目录结构

以下是当前仓库中最值得优先理解的目录与文件：

```text
manscan-fe/
├── src/
│   ├── api/                # 接口请求封装
│   ├── assets/             # 图片和图标资源
│   ├── components/         # 复用组件，当前以 dashboard、layout 为主
│   ├── composables/        # 组合式逻辑，如轻量路由能力
│   ├── constants/          # 接口地址和常量定义
│   ├── data/               # 页面本地展示数据与 mock 数据
│   ├── pages/              # 页面级组件
│   ├── router/             # 路径与标题映射
│   ├── styles/             # 全局主题与页面样式
│   ├── utils/              # 请求层、图标和工具函数
│   ├── App.vue             # 应用入口视图
│   └── main.js             # Vue 挂载入口
├── design-system/          # 当前项目的设计系统输出文档
├── CODE_STYLE.md           # 前端开发与自检规范
├── SERVER_API.md           # 后端接口定义文档
├── FE_API.md               # 前端实际使用接口说明
├── vite.config.js          # Vite 配置与开发代理
└── package.json            # 依赖与脚本入口
```

### 关键实现说明

- `src/App.vue`
  根据当前路径动态切换首页、模板、漏洞、扫描等页面视图。
- `src/composables/useAppRouter.js`
  负责路径同步、历史记录跳转和页面标题更新，是当前项目的轻量路由实现。
- `src/api/templates.js` 与 `src/api/scans.js`
  统一维护模板和扫描任务相关请求，组件层不直接拼接接口地址。
- `src/constants/api.js`
  集中定义 `/api/v1` 前缀和各类接口路径构造函数。
- `src/utils/http.js`
  统一处理后端标准响应结构 `{ code, message, data }`，并兼容部分旧 mock 响应。

## 🛠️ 开发规范

### 必读文档

- 页面、组件、样式、交互修改前，先阅读 [`CODE_STYLE.md`](./CODE_STYLE.md)
- 涉及接口调用时，先核对 [`SERVER_API.md`](./SERVER_API.md)
- 接口变更完成后，同步更新 [`FE_API.md`](./FE_API.md)

### 当前仓库约定

- 默认使用 `Vue 3 Composition API`
- 构建工具为 `Vite`
- 所有 HTTP 请求统一收敛到 `src/api`
- 页面级组件放在 `src/pages`
- 通用和业务复用组件放在 `src/components`
- 全局样式与页面样式统一维护在 `src/styles`

### 提交前建议自检

根据 [`CODE_STYLE.md`](./CODE_STYLE.md)，至少确认以下事项：

- 功能、边界情况、错误提示和加载状态已验证
- 接口字段、错误分支和空值兜底已处理
- 组件职责清晰，没有重复代码和遗留调试输出
- 响应式布局和可访问性没有明显退化
- README、接口文档和实现保持一致

### 关于测试与质量检查

当前 `package.json` 中仅包含以下脚本：

- `npm run dev`
- `npm run build`
- `npm run preview`

仓库里暂未发现显式的 `lint`、`format` 或自动化测试命令。  
因此在日常开发中，至少应完成：

- `npm run build`，确认构建可通过
- 核心页面的手动验证
- 文档同步检查，尤其是 `README.md`、`SERVER_API.md`、`FE_API.md`

## 🔌 接口联调说明

### 请求前缀

前端当前使用的接口前缀为：

```text
/api/v1
```

开发环境下会通过 `vite.config.js` 代理到本地后端：

```text
http://localhost:8686
```

### 当前已接入接口范围

根据 [`FE_API.md`](./FE_API.md)，前端当前主要接入两类接口：

- 模板相关接口
  包括模板统计、模板列表、模板详情、标签选项、协议选项
- 扫描相关接口
  包括创建扫描任务、任务详情、任务日志、任务日志流

### 联调时需要特别注意

- 后端标准响应格式应为 `{ code, message, data }`
- 前端请求层会在 `code !== 0` 时直接抛出错误
- `/scans/:id/stream` 使用 `EventSource`，适合返回 SSE 流
- 模板和扫描接口字段变更后，代码实现、`SERVER_API.md`、`FE_API.md` 三者必须同步

### 文档同步要求

只要发生以下任一情况，就要同步更新接口文档：

- 新增接口调用
- 修改请求方法、路径、参数或返回字段
- 删除旧接口或停止使用某个字段
- 调整异常分支、兼容逻辑或联调注意事项

## ❓ 常见问题

### 1. 启动前端后接口请求失败

现象：页面能打开，但模板列表、扫描任务等数据加载失败。  
可能原因：后端服务未启动，或者没有运行在 `http://localhost:8686`。  
解决方式：

```bash
# 先确认前端已启动
npm run dev
```

然后检查后端服务是否已启动，并确认其接口路径与 [`SERVER_API.md`](./SERVER_API.md) 一致。

### 2. 页面能访问，但接口返回 404 或代理未生效

现象：浏览器网络面板中 `/api/*` 请求没有命中后端。  
可能原因：本地不是通过 `Vite` 开发服务访问，或代理配置与后端端口不一致。  
解决方式：

- 确认当前访问地址是 `http://localhost:5173`
- 确认 [`vite.config.js`](./vite.config.js) 中代理目标仍为 `http://localhost:8686`

### 3. 修改接口后前端仍然报字段错误

现象：接口返回成功，但页面展示异常、报空值错误或列表为空。  
可能原因：前端实现、`SERVER_API.md`、`FE_API.md` 三者没有同步。  
解决方式：

- 先核对后端返回字段是否变化
- 再检查 `src/api`、页面消费逻辑和文档是否一起更新
- 对新增字段补充空值兼容和异常分支处理

### 4. 构建失败或页面样式异常

现象：`npm run build` 失败，或者页面布局明显错乱。  
可能原因：改动没有遵循现有目录分层、样式约定或组件职责约束。  
解决方式：

- 按 [`CODE_STYLE.md`](./CODE_STYLE.md) 逐项检查
- 优先确认 `src/api`、`src/pages`、`src/components`、`src/styles` 的职责没有混用
- 重新执行 `npm run build` 验证是否恢复正常

## 补充说明

- 当前仓库未发现 `.env.example` 等环境变量示例文件，如后续引入环境变量，建议同步补充说明文档。
- 当前仓库已包含 `design-system/` 目录，可作为后续页面视觉和交互实现的参考依据。
