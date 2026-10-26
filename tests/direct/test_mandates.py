"""Opening, configuring, funding and administering a mandate."""

import json

import pytest

from conftest import *


@pytest.fixture
def c(direct_vm, direct_deploy):
    return deploy(direct_deploy, direct_vm)


@pytest.fixture
def vm(direct_vm):
    return direct_vm


# ---- create ---------------------------------------------------------------------------------------------------------


def test_create_stores_everything_and_counts_the_deposit(c, vm):
    mid = create(c, vm, P.owner, deposit=GEN, name="  Studio   spending ", guardian=hx(P.guardian))
    row = mrow(c, mid)
    assert mid == 0
    assert row["owner"] == hx(P.owner) and row["guardian"] == hx(P.guardian)
    assert row["name"] == "Studio spending"
    assert row["policy"] == POLICY and row["policy_rev"] == 1
    assert row["balance"] == str(GEN) and row["deposited"] == str(GEN) and row["free"] == str(GEN)
    assert row["per_payment_cap"] == str(100 * MILLI) and row["window_cap"] == str(GEN // 2)
    assert row["window_secs"] == 3600 and row["review_delay"] == 300
    assert (row["payee_mode"], row["need_evidence"], row["paused"], row["ended"]) == (0, False, False, False)
    assert (row["auto_risk"], row["reject_risk"]) == (35, 75)
    assert row["escalation_window"] == row["exec_grace"] == 3 * 86400
    assert row["delegates"] == [] and row["payees"] == [] and row["requests"] == 0
    assert books(c)["deposited"] == str(GEN) and books(c)["balanced"]


def test_create_without_value_and_ids_increase(c, vm):
    a = create(c, vm, P.owner, deposit=0)
    b = create(c, vm, P.stranger, deposit=5 * MILLI)
    assert (a, b) == (0, 1)
    assert mrow(c, a)["balance"] == "0" and mrow(c, b)["balance"] == str(5 * MILLI)
    assert stats(c)["mandates"] == 2 and books(c)["balanced"]


def test_create_cleans_angle_brackets_and_invisible_text(c, vm):
    mid = create(c, vm, P.owner, name="<b>Studio</b>​ fund", policy="Pay <only> for hosting​ and tooling of the studio.")
    row = mrow(c, mid)
    assert "<" not in row["name"] and ">" not in row["name"] and "​" not in row["name"]
    assert row["policy"] == "Pay (only) for hosting and tooling of the studio."


CREATE_BAD = [
    ("short name", dict(name="ab"), "The name needs"),
    ("blank name", dict(name="     "), "The name needs"),
    ("long name", dict(name="n" * 61), "The name needs"),
    ("short policy", dict(policy="too short"), "The policy needs"),
    ("long policy", dict(policy="p" * 1201), "The policy needs"),
    ("window too short", dict(window_secs=59), "The spending window"),
    ("window too long", dict(window_secs=30 * 86400 + 1), "The spending window"),
    ("per payment too small", dict(per_payment=MILLI - 1), "The per-payment limit"),
    ("per payment too large", dict(per_payment=10**27 + 1, window_cap=10**27 + 1), "The per-payment limit"),
    ("window cap under per payment", dict(per_payment=10 * MILLI, window_cap=10 * MILLI - 1), "The window limit"),
    ("window cap too large", dict(window_cap=10**27 + 1), "The window limit"),
    ("delay too short", dict(review_delay=59), "The review delay"),
    ("delay too long", dict(review_delay=7 * 86400 + 1), "The review delay"),
    ("guardian is the owner", dict(guardian=hx(P.owner)), "cannot be the guardian"),
    ("guardian is garbage", dict(guardian="not-an-address"), "not a valid address"),
]


@pytest.mark.parametrize("label,kw,msg", CREATE_BAD, ids=[x[0] for x in CREATE_BAD])
def test_create_refuses_bad_input_and_changes_nothing(c, vm, label, kw, msg):
    base = dict(deposit=GEN, name="Studio spending", policy=POLICY, per_payment=100 * MILLI, window_cap=GEN // 2, window_secs=3600, review_delay=300, guardian="")
    base.update(kw)
    refuse(
        c, vm, msg, c.create_mandate, base["name"], base["policy"], base["per_payment"], base["window_cap"], base["window_secs"],
        base["review_delay"], base["guardian"], who=P.owner, value=base["deposit"],
    )


def test_a_zero_guardian_means_none(c, vm):
    mid = create(c, vm, P.owner, guardian=ZERO_ADDRESS)
    assert mrow(c, mid)["guardian"] == ""


def test_mandates_of_lists_owner_guardian_and_seat_holders_newest_first(c, vm):
    m0 = create(c, vm, P.owner, guardian=hx(P.guardian))
    m1 = create(c, vm, P.owner)
    grant(c, vm, P.owner, m0, P.agent)
    assert [m["id"] for m in json.loads(c.mandates_of(hx(P.owner), 0, 10))] == [m1, m0]
    assert [m["id"] for m in json.loads(c.mandates_of(hx(P.guardian), 0, 10))] == [m0]
    assert [m["id"] for m in json.loads(c.mandates_of(hx(P.agent), 0, 10))] == [m0]
    assert json.loads(c.mandates_of(hx(P.stranger), 0, 10)) == []


# ---- the owner's switches -------------------------------------------------------------------------------------------


def test_set_rules_updates_every_field(c, vm):
    mid = create(c, vm, P.owner)
    at(vm, 1000)
    act(vm, P.owner)
    c.set_rules(mid, 1, True, 20, 60, 7200, 1800, 86400)
    row = mrow(c, mid)
    assert (row["payee_mode"], row["need_evidence"], row["auto_risk"], row["reject_risk"]) == (1, True, 20, 60)
    assert (row["escalation_window"], row["exec_grace"], row["expires_at"]) == (7200, 1800, T0 + 1000 + 86400)


def test_set_rules_zero_expiry_clears_the_end(c, vm):
    mid = create(c, vm, P.owner)
    rules(c, vm, P.owner, mid, expires_in=3600)
    assert mrow(c, mid)["expires_at"] != 0
    rules(c, vm, P.owner, mid, expires_in=0)
    assert mrow(c, mid)["expires_at"] == 0


RULES_BAD = [
    ("payee mode 2", dict(payee_mode=2), "payee mode"),
    ("payee mode -1", dict(payee_mode=-1), "payee mode"),
    ("auto above reject", dict(auto_risk=60, reject_risk=50), "risk limits"),
    ("negative auto", dict(auto_risk=-1), "risk limits"),
    ("reject above 100", dict(reject_risk=101), "risk limits"),
    ("escalation window short", dict(escalation_window=59), "escalation window"),
    ("escalation window long", dict(escalation_window=30 * 86400 + 1), "escalation window"),
    ("grace short", dict(exec_grace=59), "escalation window"),
    ("grace long", dict(exec_grace=30 * 86400 + 1), "escalation window"),
    ("expiry short", dict(expires_in=59), "expiry"),
    ("expiry long", dict(expires_in=366 * 86400 + 1), "expiry"),
    ("expiry negative", dict(expires_in=-5), "expiry"),
]


@pytest.mark.parametrize("label,kw,msg", RULES_BAD, ids=[x[0] for x in RULES_BAD])
def test_set_rules_refuses_bad_values(c, vm, label, kw, msg):
    mid = create(c, vm, P.owner)
    args = dict(payee_mode=0, need_evidence=False, auto_risk=35, reject_risk=75, escalation_window=3600, exec_grace=3600, expires_in=0)
    args.update(kw)
    refuse(c, vm, msg, c.set_rules, mid, *args.values(), who=P.owner)


def test_set_rules_accepts_the_edges(c, vm):
    mid = create(c, vm, P.owner)
    rules(c, vm, P.owner, mid, auto_risk=0, reject_risk=0, escalation_window=60, exec_grace=60, expires_in=60)
    rules(c, vm, P.owner, mid, auto_risk=100, reject_risk=100, escalation_window=30 * 86400, exec_grace=30 * 86400, expires_in=366 * 86400)
    row = mrow(c, mid)
    assert (row["auto_risk"], row["reject_risk"]) == (100, 100)


@pytest.mark.parametrize("who", [P.guardian, P.agent, P.stranger])
def test_only_the_owner_configures(c, vm, who):
    mid = create(c, vm, P.owner, guardian=hx(P.guardian))
    grant(c, vm, P.owner, mid, P.agent)
    refuse(c, vm, "Only the owner", c.set_rules, mid, 0, False, 35, 75, 3600, 3600, 0, who=who)
    refuse(c, vm, "Only the owner", c.set_policy, mid, POLICY, who=who)
    refuse(c, vm, "Only the owner", c.set_limits, mid, 10 * MILLI, 20 * MILLI, 300, who=who)
    refuse(c, vm, "Only the owner", c.set_guardian, mid, hx(P.stranger), who=who)
    refuse(c, vm, "Only the owner", c.grant_delegate, mid, hx(P.agent2), MILLI, who=who)
    refuse(c, vm, "Only the owner", c.add_payee, mid, hx(P.payee), who=who)
    refuse(c, vm, "Only the owner", c.withdraw, mid, MILLI, who=who)


def test_set_policy_bumps_the_revision_and_validates(c, vm):
    mid = create(c, vm, P.owner)
    act(vm, P.owner)
    c.set_policy(mid, "  Pay only   for <b>domains</b> of the studio.  ")
    row = mrow(c, mid)
    assert row["policy"] == "Pay only for (b)domains(/b) of the studio." and row["policy_rev"] == 2
    refuse(c, vm, "The policy needs", c.set_policy, mid, "short", who=P.owner)
    refuse(c, vm, "The policy needs", c.set_policy, mid, "x" * 1201, who=P.owner)
    assert mrow(c, mid)["policy_rev"] == 2


def test_set_limits_validates_like_create(c, vm):
    mid = create(c, vm, P.owner)
    act(vm, P.owner)
    c.set_limits(mid, 50 * MILLI, 80 * MILLI, 600)
    row = mrow(c, mid)
    assert (row["per_payment_cap"], row["window_cap"], row["review_delay"]) == (str(50 * MILLI), str(80 * MILLI), 600)
    refuse(c, vm, "per-payment limit", c.set_limits, mid, 0, 80 * MILLI, 600, who=P.owner)
    refuse(c, vm, "window limit", c.set_limits, mid, 50 * MILLI, 49 * MILLI, 600, who=P.owner)
    refuse(c, vm, "review delay", c.set_limits, mid, 50 * MILLI, 80 * MILLI, 30, who=P.owner)


def test_guardian_can_be_set_replaced_and_removed(c, vm):
    mid = create(c, vm, P.owner)
    act(vm, P.owner)
    c.set_guardian(mid, hx(P.guardian))
    assert mrow(c, mid)["guardian"] == hx(P.guardian)
    c.set_guardian(mid, hx(P.stranger))
    assert mrow(c, mid)["guardian"] == hx(P.stranger)
    c.set_guardian(mid, "")
    assert mrow(c, mid)["guardian"] == ""
    refuse(c, vm, "cannot be the guardian", c.set_guardian, mid, hx(P.owner), who=P.owner)
    refuse(c, vm, "not a valid address", c.set_guardian, mid, "0x12", who=P.owner)


def test_a_seat_holder_cannot_be_made_guardian_and_the_reverse(c, vm):
    mid = create(c, vm, P.owner, guardian=hx(P.guardian))
    grant(c, vm, P.owner, mid, P.agent)
    refuse(c, vm, "seat holder cannot also be the guardian", c.set_guardian, mid, hx(P.agent), who=P.owner)
    refuse(c, vm, "guardian cannot also hold a seat", c.grant_delegate, mid, hx(P.guardian), MILLI * 5, who=P.owner)


def test_a_revoked_seat_holder_may_become_guardian(c, vm):
    mid = create(c, vm, P.owner)
    grant(c, vm, P.owner, mid, P.agent)
    act(vm, P.owner)
    c.revoke_delegate(mid, hx(P.agent))
    c.set_guardian(mid, hx(P.agent))
    assert mrow(c, mid)["guardian"] == hx(P.agent)
    refuse(c, vm, "guardian cannot also hold a seat", c.grant_delegate, mid, hx(P.agent), MILLI * 5, who=P.owner)


# ---- money in and out -----------------------------------------------------------------------------------------------


def test_anyone_can_fund_and_it_is_counted(c, vm):
    mid = create(c, vm, P.owner, deposit=0)
    act(vm, P.stranger, 3 * MILLI)
    c.fund(mid)
    vm.value = 0
    act(vm, P.owner, 4 * MILLI)
    c.fund(mid)
    vm.value = 0
    row = mrow(c, mid)
    assert row["balance"] == str(7 * MILLI) and row["deposited"] == str(7 * MILLI)
    assert books(c)["deposited"] == str(7 * MILLI) and books(c)["balanced"]


def test_fund_refuses_zero_and_unknown_mandates(c, vm):
    mid = create(c, vm, P.owner)
    refuse(c, vm, "Send some GEN", c.fund, mid, who=P.stranger, value=0)
    refuse(c, vm, "No such mandate", c.fund, 9, who=P.stranger, value=MILLI)
    refuse(c, vm, "No such mandate", c.fund, -1, who=P.stranger, value=MILLI)


def test_withdraw_pays_the_owner_and_keeps_the_books(c, vm, ledger):
    mid = create(c, vm, P.owner, deposit=GEN)
    act(vm, P.owner)
    c.withdraw(mid, 400 * MILLI)
    assert ledger.to(P.owner) == 400 * MILLI and ledger.count() == 1
    row = mrow(c, mid)
    assert row["balance"] == str(600 * MILLI) and row["withdrawn"] == str(400 * MILLI)
    c.withdraw(mid, 600 * MILLI)
    assert mrow(c, mid)["balance"] == "0" and ledger.to(P.owner) == GEN
    assert books(c)["balanced"]


@pytest.mark.parametrize("amount", [0, -1, GEN + 1, 10**30])
def test_withdraw_refuses_bad_amounts(c, vm, amount):
    mid = create(c, vm, P.owner, deposit=GEN)
    refuse(c, vm, "unreserved balance", c.withdraw, mid, amount, who=P.owner)


def test_withdraw_cannot_touch_reserved_money(c, vm, ledger):
    mid, rid = approved(c, vm, P.owner, P.agent, P.payee)
    reserved = int(rrow(c, rid)["amount"])
    free = GEN - reserved
    refuse(c, vm, "unreserved balance", c.withdraw, mid, free + 1, who=P.owner)
    act(vm, P.owner)
    c.withdraw(mid, free)
    assert mrow(c, mid)["balance"] == str(reserved) and mrow(c, mid)["free"] == "0"
    assert books(c)["balanced"]


# ---- seats ----------------------------------------------------------------------------------------------------------


def test_grant_creates_a_seat_and_regrant_updates_it(c, vm):
    mid = create(c, vm, P.owner)
    grant(c, vm, P.owner, mid, P.agent, budget=100 * MILLI)
    s = seat(c, mid, P.agent)
    assert (s["active"], s["budget"], s["spent"], s["held"], s["left"], s["open"]) == (True, str(100 * MILLI), "0", "0", str(100 * MILLI), 0)
    grant(c, vm, P.owner, mid, P.agent, budget=30 * MILLI)
    assert len(mrow(c, mid)["delegates"]) == 1 and seat(c, mid, P.agent)["budget"] == str(30 * MILLI)


def test_grant_refuses_bad_seats(c, vm):
    mid = create(c, vm, P.owner, guardian=hx(P.guardian))
    refuse(c, vm, "cannot hold a seat", c.grant_delegate, mid, hx(P.owner), 5 * MILLI, who=P.owner)
    refuse(c, vm, "cannot hold a seat", c.grant_delegate, mid, ZERO_ADDRESS, 5 * MILLI, who=P.owner)
    refuse(c, vm, "not a valid address", c.grant_delegate, mid, "agent", 5 * MILLI, who=P.owner)
    refuse(c, vm, "budget is out of range", c.grant_delegate, mid, hx(P.agent), MILLI - 1, who=P.owner)
    refuse(c, vm, "budget is out of range", c.grant_delegate, mid, hx(P.agent), 10**27 + 1, who=P.owner)
    refuse(c, vm, "No such mandate", c.grant_delegate, 5, hx(P.agent), 5 * MILLI, who=P.owner)


def test_seats_are_limited_and_revoked_seats_still_count(c, vm):
    mid = create(c, vm, P.owner)
    for who in P.extra[:12]:
        grant(c, vm, P.owner, mid, who)
    refuse(c, vm, "All seats", c.grant_delegate, mid, hx(P.extra[12]), 5 * MILLI, who=P.owner)
    act(vm, P.owner)
    c.revoke_delegate(mid, hx(P.extra[0]))
    refuse(c, vm, "All seats", c.grant_delegate, mid, hx(P.extra[12]), 5 * MILLI, who=P.owner)
    grant(c, vm, P.owner, mid, P.extra[0], budget=7 * MILLI)  # the old seat comes back
    assert seat(c, mid, P.extra[0])["active"] is True


def test_revoke_by_owner_or_guardian_only(c, vm):
    mid = create(c, vm, P.owner, guardian=hx(P.guardian))
    grant(c, vm, P.owner, mid, P.agent)
    grant(c, vm, P.owner, mid, P.agent2)
    refuse(c, vm, "Only the owner or the guardian", c.revoke_delegate, mid, hx(P.agent), who=P.stranger)
    refuse(c, vm, "Only the owner or the guardian", c.revoke_delegate, mid, hx(P.agent), who=P.agent)
    refuse(c, vm, "holds no seat", c.revoke_delegate, mid, hx(P.stranger), who=P.owner)
    act(vm, P.guardian)
    c.revoke_delegate(mid, hx(P.agent))
    act(vm, P.owner)
    c.revoke_delegate(mid, hx(P.agent2))
    assert not seat(c, mid, P.agent)["active"] and not seat(c, mid, P.agent2)["active"]


def test_a_revoked_seat_cannot_ask_and_a_regranted_one_can(c, vm):
    mid = setup(c, vm, P.owner, P.agent)
    act(vm, P.owner)
    c.revoke_delegate(mid, hx(P.agent))
    refuse(c, vm, "active seat", c.request_payment, mid, hx(P.payee), 20 * MILLI, PURPOSE, "", who=P.agent)
    grant(c, vm, P.owner, mid, P.agent)
    assert ask(c, vm, P.agent, mid, P.payee, url="") == 0


# ---- payees ---------------------------------------------------------------------------------------------------------


def test_payee_list_add_remove_and_limits(c, vm):
    mid = create(c, vm, P.owner)
    act(vm, P.owner)
    c.add_payee(mid, hx(P.payee))
    c.add_payee(mid, hx(P.payee2))
    assert mrow(c, mid)["payees"] == [hx(P.payee), hx(P.payee2)]
    refuse(c, vm, "already listed", c.add_payee, mid, hx(P.payee), who=P.owner)
    refuse(c, vm, "cannot be a payee", c.add_payee, mid, ZERO_ADDRESS, who=P.owner)
    refuse(c, vm, "not a valid address", c.add_payee, mid, "0xzz", who=P.owner)
    act(vm, P.owner)
    c.remove_payee(mid, hx(P.payee))
    assert mrow(c, mid)["payees"] == [hx(P.payee2)]
    refuse(c, vm, "not listed", c.remove_payee, mid, hx(P.payee), who=P.owner)
    refuse(c, vm, "Only the owner", c.remove_payee, mid, hx(P.payee2), who=P.stranger)


def test_payee_list_is_capped(c, vm):
    mid = create(c, vm, P.owner)
    act(vm, P.owner)
    for who in P.extra[:24]:
        c.add_payee(mid, hx(who))
    refuse(c, vm, "payee list is full", c.add_payee, mid, hx(P.extra[24]), who=P.owner)
    act(vm, P.owner)
    c.remove_payee(mid, hx(P.extra[3]))
    c.add_payee(mid, hx(P.extra[24]))
    assert len(mrow(c, mid)["payees"]) == 24


def test_allowlist_mode_pays_only_listed_payees(c, vm):
    mid = setup(c, vm, P.owner, P.agent)
    rules(c, vm, P.owner, mid, payee_mode=1)
    refuse(c, vm, "not on the allowlist", c.request_payment, mid, hx(P.payee), 20 * MILLI, PURPOSE, "", who=P.agent)
    act(vm, P.owner)
    c.add_payee(mid, hx(P.payee))
    assert ask(c, vm, P.agent, mid, P.payee, url="") == 0
    refuse(c, vm, "not on the allowlist", c.request_payment, mid, hx(P.payee2), 20 * MILLI, PURPOSE, "", who=P.agent)


def test_a_payee_removed_after_approval_blocks_the_payment(c, vm):
    mid = setup(c, vm, P.owner, P.agent)
    rules(c, vm, P.owner, mid, payee_mode=1)
    act(vm, P.owner)
    c.add_payee(mid, hx(P.payee))
    at(vm, 90)
    rid = ask(c, vm, P.agent, mid, P.payee)
    review(c, vm, P.owner, rid, offset=100)
    act(vm, P.owner)
    c.remove_payee(mid, hx(P.payee))
    at(vm, 500)
    refuse(c, vm, "no longer listed", c.execute, rid, who=P.stranger)


# ---- pause ----------------------------------------------------------------------------------------------------------


def test_owner_pauses_and_resumes_guardian_only_pauses(c, vm):
    mid = create(c, vm, P.owner, guardian=hx(P.guardian))
    act(vm, P.guardian)
    c.set_paused(mid, True)
    assert mrow(c, mid)["paused"] is True
    refuse(c, vm, "Only the owner can resume", c.set_paused, mid, False, who=P.guardian)
    refuse(c, vm, "Only the owner can resume", c.set_paused, mid, False, who=P.stranger)
    refuse(c, vm, "Only the owner can resume", c.set_paused, mid, True, who=P.stranger)
    act(vm, P.owner)
    c.set_paused(mid, False)
    assert mrow(c, mid)["paused"] is False


def test_a_paused_mandate_accepts_and_pays_nothing_but_can_still_be_wound_down(c, vm, ledger):
    mid, rid = approved(c, vm, P.owner, P.agent, P.payee)
    other = ask(c, vm, P.agent, mid, P.payee2, url=EVIDENCE_2)
    act(vm, P.owner)
    c.set_paused(mid, True)
    refuse(c, vm, "is paused", c.request_payment, mid, hx(P.payee), 20 * MILLI, PURPOSE, "", who=P.agent)
    at(vm, 1000)
    refuse(c, vm, "is paused", c.execute, rid, who=P.stranger)
    world(vm)
    refuse(c, vm, "is paused", c.review, other, who=P.stranger)
    act(vm, P.agent)
    c.cancel_request(other)
    act(vm, P.owner)
    c.veto(rid, "stop")
    c.withdraw(mid, int(mrow(c, mid)["free"]))
    assert rrow(c, rid)["state"] == VETOED and rrow(c, other)["state"] == CANCELLED
    assert ledger.to(P.payee) == 0 and books(c)["balanced"]


def test_a_paused_mandate_cannot_approve_an_escalation(c, vm):
    mid = setup(c, vm, P.owner, P.agent)
    rid = ask(c, vm, P.agent, mid, P.payee)
    review(c, vm, P.owner, rid, "ESCALATE", 50)
    act(vm, P.owner)
    c.set_paused(mid, True)
    refuse(c, vm, "is paused", c.decide, rid, True, "ok", who=P.owner)
    act(vm, P.owner)
    c.decide(rid, False, "no")
    assert rrow(c, rid)["state"] == REJECTED


# ---- expiry ---------------------------------------------------------------------------------------------------------


def test_an_expired_mandate_takes_nothing_new_and_pays_nothing(c, vm):
    mid = setup(c, vm, P.owner, P.agent)
    at(vm, 10)
    rules(c, vm, P.owner, mid, expires_in=1000)
    at(vm, 20)
    rid = ask(c, vm, P.agent, mid, P.payee)
    review(c, vm, P.owner, rid, offset=30)
    at(vm, 1010)
    assert mrow(c, mid)["ended"] is True
    refuse(c, vm, "has expired", c.request_payment, mid, hx(P.payee), 20 * MILLI, PURPOSE, "", who=P.agent)
    refuse(c, vm, "has expired", c.execute, rid, who=P.stranger)
    act(vm, P.stranger)
    c.expire_request(rid)
    assert rrow(c, rid)["state"] == EXPIRED and mrow(c, mid)["reserved"] == "0"
    act(vm, P.owner)
    c.withdraw(mid, GEN)
    assert books(c)["balanced"]


def test_the_owner_can_extend_an_expiry_before_it_hits(c, vm):
    mid = create(c, vm, P.owner)
    rules(c, vm, P.owner, mid, expires_in=100)
    at(vm, 50)
    rules(c, vm, P.owner, mid, expires_in=10_000)
    at(vm, 500)
    assert mrow(c, mid)["ended"] is False


# ---- views ----------------------------------------------------------------------------------------------------------


def test_list_mandates_paginates_newest_first_and_clamps(c, vm):
    for _ in range(7):
        create(c, vm, P.owner, deposit=0)
    ids = lambda off, lim: [m["id"] for m in json.loads(c.list_mandates(off, lim))]
    assert ids(0, 3) == [6, 5, 4]
    assert ids(3, 3) == [3, 2, 1]
    assert ids(6, 3) == [0]
    assert ids(7, 3) == [] and ids(100, 3) == []
    assert ids(0, 0) == [] and ids(0, -4) == []
    assert ids(-5, 2) == [6, 5]
    assert len(ids(0, 10_000)) == 7


def test_list_mandates_never_returns_more_than_a_page(c, vm):
    for _ in range(55):
        create(c, vm, P.owner, deposit=0)
    assert len(json.loads(c.list_mandates(0, 10_000))) == 50


def test_unknown_ids_are_refused_by_every_view(c, vm):
    create(c, vm, P.owner)
    for call in (lambda: c.get_mandate(1), lambda: c.get_mandate(-1), lambda: c.get_request(0), lambda: c.get_request(-1), lambda: c.list_requests(3, 0, 5), lambda: c.allowance_of(2, hx(P.agent))):
        with vm.expect_revert("No such"):
            call()


def test_allowance_reports_what_a_seat_could_ask(c, vm):
    mid = setup(c, vm, P.owner, P.agent, budget=30 * MILLI * 10)
    row = json.loads(c.allowance_of(mid, hx(P.agent)))
    assert row["seat"] is True and row["usable"] is True and row["open_slots"] == 3
    assert row["max_request"] == str(100 * MILLI) and row["seat_left"] == str(300 * MILLI)
    assert row["unreserved"] == str(GEN) and row["window_left"] == str(GEN // 2)
    none = json.loads(c.allowance_of(mid, hx(P.stranger)))
    assert none["seat"] is False and none["max_request"] == "0" and none["open_slots"] == 0
    act(vm, P.owner)
    c.set_paused(mid, True)
    assert json.loads(c.allowance_of(mid, hx(P.agent)))["usable"] is False
    assert json.loads(c.allowance_of(mid, hx(P.agent)))["max_request"] == "0"
