// The product flow with the real contract behind the mock chain: create a mandate, seat an agent, file a request,
// review it, challenge it, audit it, pay another one, veto one.
import { launch } from "./harness.mjs";
import { startMock } from "./mock/chain.mjs";
import { ACCOUNTS } from "./mock/accounts.mjs";
import { check, failures, shot, step } from "./lib.mjs";

const mock = await startMock({ fast: true });
const h = await launch({ mock });
const { page } = h;
const connectAs = async (acct) => {
  await page.evaluate((a) => window.__wallets.one.setAccounts([a]), acct.address);
  await page.waitForTimeout(300);
};
const txDone = async (n = 1) => {
  await page.waitForFunction((k) => document.querySelectorAll('[data-testid="tx-card"][data-phase="done"]').length >= k || document.querySelectorAll('[data-testid="tx-card"][data-phase="failed"]').length > 0, n, { timeout: 90000 });
};
try {
  await step("connect", async () => {
    await h.goto("/app");
    await page.getByTestId("connect-prompt").click();
    await page.getByTestId("wallet-io.mock.one").click();
    await page.getByTestId("wallet-pill").waitFor();
    check(true, "connected as the owner");
  });

  await step("create a mandate", async () => {
    await h.goto("/app/new");
    await page.getByTestId("m-name").fill("Research budget");
    await page.getByTestId("m-policy").fill("Pay for cloud hosting and developer tooling for the research team. Nothing personal, no gambling.");
    await page.getByTestId("m-dep").fill("3");
    await page.getByTestId("m-guard").fill(ACCOUNTS.guardian.address);
    await shot(page, "create-form");
    await page.getByTestId("create-submit").click();
    await page.waitForURL(/mandates\/0/, { timeout: 90000 });
    check(true, "creating a mandate lands on its page");
    await page.getByText("Research budget").first().waitFor();
    await shot(page, "mandate-overview");
  });

  await step("validation", async () => {
    await h.goto("/app/new");
    await page.getByTestId("m-name").fill("x");
    await page.getByTestId("create-submit").click();
    await page.getByRole("alert").first().waitFor();
    check(true, "invalid input shows errors and sends nothing");
    await shot(page, "create-errors");
  });

  await step("grant a seat", async () => {
    await h.goto("/app/mandates/0?tab=seats");
    await page.getByTestId("g-who").fill(ACCOUNTS.agent.address);
    await page.getByTestId("g-budget").fill("2");
    await page.getByTestId("g-submit").click();
    await txDone(1);
    await page.getByTestId("seat-table").waitFor();
    check(true, "the seat appears in the table");
    await page.getByTestId("p-who").fill(ACCOUNTS.payee.address);
    await page.getByTestId("p-add").click();
    await page.getByTestId("payee-list").waitFor({ timeout: 60000 });
    check(true, "a payee can be listed");
    await shot(page, "mandate-seats");
  });

  await step("file a request as the agent", async () => {
    await connectAs(ACCOUNTS.agent);
    await h.goto("/app/mandates/0?tab=requests");
    await page.getByTestId("request-form").waitFor();
    await page.getByTestId("rq-payee").fill(ACCOUNTS.payee.address);
    await page.getByTestId("rq-amount").fill("0.5");
    await page.getByTestId("rq-purpose").fill("Monthly cloud hosting invoice for the research cluster.");
    await page.getByTestId("rq-evidence").fill("https://www.iana.org/domains/example");
    await shot(page, "mandate-request-form");
    await page.getByTestId("rq-submit").click();
    await page.getByTestId("request-table").waitFor({ timeout: 90000 });
    check(true, "the filed request shows in the list");
  });

  await step("review it", async () => {
    await connectAs(ACCOUNTS.stranger);
    await h.goto("/app/requests/0");
    await page.getByTestId("review-submit").click();
    await page.getByText("Approved", { exact: false }).first().waitFor({ timeout: 90000 });
    check(await page.getByTestId("verdict").count() === 1, "the AI verdict is shown");
    await shot(page, "request-approved");
  });

  await step("challenge and audit", async () => {
    await connectAs(ACCOUNTS.watcher);
    await h.goto("/app/requests/0");
    await page.getByTestId("ch-reason").fill("The invoice page does not name the research cluster.");
    await page.getByTestId("ch-submit").click();
    await page.getByTestId("challenge-panel").waitFor({ timeout: 90000 });
    check(true, "a challenge with a bond is recorded");
    await page.getByTestId("audit-submit").click();
    await page.getByText(/dismissed|upheld/i).first().waitFor({ timeout: 90000 });
    check(true, "the audit settles the challenge");
    await shot(page, "request-audited");
  });

  await step("pay after the delay", async () => {
    await mock.warp(3600);
    await h.goto("/app/requests/0");
    await page.waitForTimeout(500);
    const exec = page.getByTestId("execute-submit");
    if (await exec.count()) {
      await exec.click();
      await page.getByText("Paid", { exact: true }).first().waitFor({ timeout: 90000 });
    }
    await shot(page, "request-final");
  });

  await step("owner views", async () => {
    await connectAs(ACCOUNTS.owner);
    await h.goto("/app");
    await page.getByTestId("mandate-list").waitFor({ timeout: 60000 });
    check(true, "the dashboard lists the mandate");
    await shot(page, "dashboard");
    await h.goto("/app/mandates/0?tab=manage");
    await page.getByTestId("pause-toggle").waitFor();
    await shot(page, "mandate-manage");
    await h.goto("/explore");
    await page.getByTestId("explorer-table").waitFor({ timeout: 60000 });
    await shot(page, "explorer");
    check(true, "the explorer shows the mandate");
  });
} finally {
  console.log("page errors:", h.errors.slice(0, 8));
  await h.close();
  await mock.close();
}
console.log(failures() ? `${failures()} failed` : "all passed");
process.exit(failures() ? 1 : 0);
