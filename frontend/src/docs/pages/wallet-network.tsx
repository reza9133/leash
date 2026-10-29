import { H2, H3, Lead, Note, DocTable } from "../kit";
import { CHAIN } from "../../config";
import { CodeBlock } from "../../components/ui";

export default function Page() {
  return (
    <>
      <Lead>
        The app finds every wallet in your browser by itself, lets you choose one, and really disconnects when you ask.
      </Lead>

      <H2 id="discovery">How wallets are found</H2>
      <p>
        Wallets announce themselves to the page with the EIP-6963 standard, so several wallets can live in one browser without
        fighting over a single global object. The connect dialog lists each wallet with its own name and icon. If a browser
        has only an older wallet that injects <code>window.ethereum</code>, it is offered as a fallback entry.
      </p>
      <p>If no wallet is found, the dialog says so and links to where to get one. Nothing else in the app breaks: every page can still be read without a wallet.</p>

      <H2 id="connect">Connecting</H2>
      <p>
        Choose a wallet and approve the request in its window. The app remembers the choice so that a reload reconnects
        quietly, only if the wallet still holds the permission. A rejected request shows a plain message and changes nothing.
      </p>
      <H3 id="account-change">Changing accounts</H3>
      <p>If you switch accounts in the wallet, the app follows at once. Pages recompute your role in the open mandate immediately.</p>

      <H2 id="disconnect">Disconnecting</H2>
      <p>
        Disconnect in the account menu does three things: it forgets the session in the app, asks the wallet to revoke the
        site permission where the wallet supports it, and turns off the automatic reconnect. After a reload the app stays
        disconnected until you connect again.
      </p>

      <H2 id="network">The network</H2>
      <DocTable>
        <tbody>
          <tr><th>Name</th><td>{CHAIN.name}</td></tr>
          <tr><th>Chain id</th><td>{CHAIN.id} ({CHAIN.hexId})</td></tr>
          <tr><th>RPC</th><td><code>{CHAIN.rpcUrl}</code></td></tr>
          <tr><th>Currency</th><td>{CHAIN.currency.symbol} (18 decimals)</td></tr>
        </tbody>
      </DocTable>
      <p>
        When the wallet is on another chain a banner appears above the page. Its button asks the wallet to switch
        (<code>wallet_switchEthereumChain</code>). If the wallet does not know the chain, the app offers to add it
        (<code>wallet_addEthereumChain</code>) and then switches. Write actions stay disabled until the chain is right, so a
        transaction can never be sent to the wrong network by accident.
      </p>
      <CodeBlock
        lang="ts"
        title="What the app asks the wallet to add"
        code={`await provider.request({
  method: "wallet_addEthereumChain",
  params: [{
    chainId: "${CHAIN.hexId}",
    chainName: "${CHAIN.name}",
    nativeCurrency: { name: "${CHAIN.currency.name}", symbol: "${CHAIN.currency.symbol}", decimals: 18 },
    rpcUrls: ["${CHAIN.rpcUrl}"],
  }],
});`}
      />
      <Note title="Reading does not need a wallet">
        Views go straight to the RPC of the network, so you can browse every mandate and request without connecting.
      </Note>
    </>
  );
}
