"""Backend of the offline rehearsal: runs the real contract in the direct runner and answers line-JSON requests.

It is started by rehearsal/run.sh (through pytest, because the direct runner lives in pytest fixtures) and talks to
the stub of genlayer-js over stdin and stdout. Nothing here touches a network."""

import json
import os
import re
import sys
from datetime import datetime, timezone

import pytest

from conftest import *  # noqa: F401,F403  (the same helpers as the unit tests)
from conftest import GEN, MILLI, Wire, act, deploy, hx

# the direct runner swaps file descriptor 0 for its own message, so keep a private copy of the real stdin first
_STDIN = os.fdopen(os.dup(0), "r")
MARK = "@@RPC "
REVIEW_MODE = os.environ.get("REVIEW_MODE", "approve")  # approve | escalate | reject
AUDIT_MODE = os.environ.get("AUDIT_MODE", "approve")  # approve | reject
PAGE_TEXT = (
    "<html><body><h1>Example domains</h1><p>Example domains are reserved by the IANA for documentation. "
    "They are maintained by the Internet Assigned Numbers Authority and can be used in documents without "
    "permission. The reserved names include example.com, example.net and example.org.</p></body></html>"
)


def out(obj):
    sys.stdout.write(MARK + json.dumps(obj) + "\n")
    sys.stdout.flush()


def unbig(value):
    if isinstance(value, dict) and "$big" in value:
        return int(value["$big"])
    if isinstance(value, list):
        return [unbig(v) for v in value]
    return value


def reply(verdict, risk, reason):
    return json.dumps({"verdict": verdict, "risk": risk, "flags": [], "reason": reason})


def set_mocks(vm):
    vm.clear_mocks()
    vm.mock_web(r"iana\.org", {"status": 200, "body": PAGE_TEXT})
    vm.mock_llm(r"<purpose>[^<]*casino", reply("REJECT", 92, "Gambling is outside the policy."))
    reviewer = {"approve": reply("APPROVE", 12, "The request fits the policy."), "escalate": reply("ESCALATE", 50, "Not sure."), "reject": reply("REJECT", 90, "No.")}[REVIEW_MODE]
    vm.mock_llm(r"first-line reviewer", reviewer)
    auditor = {"approve": reply("APPROVE", 10, "The approval holds."), "reject": reply("REJECT", 90, "The evidence does not support it.")}[AUDIT_MODE]
    vm.mock_llm(r"second-opinion auditor", auditor)


def test_serve(direct_vm, direct_deploy):
    vm = direct_vm
    c = deploy(direct_deploy, vm)
    funded = {}
    out({"ready": True})
    for line in _STDIN:
        line = line.strip()
        if not line:
            continue
        req = json.loads(line)
        rid = req.get("id")
        try:
            now = int(req.get("now", 0))
            if now:
                vm.warp(datetime.fromtimestamp(now, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
            op = req["op"]
            if op == "fund":
                funded[req["address"].lower()] = funded.get(req["address"].lower(), 0) + int(req["amount"])
                out({"id": rid, "ok": True})
            elif op == "balance":
                addr = req["address"].lower()
                got = sum(v for a, v in Wire.sent if a == addr)
                out({"id": rid, "ok": True, "ret": str(funded.get(addr, 0) + got)})
            elif op == "view":
                set_mocks(vm)
                args = unbig(req["args"])
                out({"id": rid, "ok": True, "ret": getattr(c, req["fn"])(*args)})
            elif op == "call":
                set_mocks(vm)
                args = unbig(req["args"])
                sender = bytes.fromhex(req["sender"][2:])
                act(vm, sender, int(req.get("value", 0)))
                try:
                    getattr(c, req["fn"])(*args)
                finally:
                    vm.value = 0
                out({"id": rid, "ok": True})
            else:
                out({"id": rid, "ok": False, "error": f"unknown op {op}"})
        except Exception as e:  # a refusal by the contract
            vm.value = 0
            out({"id": rid, "ok": False, "error": f"{type(e).__name__}: {e}"[:400]})
