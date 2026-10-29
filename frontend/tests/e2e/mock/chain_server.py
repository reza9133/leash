"""Backend of the frontend test chain: runs the real contract in the direct runner and answers line-JSON requests.

Derived from rehearsal/rehearsal_server.py. Differences: the reviewer and the auditor are configurable at run time
(op set_mode), and a write call returns the contract's return value.

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


def reply(verdict, risk, reason, flags=None):
    return json.dumps({"verdict": verdict, "risk": risk, "flags": flags or [], "reason": reason})


CFG = {
    "review": {"verdict": "APPROVE", "risk": 12, "reason": "The request fits the policy.", "flags": []},
    "audit": {"verdict": "APPROVE", "risk": 10, "reason": "The approval holds.", "flags": []},
}


def set_mocks(vm):
    vm.clear_mocks()
    vm.mock_web(r"iana\.org", {"status": 200, "body": PAGE_TEXT})
    vm.mock_web(r"billing\.example\.org", {"status": 200, "body": PAGE_TEXT})
    vm.mock_llm(r"<purpose>[^<]*casino", reply("REJECT", 92, "Gambling is outside the policy.", ["off_policy"]))
    r, a = CFG["review"], CFG["audit"]
    vm.mock_llm(r"first-line reviewer", reply(r["verdict"], r["risk"], r["reason"], r["flags"]))
    vm.mock_llm(r"second-opinion auditor", reply(a["verdict"], a["risk"], a["reason"], a["flags"]))


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
                    ret = getattr(c, req["fn"])(*args)
                finally:
                    vm.value = 0
                out({"id": rid, "ok": True, "ret": ret if isinstance(ret, (int, str, type(None))) else str(ret)})
            elif op == "set_mode":
                for k in ("review", "audit"):
                    if k in req:
                        CFG[k].update(req[k])
                out({"id": rid, "ok": True})
            else:
                out({"id": rid, "ok": False, "error": f"unknown op {op}"})
        except Exception as e:  # a refusal by the contract
            vm.value = 0
            out({"id": rid, "ok": False, "error": f"{type(e).__name__}: {e}"[:400]})
