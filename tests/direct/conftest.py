"""Shared helpers for the direct-mode suite (genlayer-test fixtures)."""

import json
import sys
from datetime import datetime, timezone

import pytest

CONTRACT = "contracts/leash.py"
MODULE = "_contract_leash"
GEN = 10**18
MILLI = 10**15  # 0.001 GEN, the smallest payment

# request states, deciders, bond states (the numbers the contract reports)
PENDING, APPROVED, ESCALATED, REJECTED, EXECUTED, VETOED, CANCELLED, EXPIRED, CHALLENGED = range(9)
BY_NONE, BY_AI, BY_OWNER, BY_GUARDIAN = range(4)
BOND_NONE, BOND_HELD, BOND_REFUNDED, BOND_FORFEITED, BOND_REWARDED = range(5)
FINAL = (REJECTED, EXECUTED, VETOED, CANCELLED, EXPIRED)

T0 = int(datetime(2026, 10, 20, 12, 0, 0, tzinfo=timezone.utc).timestamp())

POLICY = (
    "Pay only for cloud hosting, developer tooling and domain renewals of the studio. "
    "Never pay for gambling, giveaways or anything personal."
)
PURPOSE = "Monthly invoice for the studio's cloud hosting."
EVIDENCE = "https://billing.example.org/invoices/1001"
EVIDENCE_2 = "https://billing.example.org/invoices/1002"
PAGE = (
    "<html><body><h1>Invoice 1001</h1><p>Cloud hosting for the studio, October. "
    "Amount due on receipt. Thank you for your business.</p></body></html>"
)


def hx(a) -> str:
    """Lower-case 0x form of an address object, raw bytes or a hex string."""
    if isinstance(a, str):
        return a.lower()
    if hasattr(a, "as_hex"):
        return str(a.as_hex).lower()
    return "0x" + bytes(a).hex()


def at(vm, offset: int) -> None:
    """Move the chain clock to T0 + offset seconds."""
    vm.warp(datetime.fromtimestamp(T0 + offset, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))


def act(vm, who, value: int = 0):
    """The next call is made by `who` and carries `value`."""
    try:
        vm.deal(who, 1000 * GEN)
    except Exception:
        pass
    vm.sender = who
    vm.value = value


class Wire:
    """Stands in for the chain-level transfer so that payouts can be inspected."""

    sent = []

    def __init__(self, who):
        self.who = who

    def emit_transfer(self, **kw):
        Wire.sent.append((hx(self.who), int(kw["value"])))


class Ledger:
    def __init__(self):
        Wire.sent = []

    @property
    def sent(self):
        return Wire.sent

    def to(self, who) -> int:
        key = hx(who)
        return sum(v for a, v in Wire.sent if a == key)

    def total(self) -> int:
        return sum(v for _, v in Wire.sent)

    def count(self) -> int:
        return len(Wire.sent)


@pytest.fixture
def ledger():
    return Ledger()


def _forget_contract_class() -> None:
    """The SDK keeps one contract class per process; drop it so every test can deploy afresh."""
    for name in ("genlayer.gl.genvm_contracts", "genlayer.genvm_contracts"):
        registry = sys.modules.get(name)
        if registry is not None and hasattr(registry, "__known_contract__"):
            registry.__known_contract__ = None


def deploy(direct_deploy, direct_vm):
    at(direct_vm, 0)
    direct_vm.check_pickling = True  # the closures handed to the VM must be serializable
    _forget_contract_class()
    c = direct_deploy(CONTRACT)
    mod = sys.modules[MODULE]
    mod._Wire = Wire
    Wire.sent = []
    return c


def stats(c) -> dict:
    return json.loads(c.stats())


def books(c) -> dict:
    return json.loads(c.solvency())


def _lowered(row):
    """The contract reports checksummed addresses; the tests compare lower-case ones."""
    if isinstance(row, dict):
        for k, v in row.items():
            if k in ("owner", "guardian", "who", "delegate", "payee", "challenger") and isinstance(v, str):
                row[k] = v.lower()
            elif k == "payees":
                row[k] = [x.lower() for x in v]
            elif k == "delegates":
                for d in v:
                    _lowered(d)
    return row


def mrow(c, mandate_id: int) -> dict:
    return _lowered(json.loads(c.get_mandate(mandate_id)))


def rrow(c, request_id: int) -> dict:
    return _lowered(json.loads(c.get_request(request_id)))


def seat(c, mandate_id: int, who) -> dict:
    row = mrow(c, mandate_id)
    for d in row["delegates"]:
        if d["who"].lower() == hx(who):
            return d
    raise AssertionError("no such seat")


def create(
    c, vm, owner, deposit=GEN, name="Studio spending", policy=POLICY, per_payment=10 * MILLI * 10, window_cap=GEN // 2,
    window_secs=3600, review_delay=300, guardian="",
) -> int:
    act(vm, owner, deposit)
    mid = c.create_mandate(name, policy, per_payment, window_cap, window_secs, review_delay, guardian)
    vm.value = 0
    return mid


def rules(c, vm, owner, mid, payee_mode=0, need_evidence=False, auto_risk=35, reject_risk=75, escalation_window=3600, exec_grace=3600, expires_in=0):
    act(vm, owner)
    c.set_rules(mid, payee_mode, need_evidence, auto_risk, reject_risk, escalation_window, exec_grace, expires_in)


def grant(c, vm, owner, mid, who, budget=GEN // 4):
    act(vm, owner)
    c.grant_delegate(mid, hx(who), budget)


def ask(c, vm, agent, mid, payee, amount=2 * MILLI * 10, purpose=PURPOSE, url=EVIDENCE) -> int:
    act(vm, agent)
    return c.request_payment(mid, hx(payee), amount, purpose, url)


def mock_page(vm, body=PAGE, pattern=r"billing\.example\.org", status=200):
    vm.mock_web(pattern, {"status": status, "body": body})


def reviewer_reply(verdict="APPROVE", risk=10, flags=(), reason="The request fits the policy."):
    return {"verdict": verdict, "risk": risk, "flags": list(flags), "reason": reason}


def mock_reviewer(vm, verdict="APPROVE", risk=10, flags=(), reason="The request fits the policy.", raw=None):
    """The first-line reviewer's answer. It only matches the review prompt."""
    vm.mock_llm(r"first-line reviewer", raw if raw is not None else json.dumps(reviewer_reply(verdict, risk, flags, reason)))


def mock_auditor(vm, verdict="APPROVE", risk=10, flags=(), reason="The approval holds.", raw=None):
    vm.mock_llm(r"second-opinion auditor", raw if raw is not None else json.dumps(reviewer_reply(verdict, risk, flags, reason)))


def world(vm, verdict="APPROVE", risk=10, page=PAGE, status=200, **kw):
    """Fresh mocks: the evidence page and the reviewer's answer."""
    vm.clear_mocks()
    mock_page(vm, body=page, status=status)
    mock_reviewer(vm, verdict, risk, **kw)


def review(c, vm, caller, rid, verdict="APPROVE", risk=10, offset=None, **kw):
    """Ask for the review at `offset` (or now) with the given reviewer answer."""
    world(vm, verdict, risk, **kw)
    if offset is not None:
        at(vm, offset)
    act(vm, caller)
    c.review(rid)


def audit(c, vm, caller, rid, verdict="APPROVE", risk=10, offset=None, page=PAGE, **kw):
    vm.clear_mocks()
    mock_page(vm, body=page)
    mock_auditor(vm, verdict, risk, **kw)
    if offset is not None:
        at(vm, offset)
    act(vm, caller)
    c.audit(rid)


def execute(c, vm, caller, rid, offset=None):
    if offset is not None:
        at(vm, offset)
    act(vm, caller)
    c.execute(rid)


def challenge(c, vm, who, rid, reason="The invoice does not match the policy.", offset=None):
    row = rrow(c, rid)
    amount = int(row["amount"])
    bond = max(MILLI, amount * 500 // 10_000)
    if offset is not None:
        at(vm, offset)
    act(vm, who, bond)
    c.challenge(rid, reason)
    vm.value = 0
    return bond


def setup(c, vm, owner, agent, **kw) -> int:
    """A funded mandate with one seat for `agent`."""
    mid = create(c, vm, owner, **{k: v for k, v in kw.items() if k in ("deposit", "per_payment", "window_cap", "window_secs", "review_delay", "guardian")})
    grant(c, vm, owner, mid, agent, kw.get("budget", GEN // 4))
    return mid


def approved(c, vm, owner, agent, payee, mid=None, amount=2 * MILLI * 10, url=EVIDENCE, at_time=100, **kw):
    """File a request and let the AI approve it. Returns (mandate id, request id); the clock stands at `at_time`."""
    if mid is None:
        mid = setup(c, vm, owner, agent, **kw)
    at(vm, at_time - 10)
    rid = ask(c, vm, agent, mid, payee, amount=amount, url=url)
    review(c, vm, owner, rid, "APPROVE", 10, offset=at_time)
    return mid, rid


def fingerprint(c) -> str:
    """Everything observable about the contract, so that a refused call can be shown to change nothing."""
    s = stats(c)
    return json.dumps(
        [s, books(c), [mrow(c, i) for i in range(s["mandates"])], [rrow(c, i) for i in range(s["requests"])], list(Wire.sent)],
        sort_keys=True,
    )


def refuse(c, vm, msg, fn, *args, who=None, value=0):
    """The call must be refused with `msg` in the error, and it must leave the contract exactly as it was."""
    if who is not None:
        act(vm, who, value)
    before = fingerprint(c)
    with vm.expect_revert(msg):
        fn(*args)
    vm.value = 0
    assert fingerprint(c) == before, "a refused call changed the contract"


def _actor(n: int) -> bytes:
    return bytes([0xB0, n]) + bytes(18)


class P:
    """Fixed actors, as raw 20-byte addresses."""

    owner = _actor(1)
    guardian = _actor(2)
    agent = _actor(3)
    agent2 = _actor(4)
    payee = _actor(5)
    payee2 = _actor(6)
    watcher = _actor(7)
    stranger = _actor(8)
    extra = [_actor(20 + i) for i in range(30)]


ZERO_ADDRESS = "0x" + "0" * 40


def fresh(direct_deploy, direct_vm):
    """A deployed contract, plus the shortcuts most tests need."""
    return deploy(direct_deploy, direct_vm)
