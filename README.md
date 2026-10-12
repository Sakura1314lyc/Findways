# 寻路 · 中国道路档案馆

寻路是一个《毛泽东思想和中国特色社会主义理论体系概论》课程项目。学生从历史档案入手，阅读材料、识别干扰卡、整理线索，再用自己的话写下发现，理解理论怎样从中国实践中形成。

项目包含 11 个关卡、理论手册、个人学习报告和教师看板。接入大模型后，还可以使用聊天助手进行课程答疑、学习咨询和日常聊天。

[本地运行](#本地运行) · [怎么玩](#怎么玩) · [课程内容](#课程内容) · [配置聊天模型](#配置聊天模型) · [Docker 部署](#docker-部署) · [开发与验证](#开发与验证)

## 本地运行

需要 Python 3.12+、Node.js 20.19+（20.x）或 22.12+（22.x 及更高版本）。以下命令使用 Windows PowerShell，虚拟环境建在项目根目录 `.venv`。

### 第一次启动

从项目根目录打开终端，安装后端依赖、创建配置并执行数据库迁移：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".\backend[dev]"
Copy-Item backend/.env.example backend/.env
cd backend
..\.venv\Scripts\python.exe -m alembic upgrade head
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

已有 `.venv` 和 `backend/.env` 时，沿用现有文件，不要覆盖配置。

另开一个终端，从项目根目录启动前端：

```powershell
cd frontend
npm install
npm run dev
```

打开 [http://localhost:5173](http://localhost:5173)，注册账号后即可开始。接口文档在 [http://localhost:8000/docs](http://localhost:8000/docs)，Vite 默认把 `/api` 请求代理到 `http://127.0.0.1:8000`。

默认配置为 `LLM_PROVIDER=mock`，不需要 API Key 就能完成档案学习流程。聊天会显示“模型待连接”，配置方法见[聊天助手](#聊天助手)。这里的“离线”指不依赖外部模型服务，前后端仍需正常运行。

### 之后每次启动

后端终端，从项目根目录执行：

```powershell
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

前端终端，从项目根目录执行：

```powershell
cd frontend
npm run dev
```

更新代码后，如果有数据库迁移，先在 `backend` 目录运行 `..\.venv\Scripts\python.exe -m alembic upgrade head`，再启动后端。修改 `backend/.env` 或关卡 JSON 后，也需要重启后端。

## 怎么玩

1. 打开“档案关卡”。电脑端每排两张封面，封面标有章节和主题；点击后，介绍会在卡片右侧展开，点击“进入探索”才进入关卡。手机端介绍展开在封面下方。
2. 阅读带出处的材料卡，把它们归入“历史条件”“实践探索”或“理论形成”。不符合本关的卡片放入“不属于本关”，并写下剔除理由。
3. 提交核对，查看归类、干扰卡剔除和逐卡反馈。遇到卡点可以请求提示，每关有 3 次机会，提示逐级展开。
4. 核对通过后，完成因果连线、缺失卡补全、两条追问和一道当代迁移题，再写下发现笔记。理论摘要和笔记提示会在通过后解锁。
5. 到“我的发现”回看笔记和个人报告，到“档案主线”查看四条思想线索的收集进度，并保存主线小结。
6. 完成各章与拓展关卡后，可以挑战综合关：把十个关键节点排成时间轴，再为卡片找回所属主线。

桌面导航可以打开或收起；页面采用纸质题签、卷宗和专题线稿的设计。手机端使用单列卡片。已保存的归类会恢复，未提交的笔记草稿保留在当前浏览器标签页中。

需要核对答案时，可查看[当前关卡参考答案](docs/当前关卡参考答案.md)。其中的发现笔记是写作示例，开放题没有唯一标答。

## 课程内容

共 11 关：2023 年版教材的八章各对应一关，另有两个新时代拓展专题和一个综合关。第八章对应“科学发展观”，新时代内容单独列为拓展专题；综合关用于串联各章。

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

常规关卡各有 6 张正确卡和 2 张干扰卡。一张正确卡起初被抽出，因此首次进入时会看到 7 张卡；完成缺失补全后，才能看到被抽出的材料。正确卡分为“历史条件”“实践探索”“理论形成”，干扰卡需要写明剔除理由。

每关配有三级提示、因果连线、缺失补全、两条通关追问、一道当代迁移题和关联知识点。综合关使用时间轴：12 张卡中包含 10 个关键节点和 2 张干扰卡，排序通过后再完成主线归位、追问与迁移。

档案卡逐张注明出处。正文是依据教材和所列文献编写的教学摘要，引用时应回到原始材料核对。关卡只选取了部分历史线索，不能替代完整的教材学习。

章节核对：[2023 修订版教材教学计划](https://mksxy.gench.edu.cn/2023/0530/c808a131034/page.htm)。新时代拓展依据：[十九大报告相关论述](https://www.moe.gov.cn/jyb_xwfb/xw_zt/moe_357/jyzt_2017nztzl/2017_zt13/17zt13_zyjs/201711/t20171103_318308.html)、[二十大报告](https://app.www.gov.cn/govdata/gov/202210/25/493662/article.html)。课堂使用时结合教材和授课要求核对。

## 聊天助手

从导航打开“聊天助手”，可以聊课程问题、学习和生活咨询，也可以问一般知识或日常闲聊。电脑端关卡侧栏内可以直接提问，手机端通过聊天入口打开完整页面。

关联关卡的对话会附带公开档案及出处，课程问题还会检索理论手册。其他话题可以直接交流。

回复由配置的大模型生成，支持连续追问，以及 Markdown 列表、表格和代码块。模型每次接收最近最多六轮对话，历史内容还有字数限制；完整消息保存在项目数据库中，可以重新打开、查看更早的消息或删除会话。

对话按账号隔离。未发送的输入保留在当前浏览器标签页，失败后可以重试，同一请求不会重复保存消息。

未配置模型时，聊天显示“模型待连接”，档案游戏仍可使用。模型故障会提示重试，服务不会用模板冒充模型回复。当前没有联网搜索、实时天气等工具，涉及课程的回答仍需结合教材核对。

聊天输入和必要的公开课程资料会发送给你配置的模型服务，账号资料和发现笔记不会自动发送。

聊天接口统一位于 `/api/v1/chat`：`/status` 查询模型状态，`/sessions` 列出或创建会话，`/sessions/{id}` 查看或删除会话，`/sessions/{id}/messages` 发送消息。

### 配置聊天模型

本地运行时，在 `backend/.env` 填写兼容 Chat Completions 协议的服务配置，然后重启后端。例如：

```dotenv
LLM_PROVIDER=deepseek
LLM_API_KEY=填写你自己的密钥
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
```

其他兼容服务使用 `LLM_PROVIDER=openai_compatible`，地址和模型名称按服务商说明填写。`LLM_TIMEOUT_SECONDS` 和 `LLM_MAX_RETRIES` 控制调用超时与重试，聊天请求整体最多等待 90 秒。

API Key 只放后端配置，不写入前端或提交到 Git。Docker 部署使用项目根目录的 `.env`，见[部署说明](#docker-部署)。

## 档案主线

“档案主线”汇总实事求是、群众路线、独立自主和矛盾分析四条线索。关卡核对通过后，已公开的主线卡片计入收集；被抽出的卡片要等缺失补全完成后才计入。未收集的材料不会提前展示。

集齐一条主线后会显示“已集齐”，也可以在收集过程中保存小结。`GET /api/v1/archives/threads` 返回收集进度，`POST /api/v1/archives/threads/{thread}/note` 保存小结，记录按账号隔离存入 `archive_thread_notes`。

## 教师看板

教师看板通过 `GET /api/v1/teacher/overview` 提供匿名汇总：参与学生数、核对次数、通关和笔记数，以及各档案的通过情况与错卡热力图。

档案按通过率升序排列，错卡按错误率降序排列，区分归类错、顺序错和漏剔除。每次核对都会把卡片级错误计数写入进度记录的 `detail` 字段。看板不返回账号信息或笔记正文。

本地运行时，先在 `backend/.env` 配置 `TEACHER_CODE` 并重启后端。登录后访问 `/teacher`，输入验证码即可申请教师角色，对应接口为 `POST /api/v1/users/me/teacher`。未配置验证码时，申请接口返回 403；导航中的教师入口只对教师角色显示。Docker 使用教师功能时，还需在 Compose 的后端服务中传入 `TEACHER_CODE`。

## 个人学习报告

`GET /api/v1/archives/report` 需要登录，只读取当前账号的数据，返回 Pydantic 定义的结构：

- 每章节完成度、各关状态、未完成提醒。
- 线索一次通过率：有完整起始记录且已提交至少一次合法排序的关卡中，首次排序成功的比例。非法或重复卡片请求不计入，已解锁后的重复核对不计入。
- 历史关卡没有尝试记录时标为未知，不倒推、不补造；分母为零时返回 `null`。
- 笔记字数按已保存的当前文本统计，去掉空白，包含标点；不读取浏览器草稿。
- 时间分布按北京时间统计开启与首次完成日期。当前笔记字数归集到首次完成日，不代表当天写作量，不估算学习时长。
- 无进度时返回空态，包含可探索的档案列表。

未配置模型时，报告根据已有记录生成统计和建议。配置模型后，模型从统计支持的建议中选择最多两项，服务端验证编号并使用固定文本；模型异常、超时或输出非法时，继续使用本地统计建议。报告不向模型发送账号身份或笔记正文，也不推测没有记录的行为、分数或时长。

报告仅面向学生本人，教师看板提供匿名汇总。

## Docker 部署

从项目根目录执行。先复制配置文件，填写自己的 `SECRET_KEY`；需要聊天时，同时填写模型配置。

```powershell
Copy-Item .env.example .env
```

配置好 `.env` 后启动：

```powershell
docker compose up --build -d
```

前端地址为 [http://localhost:8080](http://localhost:8080)。Compose 使用 PostgreSQL，数据保存在 `pgdata` 卷中，后端启动前会自动执行数据库迁移。

如果部署到服务器，账号、学习进度和聊天记录也会保存在服务器的数据库中。本地开发数据库不会随代码自动迁移过去。

## 数据库升级与备份

按上面的启动命令运行时，本地默认使用 SQLite，文件位于 `backend/mingbian.db`。数据库保存账号、学习进度、笔记和聊天记录；具体连接由 `DATABASE_URL` 决定。

升级前先备份数据库。SQLite 可以在停止后端后复制数据库文件，PostgreSQL 则使用对应的数据库备份工具。`.env`、数据库文件和 `backups/` 都不纳入版本管理。

当前迁移头是 `f92d3e48a761`，包含 `chat_sessions` 和 `chat_messages`。更新已有数据库时，在项目根目录执行：

```powershell
cd backend
..\.venv\Scripts\python.exe -m alembic upgrade head
```

开发环境自动建表不能代替已有数据库的迁移。`downgrade` 可以恢复被移除的表结构，但无法恢复已删除的数据；数据恢复需要升级前的备份。

<details>
<summary>迁移记录与回退测试</summary>

| 迁移版本 | 内容 |
|---|---|
| `c91f2a60d701` | 清理已下线功能的六张表 |
| `d04b37a12082` | 增加 `archive_activities` |
| `a619e238c704` | 增加 `archive_agent_turns` |
| `593e150c7e9f` | 增加卡片体系的进度字段 |
| `68e199016eeb` | 增加 `archive_thread_notes` |
| `f92d3e48a761` | 增加聊天会话与消息表，保留原有账号、学习进度、笔记和旧探究记录 |

仅在测试数据库验证回退：`alembic downgrade 74d153f6ae20`，随后 `alembic upgrade head`。迁移测试使用临时数据库，检查往返升级和档案笔记保留，不访问开发数据库。

</details>

## 开发与验证

后端使用 FastAPI、SQLAlchemy 和 Alembic，前端使用 React、TypeScript 和 Vite。后端启动时根据 `SEED_ON_STARTUP` 配置播种知识点；关卡数据从 `backend/app/seeds/archive_cases.json` 加载并缓存在进程中。

从项目根目录执行静态检查、后端测试和前端构建：

```powershell
.\.venv\Scripts\python.exe -m ruff check backend/app backend/tests
cd backend
..\.venv\Scripts\python.exe -m pytest -q
cd ../frontend
npm run build
```

pytest 使用临时 SQLite 和测试模型，覆盖档案、主线、教师看板和报告流程，以及聊天的多轮上下文、账号隔离、请求去重、并发冲突、历史分页、空白输入、上游故障与无模型状态。SDK 测试检查实际发出的消息协议，迁移测试检查升级、回退和档案笔记保留。

浏览器冒烟测试需要已启动的前后端和本机 Chrome。在 `frontend` 目录执行：

```powershell
npm run smoke
```

测试覆盖游戏流程、档案介绍展开、报告、主线、手机布局，以及未配置模型时的聊天状态。可用 `CHROME_PATH`、`SMOKE_BASE_URL` 和 `SMOKE_OUTPUT` 指定 Chrome 路径、页面地址和截图目录。

设置 `SMOKE_CHAT_ONLINE=1` 后，还会验证 HTTP 链路上的多轮聊天、刷新恢复、新建和删除会话、关卡切换，以及 320px 手机长消息排版。请使用独立测试数据库，避免把测试进度写入日常账号数据。`backend/tests/chat_smoke_provider.py` 仅用于本地联调，返回的是测试回复。

## 主要目录

```text
backend/
  app/api/v1/       接口入口
  app/services/     关卡判定、聊天与学习统计
  app/db/models/    数据模型
  app/seeds/        档案关卡和知识点
  migrations/      数据库迁移
  tests/           后端测试
frontend/
  src/pages/       页面
  src/components/  导航、品牌、档案介绍与聊天组件
  scripts/         浏览器冒烟测试
docs/
  当前关卡参考答案.md
```

<details>
<summary>主要功能的实现位置</summary>

- `backend/app/api/v1/archives.py`：关卡、核对、提示、追问、迁移、因果连线、缺失补全、时间轴、主线归位、主线、解锁、进度与报告入口。
- `backend/app/api/v1/teacher.py`：教师看板接口。
- `backend/app/services/archive_cards_service.py`：卡片计分、提示阶梯、因果连线、缺失补全、时间轴与主线归位判定、解锁前后的字段裁剪。
- `backend/app/services/archive_loader.py`：关卡数据的共享加载器。
- `backend/app/services/teacher_service.py`：匿名聚合与错卡热力图统计。
- `backend/app/services/archive_thread_service.py`：四条主线的收集统计与小结保存。
- `backend/app/db/models/archive_thread.py`：按账号保存主线小结。
- `backend/app/seeds/archive_cases.json`：11 个关卡的数据（正确卡、干扰卡、提示、追问、迁移题、因果边、缺失卡与综合关时间轴）。
- `backend/tests/test_archive_cards.py`：卡片服务单元测试（计分、提示、连线、补全、字段隔离）。
- `backend/tests/test_archive_timeline.py`：综合关时间轴与主线归位测试。
- `backend/tests/test_archive_threads.py`：主线收集、隐藏卡保护、小结隔离测试。
- `backend/tests/test_teacher.py`：教师角色声明、匿名聚合与错卡计数测试。
- `backend/app/services/archive_report_service.py`：报告统计和受约束的模型点评。
- `backend/app/repositories/archive_report.py`：按账号查询进度与活动记录。
- `backend/app/schemas/archive_report.py`：报告响应结构。
- `backend/app/db/models/archive.py`：个人探索进度。
- `backend/app/db/models/archive_activity.py`：学习活动记录。
- `backend/app/services/chat_service.py`：多轮聊天、课程资料检索、失败处理与请求去重。
- `backend/app/api/v1/chat.py`：聊天状态、会话和消息接口。
- `backend/app/db/models/chat.py`：会话与消息数据表。
- `backend/app/services/chat_compat_service.py`：旧探究接口兼容入口。
- `backend/app/db/models/archive_agent.py`：旧探究记录的兼容数据模型。
- `frontend/src/components/ChatWorkspace.tsx`：聊天窗口、会话记录与手机布局。
- `frontend/src/pages/ChatPage.tsx`：独立聊天页面。
- `frontend/src/pages/ThreadsPage.tsx`：档案主线页面，展示收集进度与主线小结。
- `frontend/src/pages/TeacherPage.tsx`：教师看板，展示匿名汇总与错卡热力图。
- `frontend/src/components/LearningReport.tsx`：学习报告区块。
- `frontend/src/pages/JournalPage.tsx`：发现笔记与学习报告。
- `frontend/src/components/ArchivePreviewPanel.tsx`：档案介绍的展开面板。
- `frontend/src/components/BrandLogo.tsx`：品牌标识组件。

</details>

### 接口与材料解锁

保留的接口包括 archives、knowledge、auth、users/me 和健康检查。`GET /api/v1/healthz` 检查服务是否运行，`GET /api/v1/readyz` 检查数据库连接；完整接口文档见后端 `/docs`。

关卡详情需要登录。仅在当前账号核对通过后，服务器才返回理论摘要、笔记提示、提示全文、追问、迁移答案与因果连线题目。

解锁前不会下发卡片分类 `stage`、干扰卡身份 `variant`、剔除理由 `reject_reason` 或内部 `guide_questions`。被抽出的卡片正文只有完成缺失补全后才返回，因果连线的可接受来源在提交前不下发。主线接口只展示已解锁的主线材料，关卡列表只返回摘要。

旧接口 `/api/v1/archives/cases/{code}/agent` 已弃用，保留为真实聊天的兼容入口。历史接口和 `archive_agent_turns` 用于兼容原有记录，旧规划服务和前端面板已移除。
