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
  - `protocol`: 多选协议，筛选选项来自 `/api/v1/templates/options/protocols`
  - `iskev`: `true` / `false`
  - `iscve`: `true` / `false`
- 返回结构：前端使用 `data.page`、`data.pageSize`、`data.total`、`data.totalPages`、`data.items`
  - 模板库列表页使用 `items[].id`、`items[].name`、`items[].description`、`items[].severity`、`items[].protocols`
  - 创建扫描任务页使用 `items[].id`、`items[].name`、`items[].description`、`items[].severity`、`items[].author`、`items[].protocols`、`items[].tags`
- 异常分支：
  - 模板库页失败时展示空列表
  - 创建任务页失败时展示错误提示“模板列表加载失败，请稍后重试。”
- 联调注意事项：
  - `items` 必须为数组
  - `totalPages` 若后端未返回，前端会基于 `total/pageSize` 兜底计算
  - `severity` 支持英文和中文，前端会做映射展示
  - `protocols` 推荐返回字符串数组；模板库列表页会按大写协议标签展示，缺失时显示 `--`

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

- 用途：模板库页、创建扫描任务页和漏洞查询页的标签筛选
- 请求方式：`GET`
- 路径：`/api/v1/templates/options/tags`
- 请求参数：无
- 返回结构：前端优先读取 `data.items`
- 异常分支：
  - 模板库页和创建扫描任务页失败时筛选项为空，不阻塞主流程
  - 漏洞查询页失败时回退为前端内置标签选项
- 联调注意事项：
  - 支持纯字符串数组
  - 也兼容对象数组，常用字段可为 `value`、`label`、`tag`、`name`、`count`
  - 漏洞查询页标签菜单会在前端按批次渲染候选项，滚动到底部后继续展示后续标签

### 5. 获取模板协议选项

- 用途：模板库页、创建扫描任务页、漏洞查询页的协议筛选
- 请求方式：`GET`
- 路径：`/api/v1/templates/options/protocols`
- 请求参数：无
- 返回结构：前端优先读取 `data.items`
- 异常分支：
  - 失败时回退为前端内置协议选项，不阻塞列表主流程
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
  - `saved_requests` 仅统计 `success` 状态任务的累计节省请求数，统计口径为 `SUM(total_requests - real_requests)`
  - 运行中、暂停、失败、取消中的任务不计入 `saved_requests`
  - 扫描列表页会优先根据 `data.running` 判断是否继续轮询；当当前页最后一个运行中任务结束时，前端还会额外补一次统计请求，尽快刷新节省请求数

### 7. 获取扫描任务名称选项

- 用途：漏洞查询页“扫描任务”筛选项，支持模糊查询和滚动分页加载
- 请求方式：`GET`
- 路径：`/api/v1/scans/options/names`
- 请求参数：
  - `page`: 页码
  - `page_size`: 每页数量，前端当前使用 `20`
  - `keyword`: 扫描任务名称模糊搜索
- 返回结构：前端使用 `data.page`、`data.pageSize`、`data.total`、`data.totalPages`、`data.items`
  - `items[].name`
- 异常分支：
  - 首次打开筛选项失败时，菜单显示错误提示和重试按钮
  - 滚动加载失败时保留已加载选项，可重试继续拉取
- 联调注意事项：
  - 该接口只返回去重后的任务名称，不返回任务详情
  - 前端会在菜单打开时加载第一页，输入关键词后防抖重新拉取第一页
  - 滚动到底部后会继续请求下一页并追加显示

### 8. 获取扫描任务列表

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

### 9. 创建扫描任务

- 用途：扫描任务创建页提交任务
- 请求方式：`POST`
- 路径：`/api/v1/scans`
- 请求参数：
  - 请求体为 JSON
  - 前端会按表单仅提交已填写字段
  - 至少提交 `targets` 或 `inline_targets_list` 语义对应的目标数据；当前前端主要提交 `targets`
  - 高级能力字段：
    - `dast`: `boolean`，启用 DAST/fuzzable 模板
    - `interactsh_server`: `string`，当前任务使用的 Interactsh 服务根地址
    - `interactsh_token`: `string`，当前任务使用的 Interactsh 鉴权 Token，前端按密码输入处理，最长 255 个字符
    - `no_interactsh`: `boolean`，禁用当前任务的 Interactsh/OOB 请求
- 联调注意事项：
  - 当前后端不限制单次任务的目标数量上限
  - `no_interactsh=true` 时，前端会阻止同时填写 `interactsh_server` 或 `interactsh_token`，与后端互斥约定保持一致
  - `interactsh_token` 仅在创建请求中提交，前端不会在任务查询页面展示该字段
- 返回结构：前端使用 `data.task.id`、`data.task.task_no`、`data.task.status`、`data.task_api`
- 异常分支：
  - 非 2xx 或业务错误时，在页面顶部展示错误文案
  - 成功后会自动跳转到 `/scans/:id`
- 联调注意事项：
  - `task.id` 缺失时，前端会尝试从 `task_api` 中解析详情 ID
  - `task_api` 建议返回 `/api/v1/scans/:id`
  - 创建页的“自定义请求头”会默认预填一行 `User-Agent`，值为 `User-Agent: Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36 c2fbccf08ddd46b93fa4e87cff76a009 Xray/Scan`，用户可按需删除或覆盖

### 10. 重新扫描任务

- 用途：扫描任务详情页基于原任务配置创建并启动一条新的扫描任务
- 请求方式：`POST`
- 路径：`/api/v1/scans/:id/rescan`
- 请求参数：
  - 路径参数 `id`: 原扫描任务 ID
- 返回结构：前端使用 `data.task.id`、`data.task.task_no`、`data.task.status`、`data.task_api`
- 异常分支：
  - 请求失败时，在任务详情页顶部展示错误提示
  - 新任务 ID 无法从 `task.id` 或 `task_api` 解析时，展示“重新扫描已创建，但返回的新任务 ID 为空。”
- 联调注意事项：
  - 前端仅在任务状态不是 `running` 且详情已加载后展示“重新扫描”按钮
  - 点击详情页“重新扫描”按钮后，前端会禁用刷新、暂停/继续和停止按钮，避免动作并发
  - 成功后前端立即在当前页跳转到 `/scans/:newId`，并由新详情页重新加载任务详情和日志流
  - `task_api` 建议返回 `/api/v1/scans/:id`，作为 `task.id` 缺失时的兜底解析来源

### 11. 取消扫描任务

- 用途：扫描任务详情页停止仍处于 `pending` / `running` / `paused` 状态的任务
- 请求方式：`POST`
- 路径：`/api/v1/scans/:id/cancel`
- 请求参数：
  - 路径参数 `id`
- 返回结构：前端当前使用 `data.task_id`、`data.status`、`data.cancel_requested`
- 异常分支：
  - 请求失败时，在任务详情页顶部展示错误提示
- 联调注意事项：
  - 前端当前会在任务状态为 `pending`、`running` 或 `paused` 时展示停止按钮
  - 当 `cancel_requested=true` 且返回状态仍为 `running` 时，表示后端已受理取消请求，最终状态会在后续详情轮询或日志流中收敛为 `cancelled`

### 12. 暂停扫描任务

- 用途：扫描任务详情页暂停仍处于 `pending` / `running` 状态的任务
- 请求方式：`POST`
- 路径：`/api/v1/scans/:id/pause`
- 请求参数：
  - 路径参数 `id`
- 返回结构：前端当前使用 `data.task_id`、`data.status`、`data.pause_requested`
- 异常分支：
  - 请求失败时，在任务详情页顶部展示错误提示
- 联调注意事项：
  - 前端当前仅在任务状态为 `pending` 或 `running` 时展示暂停按钮
  - 点击后前端会立即切换为“已暂停”交互态，并停止实时日志连接与详情轮询
  - 当后端最终把任务状态收敛为 `paused` 后，前端会自动清除本地过渡状态

### 13. 恢复扫描任务

- 用途：扫描任务详情页恢复 `paused` 状态的任务
- 请求方式：`POST`
- 路径：`/api/v1/scans/:id/resume`
- 请求参数：
  - 路径参数 `id`
- 返回结构：前端当前使用 `data.task_id`、`data.status`、`data.resume_requested`
- 异常分支：
  - 请求失败时，在任务详情页顶部展示错误提示
- 联调注意事项：
  - 前端当前仅在任务状态为 `paused` 时展示恢复按钮
  - 点击后前端会立即切回“继续执行中”交互态，并恢复实时日志连接与详情轮询

## 资产配置中心接口

### 14. 获取资产配置中心列表

- 用途：资产配置中心页表格渲染、分页、筛选和当前列表总数展示；创建扫描任务页同步全局禁扫名单
- 请求方式：`GET`
- 路径：`/api/v1/asset-config-centers`
- 请求参数：
  - `page`: 页码
  - `page_size`: 每页条数，前端当前使用 `10` / `20` / `50`
  - `item_name`: 项名称模糊搜索
  - `big_category`: 大分类过滤，前端固定支持 `scanDisabled`、`network`、`passive_traffic_addresses`
  - `small_category`: 小分类筛选，筛选值来自 `/api/v1/asset-config-centers/options/small-categories`
  - `status`: 状态过滤，支持 `enabled`、`disabled`
- 返回结构：前端使用 `data.page`、`data.pageSize`、`data.total`、`data.totalPages`、`data.items`
  - `items[].id`
  - `items[].item_name`
  - `items[].big_category`
  - `items[].small_category`
  - `items[].status`
  - `items[].description`
- 异常分支：
  - 首屏失败时展示阻塞错误态和重试按钮
  - 有数据时失败展示顶部告警条，但保留当前列表
  - `page` 超出总页数时，前端会自动回跳到最后一页并重试
- 联调注意事项：
  - 资产配置中心页顶部 4 个分类标签分别对应 `全部配置`、`scanDisabled`、`network`、`passive_traffic_addresses`
  - 前端小类筛选使用选项菜单，不再提供手输小分类搜索框
  - 返回项建议保持 `item_name` 全局唯一
  - 创建扫描任务页开启“全局禁扫名单”时，会以 `big_category=scanDisabled`、`status=enabled`、`page_size=100` 拉取全部分页，并将返回项的 `item_name` 去重后合并到 `exclude_targets`
  - 全局禁扫名单接口请求失败时，创建扫描任务页会提示重试，并阻止在名单未同步完成前提交任务

### 15. 获取资产配置中心小分类选项

- 用途：资产配置中心页“小分类”筛选菜单选项
- 请求方式：`GET`
- 路径：`/api/v1/asset-config-centers/options/small-categories`
- 请求参数：
  - `big_category`: 大分类，前端在单个分类页传当前大类；在“全部配置”页会传 `scanDisabled`、`network`、`passive_traffic_addresses`
- 返回结构：前端使用 `data.items`
- 异常分支：
  - 请求失败时，小分类菜单展示失败原因和重试按钮
  - 失败不阻塞资产配置中心列表渲染
- 联调注意事项：
  - `items` 推荐返回字符串数组，例如 `["api", "web"]`
  - 前端会过滤空字符串并去重
  - 新增/编辑弹窗会根据当前大分类请求候选小类，候选项仅用于辅助筛选和填充，用户仍可输入自定义小类

### 16. 新增资产配置项

- 用途：资产配置中心页新增弹窗提交
- 请求方式：`POST`
- 路径：`/api/v1/asset-config-centers`
- 请求参数：
  - 请求体为 JSON
  - `item_name`: 项名称
  - `big_category`: 大分类
  - `small_category`: 小分类
  - `status`: `enabled` / `disabled`
  - `description`: 说明
- 返回结构：前端使用后端标准响应包裹中的 `data`
- 异常分支：
  - `item_name` 重复、必填字段缺失或 `status` 非法时，前端展示后端返回的错误信息
- 联调注意事项：
  - 前端提交前只做基础空值校验，唯一性仍以后端返回为准

### 17. 编辑资产配置项

- 用途：资产配置中心页编辑弹窗提交
- 请求方式：`PUT`
- 路径：`/api/v1/asset-config-centers/:id`
- 请求参数：
  - 路径参数 `id`
  - 请求体为 JSON，字段与新增接口一致
- 返回结构：前端使用后端标准响应包裹中的 `data`
- 异常分支：
  - `40401` 时展示“资产配置项不存在”一类错误
  - `item_name` 重复或字段非法时，展示后端返回的错误信息
- 联调注意事项：
  - 前端按当前行数据回填表单，保存成功后会刷新当前列表和小类选项

### 18. 删除资产配置项

- 用途：资产配置中心页删除确认弹窗提交
- 请求方式：`DELETE`
- 路径：`/api/v1/asset-config-centers/:id`
- 请求参数：
  - 路径参数 `id`
- 返回结构：前端使用后端标准响应包裹中的 `data`
- 异常分支：
  - `40401` 时展示资源不存在错误
  - `50001` 时展示删除失败提示
- 联调注意事项：
  - 删除成功后前端会刷新当前列表和小类选项

### 14. 获取扫描任务详情

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
  - `progress.finished`、`progress.finished_status` 会影响是否切换到已完成日志模式；当 `finished_status=paused` 时，前端会按“暂停态”而不是“已结束态”处理
  - `progress.last_event_seq` 会影响日志续拉偏移量

### 15. 获取扫描任务日志

- 用途：扫描任务详情页的初始日志加载、完成后分页补载历史日志
- 请求方式：`GET`
- 路径：`/api/v1/scans/:id/logs`
- 请求参数：
  - `offset`
  - `limit`
  - `direction`
- 返回结构：前端使用 `data.task`、`data.progress`、`data.events`、`data.next_offset`、`data.has_more`
  - `data.task` 与详情接口保持一致，前端会继续读取并覆盖 `target_count`、`plugin_count`、`tech_count` 等统计字段
- 异常分支：
  - 首屏加载失败时展示“获取扫描日志失败。”
  - 向上补载失败时展示“加载更早日志失败。”
- 联调注意事项：
  - 日志接口返回的 `data.task.critical_count/high_count/medium_count/low_count/info_count` 会同步刷新顶部“漏洞命中”卡片
  - 日志接口返回的 `data.task.tech_count` 会同步刷新详情页“指纹识别数量”
  - `events[].seq` 最好连续递增，前端依赖它做去重和排序
  - 前端当前会用 `direction=before` 拉取日志尾部最近一页，并基于 `next_offset`、`has_more` 向前补载更早日志
  - 运行中任务页在浏览器刷新后，会先拉取尾部最近一页，再使用 `direction=before` 自动回补更早历史日志，避免只拿到最早一批或最后一批事件
  - 对于 `direction=before`，前端会把 `next_offset` 当作“当前页最早一条日志的 seq”，下一次继续原样作为 `offset` 传回
  - 对于 `direction=forward` 或日志流 `offset`，前端会把“最后已处理事件的 seq”作为续传偏移传回，而不是 `seq + 1`

### 16. 订阅扫描任务日志流

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
  - 前端会把“最后已处理日志的 `seq`”作为 `offset` 传给流接口，依赖后端补发 `seq > offset` 的快照和后续事件

## 漏洞相关接口

### 17. 获取漏洞列表

- 用途：`/vulnerabilities` 漏洞查询页首屏加载、分页、筛选和手动刷新；侧边栏“漏洞”导航徽标和首页仪表盘“待处理漏洞”卡片展示未审核漏洞数
- 请求方式：`GET`
- 路径：`/api/v1/vulnerabilities`
- 请求参数：
  - `page`: 页码，筛选条件或每页数量变化后重置为 `1`
  - `page_size`: 每页数量，前端当前支持 `10`、`20`、`50`、`100`
  - 侧边栏和首页仪表盘未审核总数当前实际使用：`page=1`、`page_size=1`、`status=unreviewed`
  - 首页仪表盘未审核分类数量当前实际使用：`page=1`、`page_size=1`、`status=unreviewed`，并分别附加 `severity=critical|high|medium|info|low`
  - `keyword`: 统一搜索关键字，用于按 `vulnerability_name OR template_id` 模糊匹配
  - `asset_host`: 资产 Host 模糊筛选
  - `status`: 漏洞状态精确筛选，前端当前枚举为 `unreviewed`、`confirmed`、`ticketed`、`fixed`、`false_positive`、`ignored`，支持多选
  - `tags`: 标签筛选，选项来自 `/api/v1/templates/options/tags`，支持下拉内模糊查询、多选并以重复 query 参数提交
  - `severity`: 严重级别精确筛选，前端固定枚举为 `critical`、`high`、`medium`、`low`、`info`、`unknown`，支持多选
  - `latest_scan_task_name`: 最近扫描任务名称筛选，前端下拉选项来自 `/api/v1/scans/options/names`
  - `protocol`: 协议枚举筛选，选项来自 `/api/v1/templates/options/protocols`，支持多选并以重复 query 参数提交
- 返回结构：前端使用 `data.page`、`data.pageSize`、`data.total`、`data.totalPages`、`data.items`
  - `items[].id`
  - `items[].name`
  - `items[].severity`
  - `items[].template_id`
  - `items[].asset_host`
  - `items[].status`
  - `items[].tags`
  - `items[].latest_scan_task_name`
  - `items[].protocol`
  - `items[].last_found_at`
- 异常分支：
  - 首屏失败时展示错误态和重新加载按钮
  - 有数据时刷新或筛选失败会保留当前列表，并在列表上方展示错误提示与重试按钮
  - 无数据时展示空状态；存在筛选条件时提供清空筛选入口
- 联调注意事项：
  - 进入页面默认请求 `page=1&page_size=10`
  - 后端已支持 `keyword` 参数，匹配逻辑为 `LOWER(vulnerability_name) LIKE %keyword% OR LOWER(template_id) LIKE %keyword%`；该条件应与其他筛选条件做 `AND` 组合
  - 前端“搜索漏洞名称或 Template ID”输入框只会提交 `keyword`，不再自行判断应该传 `vulnerability_name` 还是 `template_id`
  - `tags`、`status`、`severity` 和 `protocol` 均为下拉筛选，多选时前端会发送多个同名 query 参数
  - 漏洞页标签筛选候选来自 `/api/v1/templates/options/tags`；接口失败时回退为前端内置标签选项
  - 漏洞页“扫描任务”筛选候选来自 `/api/v1/scans/options/names`；接口失败时会展示错误提示并允许重试
  - 漏洞页“全选”会按当前已应用筛选条件，以 `page_size=100` 分页拉取所有匹配漏洞的 `items[].id`，用于后续批量操作
  - 侧边栏“漏洞”徽标会单独轮询本接口，间隔约 10 秒，并直接读取 `data.total` 作为未审核漏洞数
  - 首页仪表盘“待处理漏洞”卡片会在页面挂载时请求未审核总数和 `critical`、`high`、`medium`、`info`、`low` 分类数量，均直接读取 `data.total`；加载中或失败时显示 `--`
  - `pageSize`、`totalPages` 若后端字段命名变为 `page_size`、`total_pages`，前端也兼容
  - `severity`、`status`、`protocol` 展示前会统一转为小写 key；未知值按原值兜底展示
  - 漏洞状态展示映射：`unreviewed=未审核`、`confirmed=已确认`、`ticketed=已发单`、`fixed=已修复`、`false_positive=误报`、`ignored=忽略`
  - `asset_host`、`template_id`、`latest_scan_task_name`、`last_found_at` 缺失时会显示 `--`

### 18. 更新漏洞状态

- 用途：`/vulnerabilities/:id` 漏洞详情页修改“漏洞状态”
- 请求方式：`PATCH`
- 路径：`/api/v1/vulnerabilities/:id/status`
- 请求参数：
  - 路径参数 `id`: 漏洞 ID，来自详情页路由 `/vulnerabilities/:id`
  - 请求体 `status`: 目标漏洞状态，前端当前允许选择 `unreviewed`、`confirmed`、`ticketed`、`fixed`、`false_positive`、`ignored`
- 请求体：
  - `status`
- 返回结构：前端使用以下字段做详情页局部更新
  - `data.id`
  - `data.status`
  - `data.fixed_at`
- 异常分支：
  - 提交中禁用弹窗关闭和确认按钮，避免重复提交
  - 请求失败时保留弹窗，并在弹窗内展示后端错误信息或“漏洞状态修改失败，请稍后重试。”
  - 关闭详情页时会中止仍在进行的状态更新请求
- 联调注意事项：
  - 当 `status=fixed` 时，后端会写入 `fixed_at`；当 `status=unreviewed` 时，后端会清空 `fixed_at`
  - 其它状态的 `fixed_at` 前端不自行推断，统一以接口返回值更新页面
  - 状态修改成功后前端不重新拉取整页详情，会使用接口返回的 `status` 和 `fixed_at` 局部更新“漏洞状态”和“修复时间”

### 19. 批量更新漏洞状态

- 用途：`/vulnerabilities` 漏洞查询页选中多个漏洞后批量修改“漏洞状态”
- 请求方式：`PATCH`
- 路径：`/api/v1/vulnerabilities/status`
- 请求参数：
  - 请求体 `ids`: 漏洞 ID 数组，每次请求最多 `1000` 个，必须为大于 `0` 的整数
  - 请求体 `status`: 目标漏洞状态，前端当前允许选择 `unreviewed`、`confirmed`、`ticketed`、`fixed`、`false_positive`、`ignored`
- 请求体：
  - `ids`
  - `status`
- 返回结构：前端当前以请求成功作为批量更新完成依据，接口返回字段可用于联调核对
  - `data.ids`
  - `data.status`
  - `data.fixed_at`
  - `data.updated_count`
- 异常分支：
  - 选中数量大于 `0` 时展示“批量操作”入口
  - 提交中禁用弹窗关闭和确认按钮，并在弹窗内展示已提交数量
  - 请求失败时保留弹窗，并在弹窗内展示后端错误信息或“批量修改漏洞状态失败，请稍后重试。”
  - 关闭漏洞列表页时会中止仍在进行的全选拉取或批量状态更新请求
- 联调注意事项：
  - “选中当前页”只合并当前页漏洞 ID；“全选”表示当前筛选条件下所有匹配漏洞，不限当前页
  - 前端提交前会将选中的 `items[].id` 转为正整数并去重；存在无法转换的 ID 时会阻止提交并提示刷新列表
  - 当选中漏洞超过 `1000` 个时，前端会按 `1000` 个 ID 一批顺序发送多个 `PATCH /api/v1/vulnerabilities/status` 请求
  - 任一批次失败时，前端停止发送后续批次；已成功批次以后端实际更新结果为准，弹窗保留错误提示
  - 全部批次成功后，前端会清空已选 ID 并重新加载当前漏洞列表
  - 批量删除入口会弹出确认框，并按 `1000` 个 ID 一批顺序发送多个 `DELETE /api/v1/vulnerabilities` 请求

### 20. 删除漏洞

- 用途：`/vulnerabilities` 漏洞查询页选中一个或多个漏洞后批量删除
- 请求方式：`DELETE`
- 路径：`/api/v1/vulnerabilities`
- 请求参数：
  - 请求体 `ids`: 漏洞 ID 数组，每次请求最多 `1000` 个，必须为大于 `0` 的整数
- 请求体：
  - `ids`
- 返回结构：前端当前使用以下字段做删除完成依据
  - `data.ids`
  - `data.deleted_count`
- 异常分支：
  - 提交中禁用弹窗关闭和确认按钮，并在弹窗内展示已提交数量
  - 请求失败时保留弹窗，并在弹窗内展示后端错误信息或“批量删除漏洞失败，请稍后重试。”
  - 关闭漏洞列表页时会中止仍在进行的全选拉取或批量删除请求
- 联调注意事项：
  - “选中当前页”只合并当前页漏洞 ID；“全选”表示当前筛选条件下所有匹配漏洞，不限当前页
  - 前端提交前会将选中的 `items[].id` 转为正整数并去重；存在无法转换的 ID 时会阻止提交并提示刷新列表
  - 当选中漏洞超过 `1000` 个时，前端会按 `1000` 个 ID 一批顺序发送多个 `DELETE /api/v1/vulnerabilities` 请求
  - 任一批次失败时，前端停止发送后续批次；已成功批次以后端实际删除结果为准，弹窗保留错误提示
  - 全部批次成功后，前端会清空已选 ID 并重新加载当前漏洞列表

### 21. 获取漏洞详情

- 用途：`/vulnerabilities/:id` 漏洞详情页展示漏洞完整业务字段、资产信息、时间线、参考链接和请求响应证据
- 请求方式：`GET`
- 路径：`/api/v1/vulnerabilities/:id`
- 请求参数：
  - 路径参数 `id`: 漏洞 ID，来自漏洞列表 `items[].id`
- 返回结构：前端使用以下字段
  - `data.id`
  - `data.template_id`
  - `data.vulnerability_name`
  - `data.latest_scan_task_id`
  - `data.first_found_at`
  - `data.last_found_at`
  - `data.fixed_at`
  - `data.status`
  - `data.asset_domain`
  - `data.asset_host`
  - `data.asset_port`
  - `data.tags`
  - `data.severity`
  - `data.description`
  - `data.impact`
  - `data.cvss_score`
  - `data.protocol`
  - `data.vendor`
  - `data.product`
  - `data.remediation`
  - `data.reference_links`
  - `data.detail`
  - `data.vuln_fingerprint`
- 异常分支：
  - 请求失败时展示后端错误信息或“漏洞详情加载失败，请稍后重试。”
  - 详情为空时展示空状态和重新加载按钮
  - 字段缺失时前端以 `--`、`未提供` 或空数组兜底，不阻塞页面渲染
- 联调注意事项：
  - 列表行点击后跳转到 `/vulnerabilities/:id`，详情页请求 `GET /api/v1/vulnerabilities/:id`
  - `tags` 和 `reference_links` 推荐返回字符串数组；前端也兼容 JSON 字符串或分隔文本
  - `latest_scan_task_id` 会在右侧以 URL 跳转标记展示，点击后在新标签页打开 `/scan/:id`，前端会兼容映射到现有扫描任务详情页
  - `detail` 如果是对象，前端会读取 `request`、`response`、`curl-command` 并拆成代码面板展示
  - 当 `detail.request` / `detail.response` 是按步骤编号的对象时，前端会按编号升序展示为 `请求 1 / 响应 1 / 请求 2 / 响应 2` 的顺序
  - `detail` 如果是合法 JSON 字符串，前端会先解析再读取以上字段；无法解析时会按原始文本兜底展示

### 22. 批量删除扫描任务

- 用途：`/scans` 扫描任务列表页选中一个或多个任务后批量删除
- 请求方式：`DELETE`
- 路径：`/api/v1/scans`
- 请求参数：
  - 请求体 `ids`: 扫描任务 ID 数组，每次请求最多 `1000` 个，必须为大于 `0` 的整数
- 请求体：
  - `ids`
- 返回结构：前端当前使用以下字段做删除完成依据
  - `data.ids`
  - `data.deleted_count`
- 异常分支：
  - 提交中禁用弹窗关闭和确认按钮，并在弹窗内展示已提交数量
  - 请求失败时保留弹窗，并在弹窗内展示后端错误信息或“批量删除扫描任务失败，请稍后重试。”
  - 关闭扫描列表页时会中止仍在进行的全选拉取或批量删除请求
- 联调注意事项：
  - “选中当前页”只合并当前页可删除任务 ID；“全选”表示当前筛选条件下所有可删除任务，不限当前页
  - 前端仅允许选择 `success`、`failed`、`cancelled`、`paused` 状态的任务，`pending` 和 `running` 任务的选择框会禁用
  - 前端提交前会将选中的 `items[].id` 转为正整数并去重；存在无法转换的 ID 时会阻止提交并提示刷新列表
  - 当选中任务超过 `1000` 个时，前端会按 `1000` 个 ID 一批顺序发送多个 `DELETE /api/v1/scans` 请求
  - 任一批次失败时，前端停止发送后续批次；已成功批次以后端实际删除结果为准，弹窗保留错误提示
  - 全部批次成功后，前端会清空已选 ID 并重新加载当前扫描任务列表

### 23. 下载扫描任务请求/响应压缩包

- 用途：扫描任务详情页“任务基本信息”区域下方的“下载请求/响应”按钮
- 请求方式：`GET`
- 路径：`/api/v1/scans/:id/responses/archive`
- 请求参数：
  - 路径参数 `id`: 扫描任务 ID
- 返回结构：
  - 成功时直接返回 zip 文件流，文件名为 `<任务ID>.zip`
  - 失败时返回 JSON 错误，前端当前会优先读取 `message`
- 异常分支：
  - `40401`：任务不存在
  - `40401`：请求/响应压缩包不存在
  - 其它非 2xx 状态：前端会把后端返回的错误信息展示在按钮下方
- 联调注意事项：
  - 该接口不是 JSON 接口，前端会以 `fetch + blob` 方式处理成功响应
  - 下载成功后由浏览器直接保存为 zip 文件，不会跳转页面
