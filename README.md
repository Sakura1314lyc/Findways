# 寻路 · 中国道路档案馆

《毛泽东思想和中国特色社会主义理论体系概论》课程的历史情境探究学习系统。通过阅读档案摘要、整理线索和书写发现笔记，把历史条件、实践探索与理论形成联系起来。

## 课程内容

共 **11 关：2023 年版《毛概》教材八章主线 + 两个新时代拓展专题 + 一个综合关**。关卡数量与教材章数分别统计，拓展专题不冒充教材第八章，综合关用于跨章节串联。

| 对应章节 | 档案主题 |
|---|---|
| 第一章：毛泽东思想及其历史地位 | 从实际出发，答案在哪里？ |
| 第二章：新民主主义革命理论 | 革命道路为何走向农村？ |
| 第三章：社会主义改造理论 | 新中国如何走向社会主义？ |
| 第四章：社会主义建设道路初步探索的理论成果 | 建设自己的道路，先看什么？ |
| 第五章：中国特色社会主义理论体系的形成发展 | 理论如何在实践中接续发展？ |
| 第六章：邓小平理论 | 市场与社会主义能同行吗？ |
| 第七章：“三个代表”重要思想 | 时代变化，党的建设怎样回应？ |
| 第八章：科学发展观 | 发展快了，还要看什么？ |
| 新时代拓展一：社会主要矛盾的转化 | 生活更好了，新的需要是什么？ |
| 新时代拓展二：中国式现代化 | 现代化，怎样走出自己的路？ |
| 综合关：中国道路 | 这条道路是怎样走出来的？ |

常规关卡含 **6 张正确卡 + 2 张干扰卡**，其中一张正确卡会被“抽出”（缺失补全任务）：正确卡分「历史条件／实践探索／理论形成」三类，干扰卡似是而非，需要识别并写明剔除理由。每关另配套三级提示（3 次预算）、因果连线（为每张卡选择推动它形成的更早卡片）、缺失补全（用自己的话写回被抽出的卡片）、两条通关追问、一道当代迁移题，以及可解析的知识点关联。综合关采用时间轴机制：12 张卡（10 个关键节点 + 2 张干扰卡）按年代排序，通关后完成主线归位与追问、迁移。档案卡逐张注明出处，正文是依据教材与列明文献编写的**教学摘要，不是史料原文**。关卡顺序并非对理论形成过程的全部历史细节作穷尽描述。

章节核对：[2023 修订版教材教学计划](https://mksxy.gench.edu.cn/2023/0530/c808a131034/page.htm)。新时代拓展依据：[十九大报告相关论述](https://www.moe.gov.cn/jyb_xwfb/xw_zt/moe_357/jyzt_2017nztzl/2017_zt13/17zt13_zyjs/201711/t20171103_318308.html)、[二十大报告](https://app.www.gov.cn/govdata/gov/202210/25/493662/article.html)。课堂使用时结合教材和授课要求核对。

## 学生如何使用

1. 登录后打开档案，逐张阅读带出处的材料卡，其中混入了 2 张似是而非的干扰卡、并被抽走了 1 张正确卡。
2. 把每张卡归入「历史条件／实践探索／理论形成」，或标记为「不属于本关」并写下剔除理由；卡点时可消耗提示预算（每关 3 次，三级递进）。
3. 提交核对后返回分项反馈：归类正确数、干扰卡剔除数、得分与逐卡提示。正确率达标才通过；通过后服务器才返回理论摘要和发现笔记提示。
4. 完成通关任务：①因果连线——为每张卡选择推动它形成的更早卡片；②缺失补全——用自己的话写回被抽走的卡片；③两条追问；④一道当代迁移题。
5. 写下发现笔记，到“我的发现”回看笔记和个人学习报告；到“档案主线”查看四条思想线索的收集进度，集齐后写下主线小结。
6. 完成八章与拓展关卡后，可以挑战综合关：把十个关键节点排成一条时间轴，再为每张卡片找回所属主线。

界面保留纸质档案与专题线稿风格。手机为单列卡片布局，已完成的归类会恢复，未提交笔记保存在当前浏览器标签页中。

## 档案探究 Agent

关卡侧栏提供分步探究：Agent 观察当前账号、本关进度和合法排序的核对记录；根据提问或指定卡片选择档案材料；排序解锁后，还能检索本关关联的理论手册知识点；最后提出一个需要学生自己验证的问题。界面显示本轮用到的工具、材料和出处，支持回看最近的探究记录。

默认离线模式使用相同的观察、取证和提问流程，根据问题匹配材料并轮换线索。配置兼容大模型时，模型负责选择已授权的取证工具、材料编号和提问方式；后端核验选择是否属于本关、是否已解锁，再读取材料。模型异常或选择无效时回落离线规划。Agent 不输出卡片的正确归类、干扰卡身份、未解锁的理论摘要或内部引导问题，也不会替学生归类或写笔记。外部模型只收到本关公开材料、学习阶段和本关最近三次提问，不发送笔记正文。

新增 `POST /api/v1/archives/cases/{code}/agent` 和 `GET /api/v1/archives/cases/{code}/agent/history`；原 `/guide` 接口保留。探究记录存于 `archive_agent_turns`，只对当前账号开放。

## 档案主线

`GET /api/v1/archives/threads` 汇总四条贯穿各关的思想线索（实事求是／群众路线／独立自主／矛盾分析）。每条主线的卡片只统计**已通关且已完成缺失补全**的关卡；未收集的卡片不会提前展示，列表接口也不会暴露标明归属的字段。集齐一条主线后显示为已集齐，学生可以写下主线小结（草稿阶段也可保存），记录用 `POST /api/v1/archives/threads/{thread}/note` 按账号隔离保存到 `archive_thread_notes`。

## 教师看板

`GET /api/v1/teacher/overview` 面向教师角色，返回匿名聚合数据：参与学生数、核对次数、通关与笔记数，以及两张表——各档案通过情况（按通过率升序）与**错卡热力图**（按错误率降序，区分归类错、顺序错与漏剔除）。数据只到卡片层面，含账号信息与笔记正文均不下发，便于备课时决定先讲哪段史实。

教师角色通过 `POST /api/v1/users/me/teacher` 声明，验证码在后端 `.env` 的 `TEACHER_CODE` 中配置；未配置时接口返回 403，前端入口自动隐藏。每位学生每次核对都会累计卡片级错误计数（存于进度记录的 `detail` 字段），因此热力图反映的是真实练习分布。

## 个人学习报告

`GET /api/v1/archives/report` 需要登录，只读取当前账号的数据，返回 Pydantic 定义的结构：

- 每章节完成度、各关状态、未完成提醒。
- 线索一次通过率：有完整起始记录且已提交至少一次合法排序的关卡中，首次排序成功的比例。非法或重复卡片请求不计入，已解锁后的重复核对不计入。
- 历史关卡没有尝试记录时标为未知，不倒推、不补造；分母为零时返回 `null`。
- 笔记字数按已保存的当前文本统计，去掉空白，包含标点；不读取浏览器草稿。
- 时间分布按北京时间统计开启与首次完成日期。当前笔记字数归集到首次完成日，不代表当天写作量，不估算学习时长。
- 无进度时返回空态，包含可探索的档案列表。

默认离线模式使用确定性统计和建议。配置 LLM 后，模型只能从统计支持的建议中选择最多两项；服务端验证编号并使用固定文本，避免生成不存在的行为、分数或时长。模型异常、超时或输出非法时回落离线。报告不向模型发送账号身份或笔记正文。

报告当前仅面向学生本人，没有新增教师查看他人数据的入口。

## 启动

需要 Python 3.12+、Node.js ^20.19 或 >=22.12，虚拟环境位于**项目根目录 `.venv`**。

### 后端（从项目根目录执行）

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".\backend[dev]"
Copy-Item backend/.env.example backend/.env
cd backend
..\.venv\Scripts\python.exe -m alembic upgrade head
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

已有虚拟环境和 `.env` 时直接使用，不必重新创建或覆盖。开发数据库默认是 `backend/mingbian.db`。部署前必须运行迁移；开发环境自动建表不能代替对已有数据库的升级。

首次启动播种知识点，档案关卡读取 `backend/app/seeds/archive_cases.json`。修改关卡 JSON 后需重启后端，清除进程中的缓存。接口文档：`http://localhost:8000/docs`。

默认 `LLM_PROVIDER=mock`，无需 API Key 即可完成全部流程。可在后端 `.env` 配置兼容模型；缺少 Key 时自动使用离线模式。进度与笔记保存在自有数据库中。

### 前端（另开终端，从项目根目录执行）

```powershell
cd frontend
npm install
npm run dev
```

打开 `http://localhost:5173`，注册后开始探索。Vite 将 `/api` 代理到后端。

### Docker

```powershell
Copy-Item .env.example .env
docker compose up --build -d
```

前端地址为 `http://localhost:8080`，Compose 先执行迁移再启动后端。

## 数据库升级与备份

当前迁移头为 `68e199016eeb`：新增 `archive_thread_notes`，按账号保存主线小结。此前的 `593e150c7e9f` 为 `archive_progress` 增加卡片体系的进度字段（`attempts`、`hints_used`、`best_score`、`passed_at`、`probe_passed`、`detail`），历史行按默认值补齐，笔记与完成状态不受影响；`a619e238c704` 新增 `archive_agent_turns`，保存每关探究记录；`d04b37a12082` 新增 `archive_activities`，记录新关卡开启和合法核对尝试；`c91f2a60d701` 清理已下线功能的六张表。`archive_progress`、`knowledge_points`、`users`、`refresh_tokens` 保留。

升级前备份数据库。此次本地修改前的数据库与源码备份位于项目 `backups/`，该目录不纳入版本管理。迁移 downgrade 能恢复移除的表结构，但不能恢复删除的数据；数据恢复需使用升级前备份。

```powershell
cd backend
..\.venv\Scripts\python.exe -m alembic upgrade head
```

仅在测试数据库验证回退：`alembic downgrade 74d153f6ae20`，随后 `alembic upgrade head`。迁移测试会验证往返升级和保留的档案笔记，且不会访问开发数据库。

## 验证（从项目根目录执行）

```powershell
.\.venv\Scripts\python.exe -m ruff check backend/app backend/tests
cd backend
..\.venv\Scripts\python.exe -m pytest -q
cd ../frontend
npm run build
npm run smoke
```

pytest 使用临时 SQLite 和 mock 模型，覆盖卡片计分（归类、干扰剔除、压线通过与不通过）、剔除理由必填、非法提交、提示阶梯与耗尽、因果连线（多来源接受、载荷校验）、缺失补全（要点覆盖、原文揭示）、时间轴（分区校验、位置计分、干扰剔除）、主线归位（多来源答案、载荷校验）、通关追问与迁移判定、解锁前后字段隔离、主线收集（隐藏卡需补全后才计入、账号隔离、小结更新）、教师看板（角色声明、匿名聚合、错卡计数与前后差值）、Agent 分阶段取证与历史记录、报告空态/部分/全部完成、历史尝试缺失、模型异常回落与迁移往返。

smoke 需已启动前后端及本机 Chrome，覆盖注册、卡片归类与干扰剔除、提示、因果连线、缺失补全、追问与迁移、解锁、综合关时间轴与主线归位、Agent 取证与历史恢复、草稿恢复、保存笔记、学习报告、档案主线、拓展与综合关筛选和移动端溢出检查。可配置 `CHROME_PATH`、`SMOKE_BASE_URL`、`SMOKE_OUTPUT`；使用独立测试数据库运行，避免写入日常账号数据。

## 主要目录

- `backend/app/api/v1/archives.py`：关卡、核对、提示、追问、迁移、因果连线、缺失补全、时间轴、主线归位、主线、解锁、进度与报告入口。
- `backend/app/api/v1/teacher.py`：教师看板接口。
- `backend/app/services/archive_cards_service.py`：卡片计分、提示阶梯、因果连线、缺失补全、时间轴与主线归位判定、解锁前后的字段裁剪。
- `backend/app/services/archive_loader.py`：关卡数据的共享加载器。
- `backend/app/services/teacher_service.py`：匿名聚合与错卡热力图统计。
- `backend/app/services/archive_thread_service.py`：四条主线的收集统计与小结保存。
- `backend/app/db/models/archive_thread.py`：按账号保存主线小结。
- `backend/app/seeds/archive_cases.json`：10 个关卡的卡片体系数据（正确卡、干扰卡、提示、追问、迁移题、因果边、缺失卡）。
- `backend/tests/test_archive_cards.py`：卡片服务单元测试（计分、提示、连线、补全、字段隔离）。
- `backend/tests/test_archive_timeline.py`：综合关时间轴与主线归位测试。
- `backend/tests/test_archive_threads.py`：主线收集、隐藏卡保护、小结隔离测试。
- `backend/tests/test_teacher.py`：教师角色声明、匿名聚合与错卡计数测试。
- `backend/app/services/archive_report_service.py`：报告统计和受约束的模型点评。
- `backend/app/repositories/archive_report.py`：按账号查询进度与活动记录。
- `backend/app/schemas/archive_report.py`：报告响应结构。
- `backend/app/db/models/archive.py`：原有个人探索进度。
- `backend/app/db/models/archive_activity.py`：新增活动记录。
- `backend/app/services/archive_agent_service.py`：探究 Agent 的观察、规划、取证与下一步提问。
- `backend/app/db/models/archive_agent.py`：按账号保存本关探究记录。
- `frontend/src/components/ArchiveAgentPanel.tsx`：展示取证依据、提问入口和探究历史。
- `frontend/src/pages/ThreadsPage.tsx`：档案主线页面，展示收集进度与主线小结。
- `frontend/src/pages/TeacherPage.tsx`：教师看板，展示匿名汇总与错卡热力图。
- `frontend/src/components/LearningReport.tsx`：学习报告区块。
- `frontend/src/pages/JournalPage.tsx`：发现笔记与学习报告。

保留 archives、knowledge、auth、users/me 和 health 接口。详情接口必须登录；仅当前账号核对通过后才返回 `theory_summary`、`reflection_prompt`、提示全文、追问、迁移答案与因果连线题目。任何响应在解锁前都不下发卡片 `stage`、干扰卡身份（`variant`、`reject_reason`）或内部 `guide_questions`；被抽出的卡片正文只有完成缺失补全后才返回；因果连线的可接受来源在提交前不下发；未通关（或未补全）关卡的主线卡片不会出现在主线接口中；列表接口只返回卡片摘要。
