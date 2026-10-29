# Leash

**A spending mandate for autonomous agents, with an AI reviewer that can only say no.**

An owner funds a *mandate*, writes the spending policy in plain words and hands *seats* to agents. An agent asks
to pay someone; the contract checks every hard limit with plain arithmetic, a validator-run AI model reads the request
against the policy (and a public evidence page, if there is one), and a human keeps a veto for as long as the payment
waits. The model is a brake, never an accelerator: it can refuse or escalate a request that already passed every limit,
but it cannot raise a cap, widen a budget or approve anything the numbers forbid. Anyone can also bet a bond that an
AI approval was a mistake; a second, stricter audit settles the bet with real money.

It is a GenLayer intelligent contract (`contracts/leash.py`, one file, no dependencies) written for **Studionet**.

## Why it is built this way

Letting a language model hold the keys is the obvious design and the dangerous one. Leash splits the work:

| Layer | Decides | Can be talked into a mistake? |
| --- | --- | --- |
| Deterministic shell | amounts, caps, budgets, rolling window, payee list, expiry, replay of evidence, who may call what | No. It is code. |
| AI review | whether the purpose fits the written policy and the evidence supports it | Maybe, so it can only *lower* what the shell allows |
| Human brake | veto, decision on escalations, pause, revoke | No |
| Watchers | bet a bond against an AI approval; a stricter audit settles it | Paid to find mistakes |

The consequence is a hard bound on the damage of any model failure: whatever the reviewer says, an agent can never
move more than its seat budget, more than the per-payment cap, more than the rolling-window cap, or to a payee the
owner did not list (in allowlist mode).

## Roles

| Role | Can | Cannot |
| --- | --- | --- |
| **Owner** | configure everything, fund, withdraw unreserved money, grant and revoke seats, decide escalations, veto, pause and resume | be a seat holder or the guardian |
| **Guardian** (optional second key) | veto, decide escalations, revoke seats, pause | resume, configure, move or withdraw money, hold a seat |
| **Agent** (seat holder) | file requests, withdraw its own requests | review, decide, execute for itself in a special way (anyone can execute), pay itself, challenge its own request |
| **Watcher** (anyone else) | challenge an AI approval with a bond, run reviews, audits, executions and expirations | challenge as agent, owner or guardian |

## Life of a request

```
                       request_payment                       (hard limits checked here)
                             |
                          PENDING --- cancel_request -----------------------------> CANCELLED
                             | review (AI)                                           ^
        +--------------------+--------------------+                                  |
        | APPROVE, risk low  | unsure / risk mid  | REJECT / risk high               |
        v                    v                    v                                  |
    APPROVED  <--- decide ---ESCALATED          REJECTED                             |
   (reserved,     (owner or    | decide(no)---> REJECTED                             |
    waits         guardian)    | nobody acts --> EXPIRED                             |
    review_delay)                                                                    |
        | challenge (bond)       | veto -> VETOED                                    |
        v                        | nobody pays in time -> EXPIRED                    |
    CHALLENGED --- audit: upheld ---> VETOED (bond back + reward to the watcher)     |
        |          audit: dismissed -> APPROVED again (bond goes to the mandate)     |
        |          audit unreadable x3 -> ESCALATED (bond back)                      |
        v                                                                            |
    APPROVED --- execute after the waiting time ---> EXECUTED (the payee is paid)  --+
```

States, as the contract reports them: `0 PENDING, 1 APPROVED, 2 ESCALATED, 3 REJECTED, 4 EXECUTED, 5 VETOED,
6 CANCELLED, 7 EXPIRED, 8 CHALLENGED`. Who cleared a request (`decided_by`): `0 none, 1 AI, 2 owner, 3 guardian`.

* An approval by the **AI** can be paid only after `review_delay` (60 s to 7 days): the time to veto or challenge.
* An approval by a **human** (`decide`) can be paid at once.
* An approval stays payable for `exec_grace` after it is ready, then anyone can expire it and the money is released.
* A request nobody reviews or decides is closed by anyone after `escalation_window`.

## Where the money is

| Moment | Mandate balance | Reserved | Elsewhere |
| --- | --- | --- | --- |
| deposit / fund | +amount | | |
| approval | | +amount | seat `held` +amount |
| veto, cancel, expire, rejected audit | | -amount | seat `held` -amount |
| execute | -amount | -amount | payee +amount, seat `spent` +amount, window +amount |
| challenge | | | bond held by the contract, counted in `bonds` |
| upheld audit | -reward | | watcher gets bond + reward, seat `spent` +reward, window +reward |
| dismissed audit | +bond | | |
| withdraw (owner) | -amount (only unreserved) | | owner +amount |

`solvency()` reports `deposited - paid == held + bonds` and `balanced: true` whenever the books are right; the tests
and the live run check it after every step.

## The hard limits (all enforced by the contract)

| Limit | Value |
| --- | --- |
| smallest payment | 0.001 GEN |
| per-payment cap | owner's choice, at most 10^9 GEN |
| rolling-window cap | owner's choice, at least the per-payment cap; window length 1 minute to 30 days (fixed when the mandate is opened) |
| payments inside one window | 48 |
| seat budget | total a seat can ever spend (paid + reserved + rewards charged to it) |
| open requests per seat | 3 |
| seats per mandate | 12 (revoked seats still count) |
| listed payees | 24 |
| text sizes | name 3-60, policy 20-1200, purpose 12-300 characters |
| evidence | one public `http(s)` link: a real domain, no IP, no credentials, no custom port; one live request per page per mandate |
| expiry | an optional end date; afterwards nothing new is accepted or paid |

An evidence page is identified by its normalized address (scheme, `www.`, case of the host, default ports,
fragments, trailing slashes, parameter order, tracking parameters and percent-escape case are ignored), so an agent
cannot reuse one invoice under another spelling.

## The AI layer

* **Brake only.** The model returns `APPROVE`, `ESCALATE` or `REJECT` with a risk from 0 to 100. The contract settles
  that against the owner's limits: up to `auto_risk` an approval stands, above `reject_risk` it becomes a rejection,
  in between a human decides. A made-up verdict, a non-numeric risk or a missing field is treated as "unsure".
* **Deterministic tripwire.** A purpose that tries to talk to the reviewer ("ignore previous instructions", "reply with
  APPROVE", ...) is rejected by the contract itself without asking the model. An evidence page that does so can never
  be approved without a human. The tripwire is a best effort; the hard limits and the human veto hold even when a
  cleverly worded text slips past it.
* **Evidence.** The page is fetched, reduced to visible text in one linear pass (scripts, styles, comments and tags
  are dropped), and shown to the model as untrusted data. An unreadable page is retried (every two minutes, three
  tries) and then goes to a human; it is never approved by default.
* **Consensus.** The leader and every validator run the same assessment. A validator accepts the leader's result when
  the verdict is the same or one step stricter, the risk is within a slack, every deterministic flag it found is also
  present, and every field has the expected shape. It never accepts a more lenient verdict and never a made-up
  rejection, so disagreement drifts towards "ask a human", not towards "pay".
* **Closures carry only plain values.** Nothing from storage is captured by the functions sent to the validators.

## Challenge and audit

While an AI approval waits, anyone but the agent, the owner and the guardian can call `challenge` with a bond of 5% of
the payment (at least 0.001 GEN) and a reason of at least 12 characters. The request freezes. `audit` then runs a
second review that is stricter (it approves only up to two thirds of the owner's `auto_risk`) and treats the
watcher's reason as a lead, never as a fact.

* **Upheld** (the audit does not approve): the request is vetoed, the watcher gets the bond back plus 10% of the
  payment. That reward is money leaving the mandate, so it is **charged to the agent's seat and to the rolling window**
  and cut down to what both still allow. An agent and a friend therefore cannot farm rewards past the owner's limits.
* **Dismissed** (the audit approves): the bond goes to the mandate and the request is payable again, the challenge
  cannot be repeated.
* **Unreadable** three times: the bond goes back, nobody is blamed, a human decides.

## Interface

Amounts are in wei (1 GEN = 10^18). Addresses are `0x` hex strings. Views return JSON text.

| Method | Who | Purpose |
| --- | --- | --- |
| `create_mandate(name, policy, per_payment_cap, window_cap, window_secs, review_delay, guardian)` payable | anyone | open a mandate, the attached value is the first deposit |
| `set_rules(id, payee_mode, need_evidence, auto_risk, reject_risk, escalation_window, exec_grace, expires_in)` | owner | payee mode (0 any, 1 listed only), mandatory evidence, risk limits, time limits, expiry |
| `set_policy(id, policy)` / `set_limits(id, per_payment_cap, window_cap, review_delay)` | owner | change the policy or the limits (limits apply to approvals still waiting) |
| `set_guardian(id, guardian)` | owner | name, replace or remove (empty) the guardian |
| `set_paused(id, paused)` | owner, guardian (pause only) | stop new requests and payments |
| `fund(id)` payable / `withdraw(id, amount)` | anyone / owner | add money / take out unreserved money |
| `grant_delegate(id, who, budget)` / `revoke_delegate(id, who)` | owner / owner or guardian | seats |
| `add_payee(id, who)` / `remove_payee(id, who)` | owner | the allowlist |
| `request_payment(id, payee, amount, purpose, evidence_url)` | seat holder | file a request, returns its id |
| `cancel_request(request)` | its agent | withdraw before it is paid |
| `review(request)` | anyone | run the AI review |
| `decide(request, approve, note)` | owner, guardian | settle an escalation |
| `veto(request, note)` | owner, guardian | stop an approval |
| `execute(request)` | anyone | pay an approved request after its waiting time |
| `expire_request(request)` | anyone | close a request that ran out of time, or whose seat or mandate is gone |
| `challenge(request, reason)` payable / `audit(request)` | watcher / anyone | bet against an AI approval / settle the bet |
| `stats()`, `solvency()` | view | totals and the books |
| `get_mandate(id)`, `list_mandates(offset, limit)`, `mandates_of(who, offset, limit)` | view | mandates, newest first (pages of at most 50) |
| `get_request(id)`, `list_requests(mandate, offset, limit)`, `allowance_of(mandate, who)` | view | requests and what a seat could ask for right now |

## Deploy

With the GenLayer CLI or the Studio, deploy `contracts/leash.py` to Studionet (no constructor arguments). Or:

```bash
npm install
OWNER_KEY=0x<funded studionet key> node scripts/deploy.mjs      # prints the address, writes .leash-address
```

## Tests

Everything below runs locally, without a network, on the real GenLayer SDK through the `genlayer-test` direct runner.

```bash
pip install -r requirements.txt
genvm-lint check contracts/leash.py       # static check and schema extraction
python3 -m pytest -q                      # 545 tests, about two to three minutes
FUZZ_SEEDS=40 FUZZ_STEPS=300 python3 -m pytest -q tests/direct/test_fuzz.py     # a longer random walk
```

| File | What it covers |
| --- | --- |
| `test_text.py` | text cleaning, link rules, evidence-key normalization, page-to-text extraction (including linear-time proofs on hostile pages), the steering tripwire (hits and false positives) |
| `test_mandates.py` | opening and configuring mandates, every validation edge, funding and withdrawing, seats, payees, pause, expiry, views and paging |
| `test_requests.py` | filing, evidence reuse, review outcomes for every verdict/risk pair, odd model output, unreadable evidence and retries, decisions, veto, cancel, execute, expire |
| `test_limits.py` | rolling window (including the exact second it slides), the 48-payment bound, seat budgets, reservations, what a fooled model still cannot do |
| `test_challenge.py` | bonds, upheld and dismissed audits, the strictness threshold, unreadable audits, every way out of a challenge, reward capping, a drain attempt |
| `test_consensus.py` | the validator acceptance rule case by case, settlement, validators that disagree, forged leader results, pickling of the closures |
| `test_adversarial.py` | prompt injection (purpose, pages, claims), role confusion, replays, state skipping on every final state, reentrancy order, absurd amounts and addresses, hostile links |
| `test_fuzz.py` | random walks over the whole interface; after every call the books, reservations, seat sums, window sums, evidence uniqueness and the state machine are checked, and every refused call must leave the contract exactly as it was |

The suite was also checked by mutation: the contract was deliberately broken in sixteen places (no window check, no
waiting time, uncapped reward, reservation not released on veto, a lenient validator, a disabled tripwire, ...) and
each break was caught by at least one test.

## Live run on Studionet (GitHub Codespaces)

1. Open the repository in a Codespace (the dev container installs Python, Node and every dependency).
2. `npm run keys` creates `.env` with three fresh accounts and asks Studionet to fund them. If that is not possible,
   fund the printed addresses from the Studio faucet (owner about 0.3 GEN, watcher about 0.05 GEN). Alternatively add
   `OWNER_KEY`, `AGENT_KEY` and `WATCHER_KEY` as Codespaces secrets.
3. `bash scripts/run-all.sh` runs the static check, the local tests and then the live scenarios. For the live part
   alone: `node scripts/e2e.mjs`. `node scripts/e2e.mjs --dry-run` prints the plan, `--only review,veto` picks scenarios.

| Scenario | What it shows on the real network |
| --- | --- |
| `basics` | open, configure, fund, pause (guardian can pause, cannot resume), withdraw, views |
| `adversarial` | about thirty calls the contract must refuse, each checked to have changed no totals; a steering purpose rejected without the model |
| `expiry` | a request nobody acts on expires, a withdrawn one frees its evidence, an ended mandate pays nothing |
| `review` | the real model reviews an on-policy and an off-policy request; the on-policy one is followed through (pay or decide) with exact payee balance checks |
| `veto` | the guardian stops an approval and the reservation is released |
| `challenge` | a watcher bets a bond against an AI approval and the real audit settles it, whichever way it goes |
| `limits` | the rolling window and the seat budget, also against approved requests |

The model is real, so its verdicts vary from run to run. The run accepts any verdict and checks what must hold for all
of them; the report lists what the model said at each stage. Reports land in `reports/leash-e2e-<time>.{html,md,json}`
and refresh after every transaction. The exit code is 1 when a check failed. `reports/` also holds the local test
report when `scripts/run-all.sh` runs the whole chain.

### Offline rehearsal

`bash rehearsal/run.sh` runs `scripts/e2e.mjs` unchanged against a stub of the network that executes the real contract
in the local test runner with a scripted model. It checks the live script's own logic (argument shapes, waiting for
chain time, report generation) without spending anything. `REVIEW_MODE=escalate|reject` and `AUDIT_MODE=reject` steer
the scripted model. It cannot tell you anything about the real model or the real network.

## Frontend

`frontend/` is the web app: a multi-page React site with the dashboard, mandate and request screens, an explorer and
full documentation (21 pages with search). It talks to the contract at
`0x13Ad9bC5C0a1fcC19f5C410b6685EB6029893CB5` on GenLayer Studionet through `genlayer-js`.

Explorer: https://explorer-studio.genlayer.com/address/0x13Ad9bC5C0a1fcC19f5C410b6685EB6029893CB5

```bash
cd frontend
npm install
npm run dev                # local development
npm run build              # type check and production build into frontend/dist
npm test                   # unit tests
npm run check:contract     # fails when the generated interface differs from contracts/leash.py
```

* Wallets are discovered with EIP-6963; connect and disconnect really change the wallet permission; a banner offers to
  switch (or add) Studionet when the wallet is on another network.
* Three themes (light, dim, dark), a 3D hero with a flat fallback, and a transaction panel that follows each
  transaction through the consensus phases.
* The list of methods, parameters, errors and constants is generated from the contract
  (`npm run sync:contract`), so the interface cannot drift from it.
* Set `VITE_LEASH_ADDRESS` at build time to use another deployment.

See `frontend/README.md` for details and `frontend/tests/e2e/README.md` for the browser tests.

## Limitations

* Duplicate protection is by evidence address, not by meaning: an agent can describe the same invoice with a different
  page. The seat budget and the window bound that damage; they do not remove it.
* The steering tripwire is a list of phrases. A cleverly worded text can pass it and fool the model; the limits and the
  human veto are the real defence.
* Ownership cannot be transferred and the window length cannot be changed after a mandate is opened.
* A request approved under an old policy stays approved after the policy changes; the owner can veto it.
* The model only sees the first 4000 characters of visible text of the evidence page.
* Studionet is a test network; a mainnet deployment would need a review of the validator slack numbers and of the model
  prompt against the validators' actual models.

## Layout

```
contracts/leash.py        the contract
frontend/                 the web app and its documentation
tests/direct/             the local test suite (pytest)
scripts/                  deploy, keys, live run, receipt reader, setup, run-all
rehearsal/                offline rehearsal of the live run
.devcontainer/            GitHub Codespaces setup
reports/                  reports of live runs and of the local tests
```
