// Wallet behaviour: discovery, connect, wrong network, switch, disconnect, reconnect, rejection, no wallet.
import { launch } from "./harness.mjs";
import { startMock } from "./mock/chain.mjs";
import { ACCOUNTS } from "./mock/accounts.mjs";
import { check, failures, shot, step } from "./lib.mjs";

const mock = await startMock({ fast: true });
try {
  // 1. discovery and connect on the right network
  await step("connect on studionet", async () => {
    const h = await launch({ mock });
    await h.goto("/");
    await h.page.getByTestId("connect-button").click();
    const list = h.page.getByTestId("wallet-list");
    await list.waitFor();
    check((await list.locator("li").count()) === 2, "both EIP-6963 wallets are listed");
    await shot(h.page, "wallet-modal");
    await h.page.getByTestId("wallet-io.mock.one").click();
    await h.page.getByTestId("wallet-pill").waitFor();
    check(true, "the wallet pill appears after connecting");
    const label = await h.page.getByTestId("wallet-pill").innerText();
    check(label.toLowerCase().includes(ACCOUNTS.owner.address.slice(0, 6).toLowerCase()), `the pill shows the short address (${label.trim()})`);
    check((await h.page.getByTestId("network-banner").count()) === 0, "no network banner on the right network");

    // disconnect
    await h.page.getByTestId("wallet-pill").click();
    await h.page.getByTestId("disconnect-button").click();
    await h.page.getByTestId("connect-button").waitFor();
    check(true, "disconnect returns to the connect button");
    await h.page.waitForTimeout(400);
    const permitted = await h.page.evaluate(() => window.__wallets.one.permitted);
    check(permitted === false, "the wallet permission was revoked");
    await h.page.reload();
    await h.page.waitForTimeout(600);
    check((await h.page.getByTestId("wallet-pill").count()) === 0, "after a reload the app stays disconnected");

    // connect again, then reload: automatic reconnect
    await h.page.getByTestId("connect-button").click();
    await h.page.getByTestId("wallet-io.mock.two").click();
    await h.page.getByTestId("wallet-pill").waitFor();
    await h.page.reload();
    await h.page.getByTestId("wallet-pill").waitFor({ timeout: 5000 });
    check(true, "a connected wallet reconnects by itself after a reload");

    // account change event
    await h.page.evaluate((a) => window.__wallets.two.setAccounts([a]), ACCOUNTS.agent.address);
    await h.page.waitForTimeout(300);
    const l2 = await h.page.getByTestId("wallet-pill").innerText();
    check(l2.toLowerCase().includes(ACCOUNTS.agent.address.slice(0, 6).toLowerCase()), "an account change in the wallet is followed");
    await h.close();
  });

  // 2. wrong network: banner, switch with add-chain fallback
  await step("wrong network", async () => {
    const h = await launch({ mock, chainId: "0x1", knownChains: ["0x1"] });
    await h.goto("/");
    await h.page.getByTestId("connect-button").click();
    await h.page.getByTestId("wallet-io.mock.one").click();
    await h.page.getByTestId("switch-network").waitFor();
    check(true, "the dialog asks to switch network when the wallet is on another chain");
    await shot(h.page, "wallet-switch-dialog");
    await h.page.getByTestId("switch-network").click();
    await h.page.getByTestId("wallet-pill").waitFor();
    await h.page.waitForTimeout(1200);
    const chain = await h.page.evaluate(() => window.__wallets.one.chain);
    check(chain === "0xf22f", "the wallet moved to chain 0xf22f");
    const added = await h.page.evaluate(() => !!window.__wallets.one.added);
    check(added, "the chain was added through wallet_addEthereumChain after error 4902");
    check((await h.page.getByTestId("network-banner").count()) === 0, "the banner is gone after switching");

    // the user switches away in the wallet: banner appears
    await h.page.evaluate(() => window.__wallets.one.setChain("0x1"));
    await h.page.getByTestId("network-banner").waitFor();
    await shot(h.page, "wallet-banner");
    check(true, "switching away shows the wrong-network banner");
    await h.page.getByTestId("banner-switch").click();
    await h.page.getByTestId("network-banner").waitFor({ state: "detached" });
    check(true, "the banner button switches back");
    await h.close();
  });

  // 3. rejected connection
  await step("rejected connection", async () => {
    const h = await launch({ mock });
    await h.goto("/");
    await h.page.evaluate(() => (window.__walletReject = true));
    await h.page.getByTestId("connect-button").click();
    await h.page.getByTestId("wallet-io.mock.one").click();
    await h.page.getByRole("alert").first().waitFor();
    const text = await h.page.getByRole("alert").first().innerText();
    check(/clos|reject|denied|cancel/i.test(text), `a rejected connection shows a message (${text.trim().slice(0, 80)})`);
    await shot(h.page, "wallet-rejected");
    await h.close();
  });

  // 4. no wallet installed
  await step("no wallet", async () => {
    const h = await launch({ mock, noEip6963: true });
    await h.goto("/");
    await h.page.getByTestId("connect-button").click();
    await h.page.getByText("No wallet found").waitFor({ timeout: 6000 });
    check(true, "an empty wallet list explains what to install");
    await shot(h.page, "wallet-none");
    await h.close();
  });
} finally {
  await mock.close();
}
console.log(failures() ? `${failures()} failed` : "all passed");
process.exit(failures() ? 1 : 0);
