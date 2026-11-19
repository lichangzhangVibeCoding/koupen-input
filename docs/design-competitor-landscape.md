# 竞品调研与需求闭环

> 状态：管理后台 **竞品分析** + **需求管理**（`talknowAPi/admin`）  
> 默认复查周期：**30 天**

## 1. 入库标准

| 类型 | 何时入库 | 示例 |
|------|----------|------|
| `commercial` | 同赛道有付费/会员产品，与 TalkNow 能力重叠 | 闪电说、通义 CosyFlow |
| `opensource` | 开源方案可对照架构或 UX | DoNotType |
| `internal` | 内部定位/能力对照文档，非外部产品 | positioning 笔记 |

**不入库**：WorkBuddy 等纯营销场景参照（可在官网文案写，不进竞品表）。

当前种子（不含 WorkBuddy）：

- **闪电说** — Agent / skills / 双账本
- **通义 CosyFlow** — 移动语音转写 adjacent
- **DoNotType** — 屏幕上下文 dictation（重叠最高）

## 2. 管理后台 Tab

正式环境：`https://www.lizhenning.com/other/typenow/talknowAPi/admin/index.php`

| Tab | 作用 |
|-----|------|
| **竞品分析** | 档案、报告时间线、写 periodic 报告 |
| **需求管理** | backlog 优先级、采纳到产品规划 |
| **产品规划** | 执行向 roadmap（可从需求 promote） |
| **工作台** | 待复查竞品、待处理需求、最新调研 |

数据表：`tn_competitors`、`tn_competitor_reports`、`tn_product_requirements`。

## 3. 30 天复查 SOP

1. **工作台**看「待复查竞品」（`next_review_at` 已过期且 `status=active`）。
2. 打开竞品 → 查 changelog / release / 官网 / 社媒 / GitHub releases。
3. 写 **`periodic`** 或 **`release_note`** 报告：
   - 标题、调研日期、正文 Markdown
   - 来源 URL（每行一个）
   - 要点：`标题 | 详情 | impact`（watch / learn / urgent）
4. 保存报告后系统自动更新 `last_reviewed_at` 并重算 `next_review_at = reviewed_at + 30d`。
5. 更新档案 **summary**（一句话定位变化）。
6. **提炼需求**：报告页「从报告提炼需求」→ 需求池排 P0–P3 → **采纳到规划** 进入 roadmap。

报告类型：

- `initial` — 首次入库
- `periodic` — 定期复查
- `release_note` — 版本/发布公告快照
- `deep_dive` — 架构/专项（见 `design-competitor-donottype.md`）

## 4. 与 Cursor Agent 协作

1. 你把竞品链接丢给 Agent（官网 / GitHub / 文档）。
2. Agent 调研后输出 Markdown 报告（或你粘贴到后台「写报告」表单）。
3. Agent 可对照 `docs/design-competitor-*.md` 与代码路径给出「借鉴 / 不跟进」结论。
4. 你在 **需求管理** 里确认优先级；P0/P1 从工作台可见。

约定：Agent **不**把 WorkBuddy 写入竞品表；TalkNow 稳定差异化见下节。

## 5. TalkNow 稳定差异化（对照用）

- **四条能力**：即刻对话 / 帮我对话 / 看屏幕 / 看屏幕答题
- **粘贴不代发**；联系人 / 性格包 / 场景包
- **统一积分会员**（非双账本）；桌面全局热键为主战场
- **不是**又一个桌面 Agent 壳；技能/Agent marketplace 后置且要做稳

## 6. API（admin，WAF 友好 POST）

| 路径 | 说明 |
|------|------|
| `GET /v1/admin/competitors` | 列表 + overdue |
| `GET /v1/admin/competitors/:id` | 详情 + 报告 + 关联需求 |
| `POST /v1/admin/competitor-save` | 档案 |
| `POST /v1/admin/competitor-report-save` | 报告（更新复查日） |
| `GET /v1/admin/requirements` | 需求池 |
| `POST /v1/admin/requirement-save` | 需求 |
| `POST /v1/admin/requirement-promote` | 采纳 → `tn_roadmap_items` |

`GET /v1/admin/overview` 含 `competitorsOverdue`、`requirementsPending`、`recentReports`。
