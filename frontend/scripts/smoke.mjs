import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright-core";

const baseURL = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:5173";
const chatOnline = process.env.SMOKE_CHAT_ONLINE === "1";
const outputDir = process.env.SMOKE_OUTPUT ?? join(process.cwd(), "qa-screenshots");
const chromePath = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
await mkdir(outputDir, { recursive: true });

const CASES = JSON.parse(await readFile(join(process.cwd(), "..", "backend", "app", "seeds", "archive_cases.json"), "utf8"));
const caseOf = (code) => CASES.find((item) => item.code === code);
const stageButton = { context: "历史条件", practice: "实践探索", theory: "理论形成", reject: "不属于本关" };

const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const problems = [];
function observe(page) {
  page.on("pageerror", (error) => problems.push("pageerror: " + error.message));
  page.on("response", (response) => {
    if (response.status() >= 500) problems.push("HTTP " + response.status() + ": " + response.url());
  });
}
async function capture(page, name) {
  await page.screenshot({ path: join(outputDir, name), fullPage: false, animations: "disabled" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  if (overflow) console.log(await page.evaluate(() => Array.from(document.querySelectorAll("body *")).filter((item) => item.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(item).position !== "fixed").slice(0, 12).map((item) => ({ tag: item.tagName, class: item.className, width: item.getBoundingClientRect().width }))));
  assert.equal(overflow, false, name + " overflows horizontally");
}

async function sortAllCards(page, code) {
  const data = caseOf(code);
  for (const card of data.cards.filter((item) => item.id !== data.fill_blank.card_id)) {
    const placement = card.stage === "distractor" ? "reject" : card.stage;
    const article = page.locator("article.archive-clue", { hasText: card.label }).first();
    await article.locator("button").first().click();
    await article.locator(".archive-chooser-option", { hasText: stageButton[placement] }).first().click();
    if (placement === "reject") {
      await article.locator("textarea").fill("这条材料属于另一个年代或颠倒了因果关系，应当剔除。");
    }
  }
}

async function solveTimeline(page, code) {
  const data = caseOf(code);
  for (const cardId of data.timeline_order) {
    const card = data.cards.find((item) => item.id === cardId);
    const article = page.locator("article.archive-clue", { hasText: card.label }).first();
    await article.locator("button").first().click();
    await article.locator(".archive-chooser-option", { hasText: "放入时间轴" }).first().click();
  }
  for (const card of data.cards.filter((item) => item.stage === "distractor")) {
    const article = page.locator("article.archive-clue", { hasText: card.label }).first();
    await article.locator("button").first().click();
    await article.locator(".archive-chooser-option", { hasText: "不属于本关" }).first().click();
    await article.locator("textarea").fill("这条材料属于另一个年代或颠倒了因果关系，应当剔除。");
  }
  await page.getByRole("button", { name: /核对时间轴/ }).click();
  await page.getByText(/位置正确/).waitFor();
  await page.getByRole("heading", { name: /理论形成卡/ }).waitFor();
}

async function finishTimeline(page, code) {
  const data = caseOf(code);
  for (const card of data.cards.filter((item) => item.stage !== "distractor")) {
    await page.getByLabel(card.label + " 主线 " + card.thread).click();
  }
  await page.getByRole("button", { name: "提交主线归位" }).click();
  await page.getByRole("button", { name: "主线归位已完成" }).waitFor();
  for (const [index, probe] of data.probes.entries()) {
    await page.getByLabel("追问 " + (index + 1) + " 回答").fill(probe.reference);
  }
  await page.getByRole("button", { name: "提交追问" }).click();
  await page.getByRole("button", { name: "追问已通过" }).waitFor();
  const answer = data.transfer.options.find((option) => option.key === data.transfer.answer);
  await page.locator(".archive-transfer-option", { hasText: answer.text }).click();
  await page.getByLabel("迁移理由").fill("整条道路的方法是从实际出发、自己找答案，所以选择这个做法。");
  await page.getByRole("button", { name: "提交迁移选择" }).click();
  await page.getByText(/判断正确/).waitFor();
  await page.getByLabel("写下你的发现").fill("这条道路变的是每个阶段的中心任务，不变的是从实际出发、依靠人民、走自己的路。");
  await page.getByRole("button", { name: /保存发现笔记/ }).click();
  await page.getByText("已收入我的发现").waitFor();
}

async function finishMission(page, code, { withProbes = true } = {}) {
  const data = caseOf(code);
  const visible = data.cards.filter((card) => card.id !== data.fill_blank.card_id).length;
  await page.getByRole("button", { name: /核对线索/ }).click();
  await page.getByText(new RegExp(`得分 \\d+ / ${visible}`)).waitFor();
  await page.getByRole("heading", { name: /理论形成卡/ }).waitFor();
  if (withProbes) {
    for (const [childId, parents] of Object.entries(data.causal_edges)) {
      const child = data.cards.find((card) => card.id === childId);
      await page.getByLabel(child.label + " 的来源").selectOption(parents[0]);
    }
    await page.getByRole("button", { name: "提交连线" }).click();
    await page.getByRole("button", { name: "因果连线已完成" }).waitFor();

    await page.getByLabel("缺失卡补全").fill("这张卡片说的是：" + data.fill_blank.points.join("、") + "。");
    await page.getByRole("button", { name: "提交补全" }).click();
    await page.getByRole("button", { name: "补全已完成" }).waitFor();
    await page.getByText(/原卡（/).waitFor();

    for (const [index, probe] of data.probes.entries()) {
      await page.getByLabel("追问 " + (index + 1) + " 回答").fill(probe.reference);
    }
    await page.getByRole("button", { name: "提交追问" }).click();
    await page.getByRole("button", { name: "追问已通过" }).waitFor();
    const answer = data.transfer.options.find((option) => option.key === data.transfer.answer);
    await page.locator(".archive-transfer-option", { hasText: answer.text }).click();
    await page.getByLabel("迁移理由").fill("两种方向都要兼顾，不能走极端，所以选择这个做法。");
    await page.getByRole("button", { name: "提交迁移选择" }).click();
    await page.getByText(/判断正确/).waitFor();
  }
  await page.getByLabel("写下你的发现").fill("结合档案中的具体线索，我认识到历史条件、实践探索与理论形成之间存在清晰的因果联系。");
  await page.getByRole("button", { name: /保存发现笔记/ }).click();
  await page.getByText("已收入我的发现").waitFor();
}

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await desktop.newPage();
  observe(page);
  await page.goto(baseURL + "/login", { waitUntil: "networkidle" });
  await capture(page, "login-desktop.png");
  await page.getByRole("tab", { name: "创建账号" }).click();
  const suffix = Date.now().toString(36);
  await page.getByLabel("邮箱", { exact: true }).fill("archive-" + suffix + "@example.com");
  await page.getByLabel("用户名", { exact: true }).fill("林同学" + suffix.slice(-3));
  await page.getByLabel("密码", { exact: true }).fill("QaPassword123!");
  await page.getByRole("button", { name: "创建账号并开始" }).click();
  await page.waitForURL(baseURL + "/", { timeout: 15000 });
  await page.getByRole("heading", { name: /你好/ }).waitFor();
  await capture(page, "home-desktop.png");

  await page.goto(baseURL + "/journal", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "你的学习报告" }).waitFor();
  await page.getByText("暂无记录", { exact: true }).waitFor();

  await page.goto(baseURL + "/archives", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "打开历史档案" }).waitFor();
  await page.getByRole("heading", { name: "第二章", exact: true }).waitFor();
  assert.equal(await page.getByRole("heading", { name: /革命道路为何走向农村/ }).count(), 0);
  await capture(page, "catalog-desktop.png");
  await page.getByRole("button", { name: "打开第一章档案介绍", exact: true }).click();
  const preview = page.locator(".archive-inline-preview");
  await preview.getByRole("heading", { name: "从实际出发，答案在哪里？" }).waitFor();
  assert.equal(page.url(), baseURL + "/archives");
  await preview.screenshot({ path: join(outputDir, "catalog-preview-desktop.png"), animations: "disabled" });
  await page.keyboard.press("Escape");
  await preview.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "新时代拓展", exact: true }).click();
  await page.getByRole("heading", { name: "拓展二", exact: true }).waitFor();
  assert.equal(await page.locator(".archive-case-card").count(), 2);
  await capture(page, "catalog-extension-desktop.png");
  await page.getByRole("button", { name: "综合关", exact: true }).click();
  await page.getByRole("heading", { name: "综合关", exact: true }).waitFor();
  assert.equal(await page.locator(".archive-case-card").count(), 1);

  const lockedResponse = page.waitForResponse((response) => response.url().endsWith("/api/v1/archives/cases/rural_road") && response.request().method() === "GET");
  await page.getByRole("button", { name: "全部档案", exact: true }).click();
  await page.getByRole("button", { name: "打开第二章档案介绍", exact: true }).click();
  await preview.getByRole("heading", { name: "革命道路为何走向农村？" }).waitFor();
  await preview.getByRole("link", { name: "进入探索", exact: true }).click();
  await page.waitForURL(baseURL + "/archives/rural_road");
  const lockedCase = await (await lockedResponse).json();
  assert.ok(!("theory_summary" in lockedCase) && !("reflection_prompt" in lockedCase));
  assert.ok(!("hints" in lockedCase) && !("probes" in lockedCase) && !("transfer" in lockedCase));
  assert.ok(!("guide_questions" in lockedCase) && !("chain_edges" in lockedCase));
  assert.ok(lockedCase.fill_blank && lockedCase.fill_blank.label && lockedCase.fill_blank.text === null);
  assert.equal(lockedCase.card_total, lockedCase.cards.length);
  assert.ok(lockedCase.card_total === 7 || lockedCase.card_total === 8);
  assert.ok(lockedCase.cards.every((card) => Object.keys(card).join(",") === "id,label,text,source"));
  await page.getByRole("heading", { name: "革命道路为何走向农村？", level: 1 }).waitFor();
  await capture(page, "case-desktop.png");

  const chatInput = page.getByLabel("输入聊天消息");
  await chatInput.fill("为什么不能简单照搬城市中心道路？");
  if (chatOnline) {
    await page.getByRole("button", { name: "发送消息", exact: true }).click();
    await page.locator(".chat-message.is-assistant").waitFor();
    await chatInput.fill("今天有点累，帮我安排休息");
    await page.getByRole("button", { name: "发送消息", exact: true }).click();
    await page.locator(".chat-message.is-assistant").nth(1).waitFor();
  } else {
    await page.getByText("模型待连接", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "发送消息", exact: true }).isDisabled(), true);
  }
  await page.locator(".chat-workspace").screenshot({ path: join(outputDir, "chat-case-desktop.png"), animations: "disabled" });

  await page.getByRole("button", { name: /请求提示/ }).click();
  await page.getByText(/提示/).first().waitFor();

  await sortAllCards(page, "rural_road");
  await finishMission(page, "rural_road");
  await capture(page, "case-completed-desktop.png");

  const draft = await page.getByLabel("写下你的发现").inputValue();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByLabel("写下你的发现").waitFor();
  assert.equal(await page.getByLabel("写下你的发现").inputValue(), draft, "discovery draft survives reload");
  await page.getByText("线索已全部归位", { exact: false }).first().waitFor();
  await page.locator("#discovery").scrollIntoViewIfNeeded();
  await capture(page, "case-solved-desktop.png");
  if (chatOnline) assert.equal(await page.locator(".chat-message.is-assistant").count(), 2, "conversation survives reload");
  else assert.equal(await page.getByLabel("输入聊天消息").inputValue(), "为什么不能简单照搬城市中心道路？", "chat draft survives reload");

  await page.goto(baseURL + "/archives/chinese_modernization", { waitUntil: "networkidle" });
  await sortAllCards(page, "chinese_modernization");
  await finishMission(page, "chinese_modernization", { withProbes: false });

  await page.goto(baseURL + "/archives/grand_road", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "这条道路是怎样走出来的？" }).waitFor();
  assert.equal(await page.locator("article.archive-clue").count(), 12);
  await solveTimeline(page, "grand_road");
  await finishTimeline(page, "grand_road");
  await capture(page, "timeline-desktop.png");

  await page.goto(baseURL + "/journal", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "我的发现", exact: true }).waitFor();
  await page.getByText(/历史条件、实践探索与理论形成/).first().waitFor();
  await capture(page, "journal-desktop.png");
  await page.getByRole("heading", { name: "你的学习报告" }).scrollIntoViewIfNeeded();
  await page.getByText("首次通过 3 / 3 份有效记录", { exact: true }).waitFor();
  await page.getByText("100%", { exact: true }).first().waitFor();
  await page.getByRole("heading", { name: "你的学习报告" }).evaluate((element) => {
    window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 100, behavior: "instant" });
  });
  await capture(page, "report-desktop.png");
  await page.locator("section[aria-labelledby='learning-report-title']").screenshot({ path: join(outputDir, "report-full-desktop.png"), animations: "disabled" });

  await page.goto(baseURL + "/threads", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "档案主线" }).waitFor();
  await page.getByText(/已集齐主线/).waitFor();
  assert.equal(await page.locator("article.archive-panel").count(), 4);
  await capture(page, "threads-desktop.png");

  await page.goto(baseURL + "/knowledge", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "理论手册", exact: true }).waitFor();
  await page.getByLabel("搜索理论").fill("实事求是");
  await page.getByText("实事求是", { exact: true }).first().waitFor();
  await capture(page, "knowledge-desktop.png");

  await page.goto(baseURL + "/chat", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "聊天助手", exact: true }).waitFor();
  if (chatOnline) {
    await page.getByLabel("输入聊天消息").fill("实事求是和解放思想有什么联系？");
    await page.getByRole("button", { name: "发送消息", exact: true }).click();
    await page.locator(".chat-message.is-assistant").waitFor();
    await page.getByLabel("输入聊天消息").fill("今天心情不太好，想聊聊");
    await page.getByRole("button", { name: "发送消息", exact: true }).click();
    await page.locator(".chat-message.is-assistant").nth(1).waitFor();
    const savedURL = page.url();
    await page.reload({ waitUntil: "networkidle" });
    await page.locator(".chat-message.is-assistant").nth(1).waitFor();
    assert.equal(page.url(), savedURL);
    const interruptedMessage = "模拟回复已保存但网络中断";
    await page.route("**/chat/sessions/*/messages", async (route) => {
      await route.fetch();
      await route.abort("failed");
    });
    await page.getByLabel("输入聊天消息").fill(interruptedMessage);
    await page.getByRole("button", { name: "发送消息", exact: true }).click();
    await page.getByRole("alert").waitFor();
    assert.equal(await page.getByLabel("输入聊天消息").inputValue(), interruptedMessage);
    await page.unroute("**/chat/sessions/*/messages");
    await page.reload({ waitUntil: "networkidle" });
    await page.locator(".chat-message.is-assistant").nth(2).waitFor();
    await page.getByRole("button", { name: "发送消息", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#chat-input")?.value === "");
    assert.equal(await page.locator(".chat-message.is-assistant").count(), 3, "retry after reload doesn't duplicate saved reply");
    await page.getByRole("button", { name: "开始新对话", exact: true }).click();
    assert.equal(await page.locator(".chat-message").count(), 0);
    await page.getByLabel("输入聊天消息").fill("这是另一段聊天");
    await page.getByRole("button", { name: "发送消息", exact: true }).click();
    await page.locator(".chat-message.is-assistant").waitFor();
    await page.getByRole("button", { name: "删除当前对话" }).click();
    await page.getByRole("button", { name: "取消", exact: true }).click();
    assert.equal(await page.locator(".chat-message.is-assistant").count(), 1);
    await page.getByRole("button", { name: "删除当前对话" }).click();
    await page.getByRole("button", { name: "删除", exact: true }).click();
    await page.locator(".chat-empty").waitFor();
    await page.locator(".chat-history-item", { hasText: "实事求是和解放思想" }).click();
    await page.locator(".chat-message.is-assistant").nth(1).waitFor();
  }
  await capture(page, "chat-desktop.png");

  const auth = await page.evaluate(() => localStorage.getItem("mingbian-auth"));
  assert.ok(auth, "auth state was not persisted");
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await mobile.addInitScript((value) => localStorage.setItem("mingbian-auth", value), auth);
  const mobilePage = await mobile.newPage();
  observe(mobilePage);
  for (const [path, heading, file] of [
    ["/", /你好/, "home-mobile.png"],
    ["/archives", "打开历史档案", "catalog-mobile.png"],
    ["/archives/rural_road", "革命道路为何走向农村？", "case-mobile.png"],
    ["/threads", "档案主线", "threads-mobile.png"],
    ["/journal", "我的发现", "journal-mobile.png"],
    ["/knowledge", "理论手册", "knowledge-mobile.png"],
    ["/chat", "聊天助手", "chat-mobile.png"],
  ]) {
    await mobilePage.goto(baseURL + path, { waitUntil: "networkidle" });
    await mobilePage.getByRole("heading", { name: heading, exact: typeof heading === "string" }).first().waitFor();
    await capture(mobilePage, file);
  }
  await mobilePage.goto(baseURL + "/journal", { waitUntil: "networkidle" });
  await mobilePage.getByRole("heading", { name: "你的学习报告" }).scrollIntoViewIfNeeded();
  await mobilePage.getByText("首次通过 3 / 3 份有效记录", { exact: true }).waitFor();
  await mobilePage.getByRole("heading", { name: "你的学习报告" }).evaluate((element) => {
    window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 100, behavior: "instant" });
  });
  await capture(mobilePage, "report-mobile.png");
  await mobilePage.getByRole("button", { name: "打开导航" }).click();
  await mobilePage.keyboard.press("Escape");
  await mobilePage.getByRole("dialog", { name: "导航菜单" }).waitFor({ state: "hidden" });
  await mobilePage.getByRole("button", { name: "打开导航" }).click();
  await mobilePage.getByRole("dialog", { name: "导航菜单" }).getByRole("link", { name: /档案关卡/ }).click();
  await mobilePage.getByRole("heading", { name: "打开历史档案" }).waitFor();
  await mobilePage.getByRole("button", { name: "打开第二章档案介绍", exact: true }).click();
  const mobilePreview = mobilePage.locator(".archive-inline-preview");
  await mobilePreview.getByText("已完成", { exact: true }).waitFor();
  await mobilePreview.screenshot({ path: join(outputDir, "catalog-preview-mobile.png"), animations: "disabled" });
  await mobilePreview.getByRole("link", { name: "进入探索", exact: true }).click();
  await mobilePage.waitForURL(baseURL + "/archives/rural_road");
  await mobilePage.getByRole("heading", { name: "革命道路为何走向农村？", exact: true, level: 1 }).waitFor();
  assert.equal(await mobilePage.locator(".archive-chat-shortcut").isVisible(), true);
  await mobilePage.locator(".archive-chat-shortcut").click();
  await mobilePage.getByRole("heading", { name: "聊天助手", exact: true }).waitFor();
  if (chatOnline) {
    await mobilePage.getByRole("button", { name: /记录/, exact: true }).click();
    await mobilePage.locator(".chat-history-item", { hasText: "为什么不能简单照搬" }).click();
    await mobilePage.locator(".chat-message.is-assistant").nth(1).waitFor();
    await capture(mobilePage, "chat-conversation-mobile.png");
    await mobilePage.getByLabel("输入聊天消息").fill("手机上也可以继续聊吗？");
    await mobilePage.getByRole("button", { name: "发送消息", exact: true }).click();
    await mobilePage.locator(".chat-message.is-assistant").nth(2).waitFor();
    await mobilePage.getByLabel("输入聊天消息").focus();
    await capture(mobilePage, "chat-focused-mobile.png");
    await mobilePage.setViewportSize({ width: 320, height: 568 });
    await capture(mobilePage, "chat-small-mobile.png");
    const sendBounds = await mobilePage.getByRole("button", { name: "发送消息", exact: true }).boundingBox();
    assert.ok(sendBounds && sendBounds.y + sendBounds.height <= 568, "mobile send button stays in viewport");
    await mobilePage.setViewportSize({ width: 390, height: 440 });
    await capture(mobilePage, "chat-keyboard-mobile.png");
    const keyboardBounds = await mobilePage.getByRole("button", { name: "发送消息", exact: true }).boundingBox();
    assert.ok(keyboardBounds && keyboardBounds.y + keyboardBounds.height <= 440, "send button fits reduced viewport");
    await mobilePage.setViewportSize({ width: 320, height: 568 });
  }
  await mobilePage.goto(baseURL + "/archives/rural_road", { waitUntil: "networkidle" });
  await mobilePage.locator("#evidence").scrollIntoViewIfNeeded();
  await capture(mobilePage, "evidence-mobile.png");
  assert.deepEqual(problems, []);
  console.log("Archive smoke test passed; screenshots: " + outputDir);
} finally {
  await browser.close();
}
