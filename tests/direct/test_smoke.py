import json

from conftest import *


def test_deploys_and_runs_the_happy_path(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie, ledger):
    c = deploy(direct_deploy, direct_vm)
    mid, rid = approved(c, direct_vm, direct_alice, direct_bob, direct_charlie)
    row = rrow(c, rid)
    assert row["state"] == APPROVED and row["decided_by"] == BY_AI
    execute(c, direct_vm, direct_charlie, rid, offset=100 + 300)
    assert rrow(c, rid)["state"] == EXECUTED
    assert ledger.to(direct_charlie) == 20 * MILLI
    assert books(c)["balanced"]
