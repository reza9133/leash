# End-to-end tests

These tests drive the built app (the harness serves `dist/` itself) in Chromium (Playwright) against the real `contracts/leash.py`, run in the GenLayer
direct runner (`mock/chain_server.py`). `mock/chain.mjs` speaks the JSON-RPC protocol of the network and moves each
transaction through the consensus phases; `mock/wallet.js` installs mock EIP-6963 wallets.

```bash
cd frontend
npm run build
node tests/e2e/mock/selftest.mjs     # the mock chain on its own
node tests/e2e/wallet-flows.mjs      # discovery, connect, disconnect, account and network changes
node tests/e2e/app-flows.mjs         # create, seat, request, review, challenge, audit, execute
```

Screenshots are written to `/tmp/leash-shots`. The AI is scripted by the runner (`set_mode`), so verdicts are
deterministic. These tests do not contact the public network.
