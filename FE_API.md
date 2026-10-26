# FE API

本文档记录前端实际使用和维护的接口说明。凡是前端新增、修改或删除接口调用，都应同步更新本文件，并与 [`SERVER_API.md`](./SERVER_API.md) 保持一致。

## 维护原则

- 新增接口调用时，先参考 `SERVER_API.md`，再补充到本文件。
- 后端接口变更后，前端实现与本文档必须同步调整。
- 文档应覆盖前端关心的请求方式、路径、参数、返回结构、错误处理和联调注意事项。

## 通用约定

- 前端统一请求前缀：`/api/v1`
- 除登录接口外，前端请求层会从当前浏览器会话读取访问令牌，并统一附加请求头 `Authorization: Bearer <access_token>`。
- 当前登录态保存在 `localStorage`，同源新标签页可共享访问令牌；退出登录或登录态失效时会清理本地令牌。
- 当任意 JSON 接口返回 HTTP `401` 或业务码 `40101` 时，前端会清理本地登录态并跳转到 `/login`。
- 前端请求层已兼容标准响应包裹格式：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

- 当前前端也兼容少量未包裹 `data` 的旧 mock/临时响应，但联调时应以后端文档定义的标准结构为准。

## 认证相关接口

### 1. 获取登录验证码

- 用途：登录页加载和验证码失效后刷新 `orbital_slider` 验证场景
- 请求方式：`GET`
- 路径：`/api/v1/auth/challenge`
- 请求参数：无
- 返回结构：前端使用 `data.challenge_id`、`data.challenge_type`、`data.scene` 和 `data.requirements`
  - `challenge_type`: 当前支持 `orbital_slider`
  - `scene.prompt` / `scene.title` / `scene.instruction`: 可选，作为验证码提示文案
  - `scene.start_angle` / `scene.startAngle`: 可选，作为滑块初始角度
  - `scene.target_angle` / `scene.targetAngle` / `scene.target`: 可选，作为目标角度提示点
  - `requirements.max_track_points`: 可选，作为前端记录轨迹点数量上限
- 异常分支：
  - 请求失败时，登录页展示验证码加载失败状态和重试入口
  - 返回的 `challenge_type` 不是 `orbital_slider` 时，登录页展示“不支持当前验证码场景”
- 联调注意事项：
  - 验证码接口不携带 `Authorization` 请求头
  - 前端会在登录页挂载时立即请求一次验证码
  - 登录失败且后端返回 `data.refresh_required=true` 时，前端会重新请求本接口并清空当前拖拽结果

### 2. 登录

- 用途：登录页提交账户密码并建立前端会话
- 请求方式：`POST`
- 路径：`/api/v1/auth/login`
- 请求参数：
  - `username`: 登录用户名，最长 `64` 个字符
  - `password`: 登录密码，最长 `256` 个字符
  - `challenge_id`: 登录验证码 ID，来自 `/api/v1/auth/challenge`
  - `challenge_answer.angle`: `orbital_slider` 最终角度，前端按圆心右侧为 `0` 度、顺时针递增提交
  - `challenge_answer.drag_duration_ms`: 本次拖拽耗时，单位毫秒
  - `challenge_answer.track`: 拖拽轨迹数组，格式为 `[{x,y,t}]`
- 返回结构：前端使用 `data.access_token`、`data.token_type`、`data.expires_at`、`data.user`
  - `user.username`
  - `user.role`
- 异常分支：
  - `40001`: 登录表单参数错误或验证码错误，登录页展示后端错误文案；若 `data.refresh_required=true`，前端刷新验证码并提示用户重试
  - `40101`: 用户名或密码错误，登录页展示后端错误文案，并读取 `data.remaining_attempts` 展示剩余尝试次数
  - `40301`: 用户被禁用或账户已锁定，登录页展示后端错误文案；若 `data.locked=true`，前端展示锁定提示并禁用当前账号的密码输入和提交按钮
  - 网络或未知错误展示“登录失败，请检查网络后重试。”
- 联调注意事项：
  - 登录接口不携带 `Authorization` 请求头
  - 登录成功后前端保存访问令牌，并跳转到登录前访问的页面；若没有登录前页面则进入 `/`
  - 错误密码达到后端阈值后，后端返回 `locked=true`；前端切换用户名时会清理当前锁定提示
  - 登录成功后由后端清零连续失败次数，前端不额外维护失败计数

### 3. 获取当前用户

- 用途：应用启动时校验已有登录态，并刷新侧边栏用户展示
- 请求方式：`GET`
- 路径：`/api/v1/auth/me`
- 请求参数：无
- 返回结构：前端使用 `data.id`、`data.username`、`data.role`
- 异常分支：
  - `40101`: 清理本地登录态并跳转到 `/login`
  - 其他错误按登录态失效处理，跳转到 `/login`
- 联调注意事项：
  - 页面刷新后，前端会优先调用本接口确认 token 是否仍然有效

### 4. 获取用户列表

- 用途：设置页“用户管理”加载管理员可见的用户列表
- 请求方式：`GET`
- 路径：`/api/v1/users`
- 请求参数：
  - `page`: 页码；用户管理页默认 `1`
  - `page_size`: 每页数量；用户管理页当前固定 `10`
- 返回结构：前端使用 `data.page`、`data.pageSize`、`data.total`、`data.totalPages`、`data.items`
  - `items[].username`
  - `items[].role`
  - `items[].status`
  - `items[].last_login_at`
- 异常分支：
  - `40101`: 按统一鉴权逻辑清理本地登录态并跳转 `/login`
  - `40301`: 用户管理页展示后端错误信息和重试入口
  - 其他错误展示错误提示，保留当前页入口
- 联调注意事项：
  - 本接口携带 `Authorization`
  - 设置页只有当前用户 `role=admin` 时才展示“用户管理”二级导航并触发本接口
  - 前端只展示 `username`，不再读取 `display_name`
  - `role` 仅展示 `admin/user`，未知值按普通用户兜底
  - `status` 仅展示 `enabled/disabled/locked`，未知值按启用兜底
  - `last_login_at` 为空时展示“从未登录”

### 5. 新增用户

- 用途：设置页“用户管理”点击“新增用户”后创建账号
- 请求方式：`POST`
- 路径：`/api/v1/users`
- 请求参数：
  - `username`: 必填，最长 `64` 个字符
  - `password`: 必填，最长 `72` 个字符
  - `role`: `admin` 或 `user`，默认 `user`
  - `status`: `enabled`、`disabled` 或 `locked`，默认 `enabled`
- 返回结构：前端使用 `data`
  - `username`
  - `role`
  - `status`
  - `last_login_at`
- 异常分支：
  - 前端会校验用户名和密码非空、长度上限；失败时不发起请求
  - `40001`: 用户名重复、字段不合法等后端错误会展示在弹窗内
  - `40101`: 按统一鉴权逻辑清理本地登录态并跳转 `/login`
  - `40301`: 当前用户不是管理员时展示后端错误
  - 保存中禁用关闭和提交按钮，避免重复提交
- 联调注意事项：
  - 本接口携带 `Authorization` 和 `Content-Type: application/json`
  - 前端不展示、不保存、不记录后端密码字段；后端也不应返回密码
  - 新增成功后前端关闭弹窗、清空密码输入，并重新加载第 `1` 页用户列表

### 6. 修改用户

- 用途：设置页“用户管理”点击用户行“编辑”后修改账号角色、状态或密码
- 请求方式：`PUT`
- 路径：`/api/v1/users/:username`
- 请求参数：
  - 路径参数 `username`: 待修改的登录用户名，前端会做 URL 编码
  - `password`: 可选；留空时前端不提交该字段；填写时最长 `72` 个字符且需满足密码复杂度
  - `role`: `admin` 或 `user`
  - `status`: `enabled`、`disabled` 或 `locked`
- 返回结构：前端使用 `data`
  - `username`
  - `role`
  - `status`
  - `last_login_at`
- 异常分支：
  - 前端会校验新密码长度和复杂度；失败时不发起请求
  - `40001`: 请求体为空、密码不符合要求、角色或状态非法时展示在弹窗内
  - `40101`: 按统一鉴权逻辑清理本地登录态并跳转 `/login`
  - `40301`: 当前用户不是管理员时展示后端错误
  - `40401`: 用户不存在时展示后端错误
  - 保存中禁用关闭和提交按钮，避免重复提交
- 联调注意事项：
  - 本接口携带 `Authorization` 和 `Content-Type: application/json`
  - 前端固定展示当前 `username`，不支持修改用户名
  - 新密码为空时仅提交 `role` 和 `status`
  - 修改成功后前端关闭弹窗，并重新加载当前页用户列表

### 7. 删除用户

- 用途：设置页“用户管理”点击用户行“删除”并确认后删除账号
- 请求方式：`DELETE`
- 路径：`/api/v1/users/:username`
- 请求参数：
  - 路径参数 `username`: 待删除的登录用户名，前端会做 URL 编码
- 返回结构：前端兼容 `data.username` 和 `data.deleted_count`
- 异常分支：
  - 删除前使用前端弹窗二次确认，不使用浏览器 `confirm`
  - `40001`: 路径用户名不合法时展示在弹窗内
  - `40101`: 按统一鉴权逻辑清理本地登录态并跳转 `/login`
  - `40301`: 当前用户不是管理员时展示后端错误
  - `40401`: 用户不存在时展示后端错误
  - 删除中禁用关闭和提交按钮，避免重复提交
- 联调注意事项：
  - 本接口携带 `Authorization`
  - 删除成功后前端关闭弹窗，并重新加载当前页用户列表
  - 若当前页最后一条用户被删除且不是第 `1` 页，前端会回退到上一页加载

### 8. 退出登录

- 用途：侧边栏账户菜单退出当前会话
- 请求方式：`POST`
- 路径：`/api/v1/auth/logout`
- 请求参数：无
- 返回结构：前端兼容 `data.revoked`
- 异常分支：
  - 请求失败或 token 已失效时，前端仍会清理本地登录态并跳转到 `/login`
- 联调注意事项：
  - 退出登录成功后，后端应吊销当前访问令牌；前端不会继续保留该 token

## 用户设置接口

### 1. 第三方 API Key 配置列表

- 用途：设置页“API Key 管理”加载管理员维护的第三方服务配置
- 请求方式：`GET`
- 路径：`/api/v1/third-party-api-keys`
- 请求参数：`page`（默认 `1`）、`page_size`（前端固定 `10`）
- 返回结构：实际后端分页字段为 `data.page`、`data.pageSize`、`data.total`、`data.totalPages` 和 `data.items[]`；前端兼容 `page_size`、`total_pages`。每项使用 `id`、`platform_url`、`rate_limit_per_minute`、`description`、`key_configured`、`created_at`、`updated_at`
- 异常分支：
  - `40101`：按统一鉴权逻辑清理本地登录态并跳转 `/login`
  - `40301`：非管理员不展示“API Key 管理”入口；服务端拒绝时展示错误提示
  - 其他错误：列表展示失败状态和重试入口
- 联调注意事项：
  - 仅当前用户 `role=admin` 时加载本接口，前端携带 `Authorization`
  - 前端不读取或展示任何 Key 明文/密文，仅展示 `key_configured`
  - 列表切页会取消上一次请求，旧响应不能覆盖当前页

### 2. 查询单条第三方 API Key 配置

- 用途：点击平台地址查看非敏感配置详情；编辑时加载当前元信息
- 请求方式：`GET`
- 路径：`/api/v1/third-party-api-keys/:id`
- 请求参数：路径参数 `id` 为正整数，前端会进行 URL 编码
- 返回结构：前端使用 `id`、`platform_url`、`rate_limit_per_minute`、`description`、`key_configured`、`created_at`、`updated_at`
- 异常分支：`40001`、`40101`、`40301`、`40401` 或其他错误均在详情弹窗/编辑弹窗中展示
- 联调注意事项：接口响应不应包含 Key 明文或密文；编辑表单的 Key 输入框始终为空

### 3. 查询第三方 API Key 明文

- 用途：管理员按需查看并复制某条配置的 API Key 明文
- 请求方式：`GET`
- 路径：`/api/v1/third-party-api-keys/:id/plaintext`
- 请求参数：路径参数 `id` 为正整数
- 返回结构：`data.key` 为密钥明文；前端仅暂存于查看弹窗组件状态，关闭弹窗或卸载组件时清空
- 异常分支：`40101`/`40301` 按统一鉴权和权限提示处理；`40401` 提示该配置未配置密钥或已不存在；其他错误显示重试入口
- 联调注意事项：仅管理员点击“查看明文”时发起请求；请求设置 `cache: no-store`，服务端返回 `Cache-Control: no-store` 并记录访问审计；前端不写入本地存储或日志，复制使用浏览器剪贴板 API

### 4. 新增第三方 API Key 配置

- 用途：管理员在设置页新增第三方服务配置
- 请求方式：`POST`
- 路径：`/api/v1/third-party-api-keys`
- 请求参数：`key` 必填（最长 `512` 字节且不得含控制字符）；`platform_url` 必填（HTTP/HTTPS、最长 `2048` 字节且不含凭据或片段）；`rate_limit_per_minute` 可选（`0-4294967295`，默认 `0`）；`description` 可选（最长 `512` 字节）
- 返回结构：`data` 为配置对象，字段同列表项；前端在成功后重新请求列表，不读取 Key 字段
- 异常分支：前端先校验 URL、Key、限流和描述；`40001` 展示字段错误；`40101`/`40301` 按统一鉴权和权限提示处理；保存中禁用重复提交
- 联调注意事项：请求携带 `Authorization` 和 `Content-Type: application/json`；新增成功后加载第 1 页并清空密码框

### 5. 更新第三方 API Key 配置

- 用途：管理员编辑平台 URL、限流和描述，或替换 API Key
- 请求方式：`PUT`
- 路径：`/api/v1/third-party-api-keys/:id`
- 请求参数：`platform_url` 必填；`rate_limit_per_minute`、`description` 同新增；`key` 仅在用户输入新值时发送，留空表示保留已有密钥
- 返回结构：`data` 为更新后的配置对象，字段同列表项；前端在成功后重新请求当前页，不读取 Key 字段
- 异常分支：`40001`、`40101`、`40301`、`40401` 或其他错误在编辑弹窗中展示；保存中禁用关闭和提交
- 联调注意事项：更新按后端完整元信息替换规则提交，前端总是发送 URL、限流和描述字段

### 6. 删除第三方 API Key 配置

- 用途：管理员删除第三方服务配置
- 请求方式：`DELETE`
- 路径：`/api/v1/third-party-api-keys/:id`
- 请求参数：路径参数 `id` 为正整数，前端会进行 URL 编码
- 返回结构：兼容 `data.id` 和 `data.deleted_count`，成功后刷新列表
- 异常分支：删除前使用自定义确认弹窗；`40001`、`40101`、`40301`、`40401` 或其他错误展示在弹窗中；删除中禁止重复提交
- 联调注意事项：当前页最后一条记录删除后，前端自动回退到上一页；接口仅管理员可用

### 7. 获取当前用户主题设置

- 用途：应用登录态确认后同步当前用户主题设置；设置页“主题管理”首次进入时回显当前登录用户已保存的主题和暗夜模式开关
- 请求方式：`GET`
- 路径：`/api/v1/settings/theme`
- 请求参数：无
- 返回结构：前端使用 `data`
  - `theme`: 当前支持 `cartoon`、`deep`；未知值按 `cartoon` 兜底
  - `dark_mode_enabled`: 是否开启暗夜模式，前端转为布尔值
- 异常分支：
  - `40101`: 按统一鉴权逻辑清理本地登录态并跳转 `/login`
  - 应用启动同步失败时保留当前用户已缓存的主题和模式；无有效缓存时使用经典手绘主题和浅色模式
  - 设置页内请求失败时展示在主题管理页，保留重试入口和当前主题选择
- 联调注意事项：
  - 本接口携带 `Authorization`
  - 当前用户未保存过主题设置时，后端返回默认 `{theme:"cartoon", dark_mode_enabled:false}`
  - 前端根据 `theme` 在根节点设置 `data-theme`（`cartoon` / `deep`），根据 `dark_mode_enabled` 设置 `data-color-mode`（`light` / `dark`）；登录及刷新后同步恢复两项偏好
  - 成功响应缓存到当前用户的本地主题记录，刷新时在首屏绘制前应用；登录态和主题同步完成后才渲染业务页面，避免默认主题闪现。退出登录清除缓存，不复用其他账号的记录
  - 设置页初始选择继承当前主题，重新进入或切换页面时不重置为默认主题
  - `deep` 为浅色主体、深海军蓝导航的深邃沉稳主题；暗夜模式是独立开关，不由主题名称决定

### 8. 保存当前用户主题设置

- 用途：设置页“主题管理”点击“保存设置”后持久化当前用户主题偏好
- 请求方式：`PUT`
- 路径：`/api/v1/settings/theme`
- 请求参数：
  - `theme`: 当前选择的主题标识，前端可提交 `cartoon` 或 `deep`
  - `dark_mode_enabled`: 是否开启暗夜模式
- 返回结构：前端使用 `data`
  - `theme`
  - `dark_mode_enabled`
- 异常分支：
  - 保存中禁用主题开关、主题选择、撤销和保存按钮，避免重复提交
  - `40001`: 主题字段不合法时展示后端错误
  - `40101`: 按统一鉴权逻辑清理本地登录态并跳转 `/login`
  - 保存失败时保留用户当前选择，不更新“已同步”状态，用户可继续重试
- 联调注意事项：
  - 本接口携带 `Authorization` 和 `Content-Type: application/json`
  - 前端不提交 `user_id`，后端按当前登录用户保存
  - 主题选择与暗夜模式开关均即时预览；撤销恢复上次保存的两项偏好，保存成功后以响应值更新界面并标记为已同步
  - 保存成功后更新首屏主题缓存；未保存的预览不写入缓存，刷新恢复上次成功同步的偏好

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
  - `pageSize`: 创建扫描任务页列表展示传 `12`；模板库页 UI 支持 `10`、`20`、`50`、`100`，由于当前后端模板列表固定每页返回 `20` 条，模板库页会按所选数量自动拉取所需后端页并在前端聚合展示
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
  - 创建任务页“全部全选”优先将当前标签、严重级别、协议筛选作为扫描任务过滤条件提交，因此无需逐页拉取所有模板 ID；若当前只使用模板 ID 关键词筛选，由于创建任务接口没有关键词过滤字段，前端会分页拉取匹配模板 ID 作为兜底，请求失败或超时中断时会恢复按钮状态并展示错误提示
- 联调注意事项：
  - `items` 必须为数组
  - `totalPages` 若后端未返回，前端会基于 `total/pageSize` 兜底计算
  - `severity` 支持英文和中文，前端会做映射展示
  - `protocols` 推荐返回字符串数组；模板库列表页会按大写协议标签展示，缺失时显示 `--`
  - 模板库页修改每页数量后会将 `page` 重置为 `1`，并按所选数量重新请求/聚合列表

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
  - 列表页每页数量支持：`10`、`20`、`50`、`100`，默认使用 `10`
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
  - 修改每页数量后，前端会将 `page` 重置为 `1` 并重新请求列表

### 9. 创建扫描任务

- 用途：扫描任务创建页提交任务
- 请求方式：`POST`
- 路径：`/api/v1/scans`
- 请求参数：
  - 请求体为 JSON
  - 前端会按表单仅提交已填写字段
  - `created_by` 固定使用当前登录用户，由前端在提交前写入；创建页不提供手动编辑入口
  - 至少提交 `targets` 或 `inline_targets_list` 语义对应的目标数据；当前前端主要提交 `targets`
  - `attack_type`: `string`，攻击类型；新建任务默认选择全组合模式并提交 `clusterbomb`，重新创建任务时优先使用原任务配置
  - `preflight_fingerprint`: `boolean`，创建页“运行参数”中的“前置主动指纹探测”开关，默认 `true`；开启和关闭均显式提交布尔值，关闭时提交 `false`
  - 高级能力字段：
    - `dast`: `boolean`，启用 DAST/fuzzable 模板
    - `screenshot_capture`: `boolean`，是否在扫描前存活探测完成后采集 HTTP 存活目标截图，默认 `false`；开启和关闭均显式提交
    - `headless`: `boolean`，是否在主扫描中启用 Headless 模板；与截图采集相互独立
    - `interactsh_server`: `string`，当前任务使用的 Interactsh 服务根地址
    - `interactsh_token`: `string`，当前任务使用的 Interactsh 鉴权 Token，前端按密码输入处理，最长 255 个字符
    - `no_interactsh`: `boolean`，禁用当前任务的 Interactsh/OOB 请求
- 联调注意事项：
  - 当前后端不限制单次任务的目标数量上限
  - `preflight_fingerprint=false` 仅跳过前置 HTTP／非 HTTP 主动指纹探测；存活探测和 Wappalyzer 被动识别保留，仍受 `offline_http`、`disable_http_probe` 原有开关约束；自动模板映射及其检测模板流程不受影响。后端对省略或 `null` 按开启处理
  - `no_interactsh=true` 时，前端会阻止同时填写 `interactsh_server` 或 `interactsh_token`，与后端互斥约定保持一致
  - `interactsh_token` 仅在创建请求中提交，前端不会在任务查询页面展示该字段
  - “屏幕截图”是独立的扫描前资产采集能力；开启后前端将其视为已选择 `screenshot` Headless 模板，可单独满足模板必选校验，也可与自动模板映射同时开启，不会修改 `automatic_scan` 或 `headless`
  - `screenshot`（页面截图采集（headless））在模板列表中展示为随“高级能力”的“屏幕截图”开关选中，但不会作为主扫描模板写入 `include_ids`；前端通过 `screenshot_capture=true` 提交，由后端独立执行截图子阶段
  - 仅开启“屏幕截图”、关闭自动模板映射且未选择其他模板时，后端在存活探测、可选的前置主动指纹探测和截图后跳过主扫描，`plugin_count` 按 `screenshot` 计为 `1`
  - 创建页不再提供或提交“禁用 Headless 模板”字段，也不再从手动模板选择中排除 Headless 模板；主扫描是否执行 Headless 模板由 `headless` 控制
  - 点击“全部全选”只记录当前筛选范围，不再立即分页拉取全部模板。无筛选或仅按标签、严重级别、协议全选时，提交直接使用后端已有筛选字段，不物化数千个 `include_ids`；名称/模板 ID 关键字参与筛选，或同时开启截图且无其他筛选时，提交前才以有限并发分页解析匹配 ID，避免全选被后端误判为仅截图。独立截图模板 `screenshot` 不进入主扫描 ID
  - 兼容旧任务配置：若配置中的 `include_ids` 含 `screenshot`，前端回填时会迁移为 `screenshot_capture=true` 并从 `include_ids` 移除该模板 ID
  - 从扫描详情页点击“重新创建扫描”进入创建页时，前端会先请求 `GET /api/v1/scans/:id/config`，再消费一次性内存草稿并预填表单；草稿中的 `created_by` 会被忽略并改用当前登录用户
  - 从漏洞模板列表或模板详情页点击“扫描/开始扫描”进入创建页时，前端会消费一次性内存草稿，将对应模板 ID 写入 `include_ids` 并切换到模板选择步骤；该流程不新增后端接口
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
  - 后端沿用原任务的 `preflight_fingerprint` 配置，前端无需额外传参
  - `task_api` 建议返回 `/api/v1/scans/:id`，作为 `task.id` 缺失时的兜底解析来源

### 11. 获取扫描任务可复用配置

- 用途：扫描任务详情页“重新创建扫描”按钮读取原任务配置，并带入创建扫描任务页表单
- 请求方式：`GET`
- 路径：`/api/v1/scans/:id/config`
- 请求参数：
  - 路径参数 `id`: 原扫描任务 ID
- 返回结构：前端使用 `data.config`
  - `data.config` 返回可复用配置字段；创建页只回填当前仍受支持的任务参数
- 异常分支：
  - 请求失败时，在扫描详情页顶部展示错误提示
  - 返回配置为空或无法映射到创建页字段时，展示“当前任务缺少可带入创建页的扫描配置。”
- 联调注意事项：
  - 前端点击“重新创建扫描”时只读取配置并跳转创建页，不会创建或启动新任务
  - 前端会把 `data.config` 存入一次性内存草稿，创建页读取后立即清理；页面刷新后草稿不会保留
  - 模板筛选与选中状态一起回填：非自动映射任务未指定 `include_ids`、但指定了 `tags` / `severities` / `protocols` 时，匹配模板恢复为全部选中；指定 `include_ids` 时仅恢复对应模板选中。回填后调整筛选或模板选择，提交以当前选择为准
  - 前端会按创建页字段类型做兼容归一化，例如 JSON 字符串数组、多行字符串数组、布尔值、数字值和响应大小 MB 展示值
  - `preflight_fingerprint=false` 会回填为关闭，`true` 回填为开启；字段缺失或为 `null` 时沿用创建页默认开启，并在再次提交时保留用户选择
  - `screenshot_capture` 需随任务持久化并原样返回
  - `interactsh_token` 会按接口返回值回填到创建页密码输入框

### 12. 取消扫描任务

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

### 13. 暂停扫描任务

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

### 14. 恢复扫描任务

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
  - `page_size`: 每页条数，资产配置中心页支持 `10`、`20`、`50`、`100`，默认使用 `10`
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
  - 资产配置中心页修改每页数量后会将 `page` 重置为 `1` 并重新请求列表
  - 普通用户可进入资产配置中心查看列表和筛选；只有当前用户 `role=admin` 时才展示新增、编辑、删除入口
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
  - 只有当前用户 `role=admin` 时前端才展示新增入口并触发本接口

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
  - 只有当前用户 `role=admin` 时前端才展示编辑入口并触发本接口

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
  - 只有当前用户 `role=admin` 时前端才展示删除入口并触发本接口

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
  - 详情页“重新创建扫描”按钮不再依赖详情接口返回完整扫描配置，而是单独请求 `GET /api/v1/scans/:id/config`

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
  - 用户在日志顶部触发向前补载时，若本页 `has_more=false`，前端会在插入最后一页后定位到日志顶部；仍有更早日志时继续保持原可见日志位置
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
  - 前端使用 fetch-based SSE 适配器订阅日志流，会携带 `Authorization` 请求头
  - SSE 数据体应为 JSON
  - 事件体支持完整包裹结构，也兼容直接返回单条事件对象
  - 完成事件建议携带最终 `task/progress/events` 快照
  - 前端会把“最后已处理日志的 `seq`”作为 `offset` 传给流接口，依赖后端补发 `seq > offset` 的快照和后续事件

## 漏洞相关接口

### 17. 获取漏洞列表

- 用途：`/vulnerabilities` 漏洞查询页首屏加载、分页、筛选和手动刷新；侧边栏“漏洞”导航徽标展示未审核漏洞数
- 请求方式：`GET`
- 路径：`/api/v1/vulnerabilities`
- 请求参数：
  - `page`: 页码，筛选条件或每页数量变化后重置为 `1`
  - `page_size`: 每页数量，前端当前支持 `10`、`20`、`50`、`100`
  - 侧边栏未审核总数当前实际使用：`page=1`、`page_size=1`、`status=unreviewed`
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
  - `items[].asset_path`
  - `items[].asset_endpoint`
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
  - 进入页面默认请求 `page=1&page_size=10`；首页“未审核漏洞”的“查看漏洞”跳转 `/vulnerabilities?status=unreviewed`，首个列表请求即携带 `status=unreviewed`，筛选按钮同步显示“未审核”
  - 后端已支持 `keyword` 参数，匹配逻辑为 `LOWER(vulnerability_name) LIKE %keyword% OR LOWER(template_id) LIKE %keyword%`；该条件应与其他筛选条件做 `AND` 组合
  - 前端“搜索漏洞名称或 Template ID”输入框只会提交 `keyword`，不再自行判断应该传 `vulnerability_name` 还是 `template_id`
  - 入口 URL 的 `status` 和 `severity` 初始化对应筛选，兼容重复参数和逗号分隔，仅接受现有枚举并去重；优先关注入口为 `/vulnerabilities?status=unreviewed&severity=critical,high`，首个列表请求即发送 `status=unreviewed&severity=critical&severity=high`
  - `tags`、`status`、`severity` 和 `protocol` 均为下拉筛选，多选时前端会发送多个同名 query 参数
  - 漏洞页标签筛选候选来自 `/api/v1/templates/options/tags`；接口失败时回退为前端内置标签选项
  - 漏洞页“扫描任务”筛选候选来自 `/api/v1/scans/options/names`；接口失败时会展示错误提示并允许重试
  - 漏洞页“全选”会按当前已应用筛选条件，以 `page_size=100` 分页拉取所有匹配漏洞的 `items[].id`，用于后续批量操作
  - 侧边栏“漏洞”徽标会单独轮询本接口，间隔约 10 秒，并直接读取 `data.total` 作为未审核漏洞数
  - 首页统计使用独立的 dashboard 聚合接口（见第 29 节），不再通过漏洞列表分组读取总数；侧边栏徽标仍独立调用本接口
  - `pageSize`、`totalPages` 若后端字段命名变为 `page_size`、`total_pages`，前端也兼容
  - `severity`、`status`、`protocol` 展示前会统一转为小写 key；未知值按原值兜底展示
  - 漏洞状态展示映射：`unreviewed=未审核`、`confirmed=已确认`、`ticketed=已发单`、`fixed=已修复`、`false_positive=误报`、`ignored=忽略`
  - 列表资产地址优先展示 `asset_endpoint`；缺失时兼容回退到历史字段 `asset_domain` 和 `asset_host`，`asset_host` 仍用于 Host 筛选和资产信息补充
  - `asset_endpoint`、`asset_host`、`template_id`、`latest_scan_task_name`、`last_found_at` 缺失时会显示 `--`

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

- 用途：`/vulnerabilities/:id` 漏洞详情页展示漏洞完整业务字段、资产信息、时间线、Payload、参考链接和请求响应证据
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
  - `data.asset_path`
  - `data.asset_endpoint`
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
  - `data.extracted-results`
  - `data.payload`
  - `data.detail`
  - `data.vuln_fingerprint`
- 异常分支：
  - 请求失败时展示后端错误信息或“漏洞详情加载失败，请稍后重试。”
  - 详情为空时展示空状态和重新加载按钮
  - 字段缺失时前端以 `--`、`未提供` 或空数组兜底，不阻塞页面渲染
- 联调注意事项：
  - 列表行点击后跳转到 `/vulnerabilities/:id`，详情页请求 `GET /api/v1/vulnerabilities/:id`
  - `tags` 和 `reference_links` 推荐返回字符串数组；前端也兼容 JSON 字符串或分隔文本
  - `extracted-results` 为后端从 Nuclei 响应中提取的命中结果数组；前端按原顺序合并为单个代码块展示并支持一次性复制，缺失或空数组时展示“暂无提取结果”
  - `latest_scan_task_id` 会在右侧以 URL 跳转标记展示，点击后在新标签页打开 `/scan/:id`，前端会兼容映射到现有扫描任务详情页
  - `payload` 保存 Nuclei 命中结果顶层 `meta`；对象和数组会格式化为 JSON 代码面板，原始字符串按文本展示，并支持复制
  - 当 `payload` 对象包含 `usernames` 或 `passwords` 字段时，前端会在原始 JSON 面板上方分别展示为“账号”和“密码”字段，并支持独立复制；数组值按一行一个值展示和复制
  - `payload` 没有值时后端返回 `null`，前端展示“暂无 Payload”；漏洞列表接口不读取或展示该字段
  - `payload` 可能包含命中的账号、密码、Token、注入语句或其他字典值，仅在详情页展示，不写入前端日志或持久化缓存
  - `detail` 如果是对象，前端会读取 `request`、`response`、`curl-command` 并拆成代码面板展示
  - 当 `detail.request` / `detail.response` 是按步骤编号的对象时，前端会按编号升序展示为 `请求 1 / 响应 1 / 请求 2 / 响应 2` 的顺序
  - 当 `detail.request` / `detail.response` 是普通业务对象时，前端会将对象整体格式化为 JSON 代码块展示，不会把对象字段误拆为多步请求/响应
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

### 24. 下载扫描任务原始日志压缩包

- 用途：扫描任务详情页“扫描日志”区域的“下载原始日志”按钮；当任务状态为 `success`、`failed` 或 `cancelled` 时展示
- 请求方式：`GET`
- 路径：`/api/v1/scans/:id/raw-logs/archive`
- 请求参数：
  - 路径参数 `id`: 扫描任务 ID
- 返回结构：
  - 成功时直接返回 zip 文件流，文件名为 `<任务ID>.zip`
  - 失败时返回 JSON 错误，前端当前会优先读取 `message`
- 异常分支：
  - `40001`：任务 ID 非法
  - `40401`：任务不存在，或扫描原始日志目录不存在
  - `50001`：压缩或下载扫描原始日志失败
- 联调注意事项：
  - 该接口不是 JSON 接口，前端会以 `fetch + blob` 方式处理成功响应
  - 后端会实时压缩 `data/runtime/<任务ID>` 为 zip 并返回，zip 内保留 `<任务ID>/` 根目录
  - 下载成功后由浏览器直接保存为 zip 文件，不会跳转页面

### 25. 获取域名资产清单

- 用途：`/assets/domains` 域名资产清单页首屏加载、域名模糊搜索、展开式筛选和分页展示
- 请求方式：`GET`
- 路径：`/api/v1/domain-assets`
- 请求参数：
  - `page`: 页码，筛选条件或每页数量变化后重置为 `1`
  - `page_size`: 每页数量，前端当前支持 `10`、`20`、`50`、`100`
  - `keyword`: 顶部搜索框输入值，用于按域名或资产地址模糊搜索
  - `title`: “站点标题”筛选
  - `region`: “区域”筛选
  - `risk_level`: “风险等级”筛选，支持 `critical`、`high`、`medium`、`low`、`info`；“严重 / 高危”组合使用 `critical,high`，表示最高风险等级属于两者之一
  - `has_vulnerability`: “是否存在漏洞”筛选，前端提交 `true` 或 `false`
  - `has_component`: “是否存在组件”筛选，前端提交 `true` 或 `false`
- 返回结构：前端使用 `data.page`、`data.pageSize`、`data.total`、`data.totalPages`、`data.items`
  - `items[].id`
  - `items[].domain` 或 `items[].asset_address`
  - `items[].title`
  - `items[].region`，用于表格“区域”列展示
  - `items[].risk_level`
  - `items[].vulnerability_count`
  - `items[].critical_count`，用于“漏洞数量”列严重等级计数展示
  - `items[].high_count`，用于“漏洞数量”列高危等级计数展示
  - `items[].medium_count`，用于“漏洞数量”列中危等级计数展示
  - `items[].low_count`，用于“漏洞数量”列低危等级计数展示
  - `items[].component_count`
  - `items[].components`
- 异常分支：
  - 首屏失败时展示错误态和重新加载按钮
  - 有数据时刷新或筛选失败会保留当前列表，并在列表上方展示错误提示与重试按钮
  - 无数据时展示空状态；存在筛选条件时提供清空筛选入口
- 联调注意事项：
  - 进入页面默认请求 `page=1&page_size=10`；首页优先关注入口跳转 `/assets/domains?risk_level=critical,high`，首个列表请求携带 `risk_level=critical,high`，筛选 chip 显示“风险等级 严重 / 高危”
  - 入口 URL 的 `risk_level` 兼容重复参数和逗号分隔，仅接受现有枚举并去重；刷新和浏览器前进 / 后退恢复入口筛选，无 query 的同页导航恢复全部资产。筛选可编辑、单项移除或清空
  - 顶部搜索框防抖提交 `keyword`
  - “添加筛选条件”弹窗一次保存一个筛选项，筛选字段与表格展示列保持一致，已保存条件以 chip 展示，支持单项移除和清空全部
  - “是否存在漏洞”按 `vulnerability_count > 0` 语义筛选；“是否存在组件”按 `component_count > 0` 语义筛选
  - `risk_level`、`vulnerability_count` 和 `critical_count` / `high_count` / `medium_count` / `low_count` 由后端从漏洞等关联数据聚合返回；前端保留原有“风险等级”和“漏洞数量”展示样式，并在“漏洞数量”列按严重、高危、中危、低危四格展示不同等级数量
  - 不同等级漏洞数量也兼容 `vulnerability_counts`、`severity_counts`、`vuln_counts` 等对象结构，以及常见驼峰字段名；`vulnerability_count` 缺失时前端会用四个等级数量求和兜底
  - `risk_level` 展示前会统一归一化；中文风险值也兼容为对应等级；筛选项不提供 `unknown`，但展示层保留未知风险兜底
  - `component_count` 和 `components` 由后端从组件等关联数据聚合返回；前端保留原有“组件数量”展示
  - `components` 可返回字符串数组、逗号分隔字符串或为空；为空时仅展示组件数量
  - 后端 handler 已接收 `title`、`risk_level`、`has_vulnerability`、`has_component`，前端筛选参数与后端读取字段保持一致
  - `pageSize`、`totalPages` 若后端字段命名变为 `page_size`、`total_pages`，前端也兼容

### 26. 获取域名资产详情

- 用途：`/assets/domains/:domain` 域名资产详情页加载指定域名资产的基础信息、服务资产、标题历史和请求/响应证据
- 请求方式：`GET`
- 路径：`/api/v1/domain-assets/detail`
- 请求参数：
  - `domain`: 必填，域名资产地址；前端从路由 `/assets/domains/:domain` 中 `decodeURIComponent` 后传递，需与后端资产域名完全一致
- 返回结构：前端使用接口返回的 `data`
  - `domain`
  - `owner`
  - `title`
  - `first_alive_at`
  - `last_alive_at`
  - `region`
  - `risk_level`
  - `vulnerability_count`
  - `has_form`
  - `has_upload`
  - `has_admin`
  - `has_uc_login`
  - `has_baidu_login`
  - `manual_note`
  - `http_status_code`
  - `request`
  - `response`
  - `is_alive`
  - `service_assets[].app_name`
  - `service_assets[].app_version`
  - `service_assets[].first_found_at`
  - `service_assets[].last_found_at`
  - `service_assets[].is_alive`
  - `title_histories[].history_title`
  - `title_histories[].first_title_created_at`
  - `title_histories[].latest_title_alive_at`
  - `title_histories[].is_alive`
- 异常分支：
  - 缺少路由域名参数时展示错误提示和重新加载按钮
  - 接口失败或域名不存在时展示后端错误信息；详情数据清空时展示空态
  - 请求被新请求或页面卸载取消时不展示错误
- 联调注意事项：
  - 域名清单行点击后在新标签页打开 `/assets/domains/${encodeURIComponent(domain)}`，支持键盘 `Enter` 和空格进入详情
  - `risk_level` 展示前会统一归一化；中文风险值也兼容为对应等级；缺失时展示为未知
  - `vulnerability_count` 缺失时按 `0` 兜底，并在“资产概览”中展示
  - 详情页会把请求和响应分别展示为 `request.http`、`response.http`，并提供复制按钮
  - 页面截图不再读取详情接口的 `screenshot_path`，统一使用下述独立鉴权截图接口
  - 可空字符串、可空时间和状态码缺失时前端以 `--`、`暂无备注` 或 `未提供` 兜底

### 26.1 修改域名资产人工备注

- 用途：域名资产详情页“人工备注”卡片点击“修改备注”后保存人工备注
- 请求方式：`PATCH`
- 路径：`/api/v1/domain-assets/manual-note`
- 请求参数：
  - `domain`: 必填，域名资产地址；优先使用详情接口返回的 `domain`，为空时回退路由 `/assets/domains/:domain` 解码值
  - `manual_note`: 人工备注内容；允许空字符串，表示清空备注；前端限制最多 `5000` 个字符
- 返回结构：前端使用接口返回的 `data`
  - `domain`
  - `manual_note`
- 异常分支：
  - 保存中禁用关闭和提交按钮，避免重复提交
  - 保存失败时保留弹窗和用户输入，并在弹窗内展示后端错误信息
  - 页面卸载或再次提交时中断上一次保存请求；中断请求不展示错误
- 联调注意事项：
  - 请求体使用 JSON，字段名与后端保持蛇形命名
  - 保存成功后前端会立即更新当前详情页的 `manual_note` 展示，不额外刷新详情接口
  - 空字符串由后端裁剪并清空备注，前端归一化后展示为“暂无备注”

### 26.2 获取域名资产最新页面截图

- 用途：域名资产详情页“页面截图”卡片展示当前域名最新一次采集的页面截图
- 请求方式：`GET`
- 路径：`/api/v1/domain-assets/screenshots/latest`
- 请求参数：
  - `domain`: 必填；前端通过 `URLSearchParams` 编码后提交。详情域名缺少协议时会补充 HTTP/HTTPS 候选；`:443` 优先尝试省略默认端口的 HTTPS 地址，`:80` 优先尝试省略默认端口的 HTTP 地址，以兼容资产表保留端口、截图文件名按标准 URL 省略默认端口的现有数据
- 返回结构：前端使用接口返回的 `data`
  - `domain`
  - `captured_date`: 文件名中解析出的采集日期，格式为 `YYYY-MM-DD`
  - `file_name`: 截图文件名，仅作为文本展示
  - `content_type`: 仅接受 `image/png`、`image/jpeg`、`image/webp`
  - `image_base64`: 不含 Data URL 前缀的标准 Base64 图片数据
- 异常分支：
  - `40401`: 作为正常空态处理，截图卡片展示“暂无页面截图”
  - `40001`、`50001` 或网络错误：截图卡片展示错误信息和局部重试按钮，不影响资产详情其他区块
  - 图片内容无法由浏览器解码时回退为空态，不打开截图查看器
- 联调注意事项：
  - 本接口携带 `Authorization`
  - 前端只为三个允许的图片 MIME 组装 `data:<content_type>;base64,<image_base64>`，并在展示前校验 Base64 格式
  - 点击截图在当前页面的查看器中放大，不打开后端文件路径或外部 URL；查看器支持点击遮罩或按 `Escape` 关闭
  - 域名变化或页面卸载时会取消旧请求，旧响应不会覆盖新域名截图
  - 最新截图命中某个协议化域名后，历史截图沿用同一个 `domain`，避免最新图与历史记录使用不同文件名前缀

### 26.3 获取域名资产历史页面截图

- 用途：域名资产详情页展开“历史截图”后，按采集日期倒序查看历史截图并分页浏览
- 请求方式：`GET`
- 路径：`/api/v1/domain-assets/screenshots`
- 请求参数：
  - `domain`: 必填，与最新截图接口一致
  - `page`: 页码，从 `1` 开始
  - `page_size`: 每页数量；前端当前固定为 `4`，低于后端上限 `20`
- 返回结构：前端使用 `data.page`、`data.pageSize`、`data.total`、`data.totalPages`、`data.items`
  - `items[]` 的字段与最新页面截图接口一致
  - 前端同时兼容分页字段的蛇形命名 `page_size`、`total_pages`
- 异常分支：
  - 空 `items` 作为正常空态处理，展示“暂无历史截图”
  - `40001`、`50001` 或网络错误：历史区块保留展开状态并提供局部重试
  - 单张历史图片解码失败时只禁用对应图片，不影响同页其他截图
- 联调注意事项：
  - 本接口携带 `Authorization`
  - 历史记录默认不随详情首屏请求；用户首次展开后才加载第 `1` 页，减少 Base64 图片流量和首屏内存占用
  - 翻页期间显示历史区块骨架态，防止重复触发；页面卸载或域名变化时取消旧请求
  - 前端沿用后端排序，不再按日期或文件名进行二次排序

### 27. 获取主机资产清单

- 用途：`/assets/hosts` 主机资产清单页首屏加载、主机模糊搜索、展开式筛选和分页展示
- 请求方式：`GET`
- 路径：`/api/v1/host-assets`
- 请求参数：
  - `page`: 页码，筛选条件或每页数量变化后重置为 `1`
  - `page_size`: 每页数量，前端当前支持 `10`、`20`、`50`、`100`
  - `keyword`: 顶部搜索框输入值，用于按 IP、操作系统类型或关联域名模糊搜索
  - `os_type`: “操作系统类型”筛选
  - `region`: “区域”筛选
  - `risk_level`: “风险等级”筛选，支持 `critical`、`high`、`medium`、`low`、`info`；“严重 / 高危”组合使用 `critical,high`，表示最高风险等级属于两者之一
- 返回结构：前端使用 `data.page`、`data.pageSize`、`data.total`、`data.totalPages`、`data.items`
  - `items[].id`
  - `items[].ip_address` 或 `items[].asset_address`
  - `items[].os_type`
  - `items[].os_version`
  - `items[].region`，用于表格“区域”列展示
  - `items[].risk_level`
  - `items[].vulnerability_count`
  - `items[].critical_count`，用于“漏洞数量”列严重等级计数展示
  - `items[].high_count`，用于“漏洞数量”列高危等级计数展示
  - `items[].medium_count`，用于“漏洞数量”列中危等级计数展示
  - `items[].low_count`，用于“漏洞数量”列低危等级计数展示
  - `items[].port_count`
- 异常分支：
  - 首屏失败时展示错误态和重新加载按钮
  - 有数据时刷新或筛选失败会保留当前列表，并在列表上方展示错误提示与重试按钮
  - 无数据时展示空状态；存在筛选条件时提供清空筛选入口
- 联调注意事项：
  - 进入页面默认请求 `page=1&page_size=10`；首页优先关注入口跳转 `/assets/hosts?risk_level=critical,high`，首个列表请求携带 `risk_level=critical,high`，筛选 chip 显示“风险等级 严重 / 高危”
  - 入口 URL 的 `risk_level` 兼容重复参数和逗号分隔，仅接受现有枚举并去重；刷新和浏览器前进 / 后退恢复入口筛选，无 query 的同页导航恢复全部资产。筛选可编辑、单项移除或清空
  - 顶部搜索框防抖提交 `keyword`
  - “添加筛选条件”弹窗一次保存一个筛选项，已保存条件以 chip 展示，支持单项移除和清空全部
  - `risk_level`、`vulnerability_count` 和 `critical_count` / `high_count` / `medium_count` / `low_count` 由后端从漏洞等关联数据聚合返回；前端在“漏洞数量”列按严重、高危、中危、低危四格展示不同等级数量
  - 不同等级漏洞数量也兼容 `vulnerability_counts`、`severity_counts`、`vuln_counts` 等对象结构，以及常见驼峰字段名；`vulnerability_count` 缺失时前端会用四个等级数量求和兜底
  - `risk_level` 展示前会统一归一化；中文风险值也兼容为对应等级；筛选项不提供 `unknown`，但展示层保留未知风险兜底
  - `os_type` 与 `os_version` 同时存在时，前端会展示为“操作系统类型 / 操作系统版本”；缺失时以 `--` 兜底
  - `port_count` 表示存活端口数量，前端展示列文案为“端口数量”
  - 主机清单行点击后在新标签页打开 `/assets/hosts/${encodeURIComponent(ip_address)}`，支持键盘 `Enter` 和空格进入详情
  - 后端 handler 已接收 `keyword`、`os_type`、`region`、`risk_level`，前端筛选参数与后端读取字段保持一致
  - `pageSize`、`totalPages` 若后端字段命名变为 `page_size`、`total_pages`，前端也兼容

### 28. 获取主机资产详情

- 用途：`/assets/hosts/:ip` 主机资产详情页加载指定主机的基础信息、风险概览、关联域名、端口资产和备注
- 请求方式：`GET`
- 路径：`/api/v1/host-assets/detail`
- 请求参数：
  - `ip_address`: 必填，主机资产 IP 地址；前端从路由 `/assets/hosts/:ip` 中 `decodeURIComponent` 后传递，需与后端资产 IP 完全一致
- 返回结构：前端使用接口返回的 `data`
  - `ip_address`
  - `region`
  - `owner`
  - `os_type`
  - `os_version`
  - `scan_created_at`
  - `last_alive_at`
  - `manual_note`
  - `is_alive`
  - `related_domains`
  - `risk_level`
  - `vulnerability_count`
  - `ports[].port_protocol`
  - `ports[].port_number`
  - `ports[].service_name`
  - `ports[].app_name`
  - `ports[].app_version`
  - `ports[].is_alive`
  - `ports[].is_high_risk_port`
  - `ports[].last_alive_at`
  - `ports[].port_created_at`
- 异常分支：
  - 缺少路由 IP 参数时展示错误提示和重新加载按钮
  - 接口失败或主机不存在时展示后端错误信息；详情数据清空时展示空态
  - 请求被新请求或页面卸载取消时不展示错误
- 联调注意事项：
  - `risk_level` 展示前会统一归一化；中文风险值也兼容为对应等级；缺失时展示为未知
  - `vulnerability_count` 缺失时按 `0` 兜底，并在“资产概览”中展示
  - `ports` 缺失时按空数组兜底；端口资产展示协议、端口号、服务、应用、存活状态、高危端口标记和时间
  - `related_domains` 支持逗号、分号或换行分隔字符串；为空时展示暂无关联域名
  - 可空字符串和可空时间缺失时前端以 `--` 或 `暂无备注` 兜底

### 28.1 修改主机资产人工备注

- 用途：主机资产详情页“人工备注”卡片点击“修改备注”后保存人工备注
- 请求方式：`PATCH`
- 路径：`/api/v1/host-assets/manual-note`
- 请求参数：
  - `ip_address`: 必填，主机资产 IP 地址；优先使用详情接口返回的 `ip_address`，为空时回退路由 `/assets/hosts/:ip` 解码值
  - `manual_note`: 人工备注内容；允许空字符串，表示清空备注；前端限制最多 `5000` 个字符
- 返回结构：前端使用接口返回的 `data`
  - `ip_address`
  - `manual_note`
- 异常分支：
  - 保存中禁用关闭和提交按钮，避免重复提交
  - 保存失败时保留弹窗和用户输入，并在弹窗内展示后端错误信息
  - 页面卸载或再次提交时中断上一次保存请求；中断请求不展示错误
- 联调注意事项：
  - 请求体使用 JSON，字段名与后端保持蛇形命名
  - 后端会校验 `ip_address` 合法性；若返回 `40001`，前端展示后端错误信息
  - 保存成功后前端会立即更新当前详情页的 `manual_note` 展示，不额外刷新详情接口
  - 空字符串由后端裁剪并清空备注，前端归一化后展示为“暂无备注”


### 29. 首页仪表盘统计（四个独立聚合接口）

- 用途：`/` 首页的未审核漏洞、处理状态、主机和域名风险分布、优先关注、主机排行榜和服务指纹排行榜。
- 请求方式：四个 `GET` 并行发起，全部需要登录，统一携带 `Authorization: Bearer <access_token>`。
- 请求参数：全部无参数，不附加分页、时间范围或筛选条件；统计范围为全系统。
- 接口封装：`src/api/dashboard.js`；响应归一化：`src/utils/dashboard.js`；区块状态：`src/composables/useDashboardOverview.js`。

| 请求路径 | 页面用途 | 原始 `data` 结构 | 归一化结果 |
| --- | --- | --- | --- |
| `/api/v1/dashboard/overview` | 未审核漏洞、处理状态、高危开放端口 | `vulnerability_status: { total, unreviewed, confirmed, ticketed, fixed, false_positive, ignored }`；`pending_vulnerabilities: { total, critical, high, medium, low }`；`high_risk_open_ports` | `statuses`、`pending`（补充 `other`）、`highRiskOpenPorts` |
| `/api/v1/dashboard/asset-risks` | 主机 / 域名风险分布及高风险资产数量 | `hosts`、`domains`，各含 `{ critical, high, medium, low, no_risk, unknown }` | 两组分别整理为 `{ counts, total }`，`total` 为六项之和 |
| `/api/v1/dashboard/host-rankings` | 漏洞数量 / 开放端口 Top10 主机 | `top_vulnerabilities: [{ ip_address, vulnerability_count }]`；`top_ports: [{ ip_address, port_count }]` | `vulnerabilities`、`ports`，元素为 `{ key, label, count, route }` |
| `/api/v1/dashboard/service-fingerprints` | 域名应用 / 主机服务指纹 Top10 | `domains: [{ app_name, count }]`；`hosts: [{ service_name, count }]` | `domains`、`hosts`，元素为 `{ key, label, count, route: null }` |

- 返回协议：`{ code: 0, message: "success", data: ... }`，字段定义与 `SERVER_API.md` 的四个 dashboard 接口一致。
  - 数量必须是非负安全整数（兼容数值字符串）。缺失、`null`、布尔值、负数或非整数视为该区块失败，不转换为零。
  - 未审核等级数量之和不能超过未审核总数；未审核总数必须等于状态字段 `unreviewed`。已列出的处理状态数量之和不能超过漏洞总数，未识别状态可仅计入总数。
  - 排行榜字段必须为数组，名称必须为非空且不重复的字符串，数量必须有效；`[]` 为正常空状态，缺失数组为失败。
  - 排行榜按服务端顺序展示，前端最多取 10 项，不补零、不重新分组或拆分复合指纹。
- 统计口径：
  - “未审核漏洞”仅为 `unreviewed`，不包含已确认和已发单。页面仅展示总数和严重、高危、中危、低危四个等级；信息、未知等等级仍计入总数，因此四项之和可能小于总数。
  - 优先关注的严重 / 高危未审核数量为 `critical + high`；高危开放端口数量直接使用 `high_risk_open_ports`，仅计存活且标记高危的端口记录，不按主机去重。
  - 资产六类风险包含不存活资产，排除已修复、误报、忽略漏洞，以有效漏洞最高等级分类。`no_risk` 表示无有效漏洞；`unknown` 表示存在有效漏洞但等级均为信息、未知或未识别值。页面只展示严重、高危、中危、低危和无风险五行，未知风险仍计入资产总数及比例分母，不合并到无风险。
  - 域名按完整端点（含端口）关联，主机按 IP 关联；不进行跨类型资产去重。
  - 主机漏洞排行包含所有处理状态的漏洞，与资产风险口径不同。端口排行仅统计存活端口，TCP / UDP 分别计数；均只统计已登记主机，不要求主机本身存活。
  - 指纹仅统计存活且名称非空的记录；域名使用 `app_name`，主机使用 `service_name`，不按主机去重、不按版本拆分。Top10 的数量不等于全部服务总数。
  - 处理状态为当前库内分布，不表示近期趋势、修复效率或 SLA；无时间筛选。
- 异常分支：
  - HTTP 401 / `40101`：沿用统一登录失效处理，清理登录态并返回登录入口。
  - HTTP 503 / `50301`：聚合查询失败或超时，`data=null`；整个对应区块显示失败，不使用部分响应。
  - 若返回 HTTP 403 / `40301`：显示联系管理员提示。
  - 首次加载或失败且无历史结果显示 `--`；排行榜显示加载中或暂不可用，只有成功返回空数组时显示“暂无排行数据”。
  - 每个接口独立加载、失败和重试，较慢或失败的区块不阻塞其他区块。重试仅请求对应接口；全局刷新同时请求四个接口。
  - 刷新失败保留该区块上次成功数据并提示；前端单接口 15 秒超时，超时会取消请求。重复加载同一区块和离开页面会取消旧请求，旧响应不能覆盖新结果。
- 联调注意事项：
  - 挂载与手动刷新均为四个并行请求，无首页自动轮询；侧边栏扫描和漏洞徽标的现有轮询独立运行。
  - 后端 5 秒时限仅针对区块数据库查询，不等于端到端耗时；四个接口及其聚合查询不是同一事务快照，扫描入库或状态变动期间可能短暂不同步。
  - 主机排行项生成编码后的站内 `/assets/hosts/:ipAddress` 详情链接；指纹名称按文本显示，不生成外部链接。
  - 未审核卡片的“查看漏洞”跳转 `/vulnerabilities?status=unreviewed`，漏洞页从 URL 初始化状态与等级筛选（仅接收已有枚举，支持重复参数和逗号分隔并去重）；刷新及浏览器后退可以恢复入口筛选。同一漏洞页切换到无 query 的导航入口会恢复全部状态。用户仍可在页内清空或修改筛选。优先关注的三个入口分别应用“未审核 + 严重 / 高危漏洞”、“最高风险等级为严重 / 高危的主机”及“最高风险等级为严重 / 高危的域名”筛选；其他资产与漏洞入口跳转现有清单页面。
  - 首页不展示“你的 API Key”和“快捷操作”卡片。最新漏洞情报沿用原有组件和内容，不调用上述接口。
## 定时任务管理

- 用途：`/scheduled-jobs` 页面查询定时任务、查看详情和执行记录，并在执行期间轮询展示进度。
- 接口封装：`src/api/scheduledJobs.js`；请求统一使用 `src/utils/http.js` 自动携带登录令牌。
- 列表：`GET /api/v1/scheduled-jobs?page=&page_size=`，读取分页 `items`、`total`、`page_size`、`total_pages`；当前页面不提供搜索条件。
- 详情：`GET /api/v1/scheduled-jobs/:id`，展示名称、类型、Cron、时区、开关、并发策略、产出内容描述、最近执行状态与配置 JSON。响应中的 `output_description` 为任务产出内容说明，未设置时为空字符串；前端以纯文本展示并保留换行。
- 管理员写操作：`PUT /api/v1/scheduled-jobs/:id`、`DELETE /api/v1/scheduled-jobs/:id`、`POST /api/v1/scheduled-jobs/:id/trigger`、`POST /api/v1/scheduled-jobs/:id/stop`。当前前端不提供新建任务入口；编辑表单不提供任务类型修改，PUT 沿用详情中的 `job_type`，并校验名称、Cron 表达式和 `config_json`，后端仍是最终权限与参数校验方。编辑弹窗打开时会请求 `GET /api/v1/third-party-api-keys?page=1&page_size=100`，按分页总页数继续加载全部 API Key 配置，仅使用 `id`、`platform_url` 和 `description`；API Key ID 选择器只对 `platform_url` 做本地筛选，不读取或展示密钥明文。
- 取消运行：仅当实时执行状态为 `queued` 或 `running` 时向管理员展示“取消运行”按钮；点击后确认并调用 stop 接口。请求只取消当前实例，不修改 `enabled`、Cron 调度或后续自动执行；取消前已完成的操作不会回滚。接口返回 `data.cancel_requested_runs`，无活动实例时前端提示 `0`，最终状态通过执行记录轮询刷新为 `cancelled`。
- 执行记录：`GET /api/v1/scheduled-jobs/:id/runs?page=&page_size=`；单次详情：`GET /api/v1/scheduled-job-runs/:run_id`。记录使用 `error_message` 展示失败原因；状态为 `failed` 的记录提供“查看失败日志”按钮，以弹窗纯文本展示该字段，未返回时显示兜底提示。最近一次运行状态为 `success` 时，任务详情顶部展示“下载产出”按钮，调用 `GET /api/v1/scheduled-job-runs/:run_id/output` 下载产出文件；下载失败时展示接口返回的错误信息。
- 动态进度：列表中存在 `queued` 或 `running` 记录时，前端每 3 秒请求单次执行详情；状态变为终态后停止轮询并刷新记录。`progress_total=0` 时显示“进度暂不可计算”。
- 异常分支：沿用统一 HTTP 错误和登录失效处理；列表、详情、记录分别展示加载、空态和错误状态，管理员按钮对普通用户隐藏。
