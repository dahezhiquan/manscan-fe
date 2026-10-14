# Dashboard Page Overrides

> **PROJECT:** Manscan
> **Generated:** 2026-10-14 19:23:34
> **Page Type:** Dashboard / Data View

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page-Specific Rules

### Layout Overrides

- **Max Width:** 1400px or full-width
- **Grid:** 12-column grid for data flexibility
- **Sections:** 1. Dynamic hero (personalized), 2. Relevant features, 3. Tailored testimonials, 4. Smart CTA

### Spacing Overrides

- **Content Density:** High — optimize for information display

### Typography Overrides

- No overrides — use Master typography

### Color Overrides

- **Strategy:** Adaptive based on user data. A/B test color variations per segment.

### Component Overrides

- Avoid: Single row actions only
- Avoid: Auto-play high-res video loops

---

## Page-Specific Components

- No unique components for this page

---

## Recommendations

- Effects: Hover tooltips, chart zoom on click, row highlighting on hover, smooth filter animations, data loading spinners
- Data Entry: Allow multi-select and bulk edit
- Sustainability: Click-to-play or pause when off-screen
- CTA Placement: Context-aware placement based on user segment

## 仓库落地约定

- 本页为已登录安全控制台。沿用现有欢迎区、侧栏、卡片、字体和主题 token，将生成器的个性化分区建议映射为漏洞、资产、主机排行、指纹分布；不添加营销见证区或分群配色实验。
- 延续高密度信息布局：桌面左侧统计与排行，右侧优先关注、快捷操作及现有漏洞情报；窄屏逐步转为单列。
- Top10 采用横向条形排行和明确数量标签。颜色辅助表示严重等级，文字与数值提供完整含义；资产风险按六级分别展示。
- 四个数据区块分别加载、失败、重试。保留上次成功数据；无数据与无权限不以零值掩盖。
- 保留现有深色和卡通主题，通过主题 token 继承视觉，不引入新的字体、图表依赖或主题选择器。
