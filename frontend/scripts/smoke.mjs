import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright-core";

const baseURL = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:5173";
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
  await page.getByRole("heading", { name: /革命道路为何走向农村/ }).waitFor();
  await capture(page, "catalog-desktop.png");
  await page.getByRole("button", { name: "新时代拓展", exact: true }).click();
  await page.getByRole("heading", { name: "现代化，怎样走出自己的路？" }).waitFor();
  assert.equal(await page.locator(".archive-case-card").count(), 2);
  await capture(page, "catalog-extension-desktop.png");
  await page.getByRole("button", { name: "综合关", exact: true }).click();
  await page.getByRole("heading", { name: "这条道路是怎样走出来的？" }).waitFor();
  assert.equal(await page.locator(".archive-case-card").count(), 1);

  const lockedResponse = page.waitForResponse((response) => response.url().endsWith("/api/v1/archives/cases/rural_road") && response.request().method() === "GET");
  await page.goto(baseURL + "/archives/rural_road", { waitUntil: "networkidle" });
  const lockedCase = await (await lockedResponse).json();
  assert.ok(!("theory_summary" in lockedCase) && !("reflection_prompt" in lockedCase));
  assert.ok(!("hints" in lockedCase) && !("probes" in lockedCase) && !("transfer" in lockedCase));
  assert.ok(!("guide_questions" in lockedCase) && !("chain_edges" in lockedCase));
  assert.ok(lockedCase.fill_blank && lockedCase.fill_blank.label && lockedCase.fill_blank.text === null);
  assert.equal(lockedCase.card_total, lockedCase.cards.length);
  assert.ok(lockedCase.card_total === 7 || lockedCase.card_total === 8);
  assert.ok(lockedCase.cards.every((card) => Object.keys(card).join(",") === "id,label,text,source"));
  await page.getByRole("heading", { name: "革命道路为何走向农村？" }).waitFor();
  await capture(page, "case-desktop.png");

  await page.getByRole("button", { name: /获取下一条线索/ }).click();
  await page.getByText("查阅档案卡", { exact: true }).waitFor();
  await page.getByLabel(/你想调查什么/).fill("为什么不能简单照搬城市中心道路？");
  await page.getByRole("button", { name: /获取下一条线索/ }).click();
  await page.getByText("回看之前的 1 次探究").waitFor();
  await page.locator(".archive-agent").screenshot({ path: join(outputDir, "agent-explore-desktop.png"), animations: "disabled" });

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
  await page.locator(".archive-agent").screenshot({ path: join(outputDir, "agent-connect-desktop.png"), animations: "disabled" });

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

  const auth = await page.evaluate(() => localStorage.getItem("mingbian-auth"));
  assert.ok(auth, "auth state was not persisted");
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
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
  await mobilePage.goto(baseURL + "/archives/rural_road", { waitUntil: "networkidle" });
  await mobilePage.locator(".archive-agent").screenshot({ path: join(outputDir, "agent-mobile.png"), animations: "disabled" });
  await mobilePage.locator("#evidence").scrollIntoViewIfNeeded();
  await capture(mobilePage, "evidence-mobile.png");
  assert.deepEqual(problems, []);
  console.log("Archive smoke test passed; screenshots: " + outputDir);
} finally {
  await browser.close();
}
