# FE API

本文档记录前端实际使用和维护的接口说明。凡是前端新增、修改或删除接口调用，都应同步更新本文件，并与 [`SERVER_API.md`](./SERVER_API.md) 保持一致。

## 维护原则

- 新增接口调用时，先参考 `SERVER_API.md`，再补充到本文件。
- 后端接口变更后，前端实现与本文档必须同步调整。
- 文档应覆盖前端关心的请求方式、路径、参数、返回结构、错误处理和联调注意事项。

## 通用约定

- 前端统一请求前缀：`/api/v1`
- 前端请求层已兼容标准响应包裹格式：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

- 当前前端也兼容少量未包裹 `data` 的旧 mock/临时响应，但联调时应以后端文档定义的标准结构为准。

## 模板相关接口

### 1. 获取模板统计

- 用途：模板库顶部统计卡片展示
- 请求方式：`GET`
- 路径：`/api/v1/templates/stats`
- 请求参数：无
- 返回结构：前端使用 `data.templateCount`、`data.kevTemplateCount`、`data.cveTemplateCount`、`data.fingerprintTemplateCount`
- 异常分支：
  - 请求失败时，页面保留骨架态结束后的默认占位 `--`
  - 不阻塞模板列表渲染
- 联调注意事项：
  - 字段需可转为数字，空值会被前端兜底为 `0`

### 2. 获取模板列表

- 用途：模板库列表、创建扫描任务页中的模板选择器
- 请求方式：`GET`
- 路径：`/api/v1/templates`
- 请求参数：
  - `page`: 页码
  - `pageSize`: 前端当前会传 `20` 或 `12`
  - `name`: 模板名称或模板 ID 模糊搜索
  - `tag`: 多选标签
  - `severity`: 多选风险等级
  - `protocol`: 多选协议
  - `iskev`: `true` / `false`
  - `iscve`: `true` / `false`
- 返回结构：前端使用 `data.page`、`data.pageSize`、`data.total`、`data.totalPages`、`data.items`
- 异常分支：
  - 模板库页失败时展示空列表
  - 创建任务页失败时展示错误提示“模板列表加载失败，请稍后重试。”
- 联调注意事项：
  - `items` 必须为数组
  - `totalPages` 若后端未返回，前端会基于 `total/pageSize` 兜底计算
  - `severity` 支持英文和中文，前端会做映射展示

### 3. 获取模板详情

- 用途：模板详情页展示漏洞说明、影响范围、修复建议、引用链接与 Nuclei 模板内容
- 请求方式：`GET`
- 路径：`/api/v1/templates/:id`
- 请求参数：
  - 路径参数 `id`
- 返回结构：前端使用 `data.id`、`data.name`、`data.description`、`data.impact`、`data.remediation`、`data.reference`、`data.cvssScore`、`data.vendor`、`data.product`、`data.protocols`、`data.tags`、`data.shodanQuery`、`data.fofaQuery`、`data.content`
- 异常分支：
  - 请求失败时展示“模板详情加载失败，请稍后重试。”
  - 页面保留前端 mock 兜底文案，不会直接崩溃
- 联调注意事项：
  - `reference` 推荐返回字符串数组
  - `shodanQuery` / `fofaQuery` 支持数组，也兼容换行文本或 JSON 字符串
  - `cvssScore` 可为数字或数字字符串

### 4. 获取模板标签选项

- 用途：模板库页和创建扫描任务页的标签筛选
- 请求方式：`GET`
- 路径：`/api/v1/templates/options/tags`
- 请求参数：无
- 返回结构：前端优先读取 `data.items`
- 异常分支：
  - 失败时筛选项为空，不阻塞主流程
- 联调注意事项：
  - 支持纯字符串数组
  - 也兼容对象数组，常用字段可为 `value`、`label`、`tag`、`name`、`count`

### 5. 获取模板协议选项

- 用途：创建扫描任务页的协议筛选
- 请求方式：`GET`
- 路径：`/api/v1/templates/options/protocols`
- 请求参数：无
- 返回结构：前端优先读取 `data.items`
- 异常分支：
  - 失败时回退为前端内置协议选项
- 联调注意事项：
  - 支持纯字符串数组
  - 也兼容对象数组，常用字段可为 `value`、`label`、`protocol`、`name`、`count`

## 扫描相关接口

### 6. 获取扫描任务统计

- 用途：`/scans` 顶部概览展示总任务数、运行中任务数和累计节省请求数量
- 请求方式：`GET`
- 路径：`/api/v1/scans/stats`
- 请求参数：无
- 返回结构：前端使用 `data.total`、`data.running`、`data.saved_requests`
- 异常分支：
  - 请求失败时不阻塞任务列表渲染
  - 页面会保留已有统计值；首次失败时回退到列表页本地可推导数据
- 联调注意事项：
  - `saved_requests` 的统计口径为 `SUM(total_requests - real_requests)`
  - 运行中任务的节省请求数也会被统计在内

### 7. 获取扫描任务列表

- 用途：`/scans` 任务列表页首屏加载、分页、筛选、搜索和轮询刷新；侧边栏“扫描”导航徽标展示运行中任务数
- 请求方式：`GET`
- 路径：`/api/v1/scans`
- 请求参数：
  - 列表页当前实际使用：`page`、`page_size`、`keyword`、`status`、`has_high_risk`
  - 侧边栏运行中数量当前实际使用：`page=1`、`page_size=1`、`status=running`
  - 后端额外支持 `scan_strategy`、`created_by`，但当前前端扫描列表页未启用
- 返回结构：前端使用 `data.page`、`data.pageSize`、`data.total`、`data.totalPages`、`data.items`
  - `items[].name`
  - `items[].status`
  - `items[].created_by`
  - `items[].scan_strategy`
  - `items[].started_at`
  - `items[].finished_at`
  - `items[].critical_count` / `high_count` / `medium_count` / `low_count` / `info_count`
  - `items[].plugin_count`
  - `items[].target_count`
  - `items[].total_requests`
  - `items[].real_requests`
  - `items[].progress_percent`
  - `items[].duration_seconds`
  - `items[].last_message`
- 异常分支：
  - 首屏失败时展示错误态和重试按钮
  - 有数据时失败会保留当前列表并在顶部提示
  - 无数据时展示空态
- 联调注意事项：
  - 运行中和等待中任务会被前端自动轮询刷新，间隔约 7 秒
  - 侧边栏“扫描”徽标会单独轮询本接口，间隔约 10 秒，并直接读取 `data.total` 作为运行中任务数
  - 列表页默认展示 `started_at` 作为时间列
  - 风险分布直接使用后端严重级别计数
  - `has_high_risk=true` 时，前端将其解释为 `critical_count > 0 OR high_count > 0`

### 8. 创建扫描任务

- 用途：扫描任务创建页提交任务
- 请求方式：`POST`
- 路径：`/api/v1/scans`
- 请求参数：
  - 请求体为 JSON
  - 前端会按表单仅提交已填写字段
  - 至少提交 `targets` 或 `inline_targets_list` 语义对应的目标数据；当前前端主要提交 `targets`
- 联调注意事项：
  - 当前后端不限制单次任务的目标数量上限
- 返回结构：前端使用 `data.task.id`、`data.task.task_no`、`data.task.status`、`data.task_api`
- 异常分支：
  - 非 2xx 或业务错误时，在页面顶部展示错误文案
  - 成功后会自动跳转到 `/scans/:id`
- 联调注意事项：
  - `task.id` 缺失时，前端会尝试从 `task_api` 中解析详情 ID
  - `task_api` 建议返回 `/api/v1/scans/:id`

### 9. 获取扫描任务详情

- 用途：扫描任务详情页的基本信息、进度卡片和状态展示
- 请求方式：`GET`
- 路径：`/api/v1/scans/:id`
- 请求参数：
  - 路径参数 `id`
- 返回结构：前端使用 `data.task` 与 `data.progress`
  - `data.task` 当前直接使用 `id`、`task_no`、`name`、`description`、`status`、`started_at`、`target_count`、`plugin_count`、`tech_count`
  - `data.task` 也会随详情接口返回 `critical_count`、`high_count`、`medium_count`、`low_count`、`info_count`，前端当前保留兼容
  - `data.progress` 当前直接使用 `hosts`、`templates`、`total_requests`、`requests`、`matched`、`errors`、`percent`、`last_updated_at`、`last_message`、`last_event_seq`、`finished`、`finished_status`
- 异常分支：
  - 失败时展示“任务详情加载失败”
  - 页面仍保留返回列表与刷新按钮
- 联调注意事项：
  - 详情页顶部“漏洞命中”卡片优先使用 `critical_count + high_count + medium_count + low_count + info_count`
  - `progress.matched` 当前不再直接用于“漏洞命中”展示，避免把 `tech_count` 混入漏洞统计
  - `data.task.tech_count` 用于“指纹识别数量”展示，空值前端回退为 `--`
  - `progress.finished`、`progress.finished_status` 会影响是否切换到已完成日志模式
  - `progress.last_event_seq` 会影响日志续拉偏移量

### 10. 获取扫描任务日志

- 用途：扫描任务详情页的初始日志加载、完成后分页补载历史日志
- 请求方式：`GET`
- 路径：`/api/v1/scans/:id/logs`
- 请求参数：
  - `offset`
  - `limit`
- 返回结构：前端使用 `data.task`、`data.progress`、`data.events`、`data.next_offset`、`data.has_more`
  - `data.task` 与详情接口保持一致，前端会继续读取并覆盖 `target_count`、`plugin_count`、`tech_count` 等统计字段
- 异常分支：
  - 首屏加载失败时展示“获取扫描日志失败。”
  - 向上补载失败时展示“加载更早日志失败。”
- 联调注意事项：
  - 日志接口返回的 `data.task.critical_count/high_count/medium_count/low_count/info_count` 会同步刷新顶部“漏洞命中”卡片
  - 日志接口返回的 `data.task.tech_count` 会同步刷新详情页“指纹识别数量”
  - `events[].seq` 最好连续递增，前端依赖它做去重和排序
  - `next_offset` 与 `has_more` 会影响历史日志是否继续加载

### 11. 订阅扫描任务日志流

- 用途：扫描任务详情页实时日志流
- 请求方式：`GET`
- 路径：`/api/v1/scans/:id/stream`
- 请求参数：
  - 路径参数 `id`
  - 查询参数 `offset`，前端用于断线重连续传
- 返回结构：
  - `snapshot`
  - `event`
  - `complete`
- 异常分支：
  - 流中断后前端自动重连
  - 任务已结束则停止重连并切换完成态
- 联调注意事项：
  - SSE 数据体应为 JSON
  - 事件体支持完整包裹结构，也兼容直接返回单条事件对象
  - 完成事件建议携带最终 `task/progress/events` 快照
