"""The hard limits: rolling window, seat budgets, reservations, and what the AI can never change."""

import json

import pytest

from conftest import *


@pytest.fixture
def c(direct_vm, direct_deploy):
    return deploy(direct_deploy, direct_vm)


@pytest.fixture
def vm(direct_vm):
    return direct_vm


def pay(c, vm, mid, rid_amount, at_time, agent=P.agent, payee=P.payee, url=""):
    """File, approve and pay one request; returns its id. The review delay of these mandates is 60 s."""
    at(vm, at_time)
    rid = ask(c, vm, agent, mid, payee, amount=rid_amount, url=url)
    review(c, vm, P.stranger, rid, "APPROVE", 10, offset=at_time)
    return rid


# ---- the rolling window ---------------------------------------------------------------------------------------------


@pytest.fixture
def tight(c, vm):
    """Per payment 30, per 1000 s window 60 (in MILLI), approvals payable after 60 s."""
    mid = create(c, vm, P.owner, per_payment=30 * MILLI, window_cap=60 * MILLI, window_secs=1000, review_delay=60)
    grant(c, vm, P.owner, mid, P.agent, budget=GEN)
    return mid


def test_payments_inside_one_window_may_not_exceed_its_cap(c, vm, tight, ledger):
    a = pay(c, vm, tight, 30 * MILLI, 100)
    b = pay(c, vm, tight, 30 * MILLI, 100)
    d = pay(c, vm, tight, 30 * MILLI, 100)
    execute(c, vm, P.stranger, a, offset=200)
    execute(c, vm, P.stranger, b, offset=200)
    refuse(c, vm, "rolling window limit", c.execute, d, who=P.stranger)
    assert rrow(c, d)["state"] == APPROVED and mrow(c, tight)["window_used"] == str(60 * MILLI)
    assert ledger.total() == 60 * MILLI and books(c)["balanced"]


def test_the_window_slides_exactly_when_the_oldest_payment_ages_out(c, vm, tight, ledger):
    a = pay(c, vm, tight, 30 * MILLI, 100)
    b = pay(c, vm, tight, 30 * MILLI, 100)
    d = pay(c, vm, tight, 30 * MILLI, 100)
    execute(c, vm, P.stranger, a, offset=200)  # leaves the window at 1200
    execute(c, vm, P.stranger, b, offset=500)  # leaves at 1500
    at(vm, 1199)
    refuse(c, vm, "rolling window limit", c.execute, d, who=P.stranger)
    execute(c, vm, P.stranger, d, offset=1200)
    assert rrow(c, d)["state"] == EXECUTED
    assert mrow(c, tight)["window_used"] == str(60 * MILLI)  # b and d
    at(vm, 1500)
    assert mrow(c, tight)["window_used"] == str(30 * MILLI)


def test_splitting_a_payment_into_pieces_gains_nothing(c, vm, ledger):
    mid = create(c, vm, P.owner, per_payment=30 * MILLI, window_cap=60 * MILLI, window_secs=1000, review_delay=60)
    grant(c, vm, P.owner, mid, P.agent, budget=GEN)
    first = [pay(c, vm, mid, 15 * MILLI, 100 + i) for i in range(3)]
    for rid in first:
        execute(c, vm, P.stranger, rid, offset=300)
    second = [pay(c, vm, mid, 15 * MILLI, 310 + i) for i in range(3)]
    execute(c, vm, P.stranger, second[0], offset=400)  # the fourth piece fills the window exactly
    for rid in second[1:]:
        refuse(c, vm, "rolling window limit", c.execute, rid, who=P.stranger)
    assert ledger.total() == 60 * MILLI and mrow(c, mid)["window_used"] == str(60 * MILLI)
    execute(c, vm, P.stranger, second[1], offset=1300)  # the first three pieces have left the window
    assert ledger.total() == 75 * MILLI


def test_the_window_holds_at_most_forty_eight_payments(c, vm, ledger):
    mid = create(c, vm, P.owner, deposit=GEN, per_payment=MILLI, window_cap=GEN, window_secs=30 * 86400, review_delay=60)
    grant(c, vm, P.owner, mid, P.agent, budget=GEN)
    t = 100
    for _ in range(48):
        rid = pay(c, vm, mid, MILLI, t)
        execute(c, vm, P.stranger, rid, offset=t + 60)
        t += 70
    assert mrow(c, mid)["window_entries"] == 48
    rid = pay(c, vm, mid, MILLI, t)
    at(vm, t + 60)
    refuse(c, vm, "Too many payments", c.execute, rid, who=P.stranger)
    allowance = json.loads(c.allowance_of(mid, hx(P.agent)))
    assert allowance["window_left"] == "0"
    assert ledger.total() == 48 * MILLI and books(c)["balanced"]


def test_a_lowered_window_limit_applies_to_old_approvals(c, vm, tight):
    a = pay(c, vm, tight, 30 * MILLI, 100)
    act(vm, P.owner)
    c.set_limits(tight, 30 * MILLI, 30 * MILLI, 60)
    b = pay(c, vm, tight, 30 * MILLI, 110)
    execute(c, vm, P.stranger, a, offset=200)
    refuse(c, vm, "rolling window limit", c.execute, b, who=P.stranger)


def test_the_window_length_is_fixed_after_creation(c, vm, tight):
    assert mrow(c, tight)["window_secs"] == 1000
    act(vm, P.owner)
    c.set_limits(tight, 30 * MILLI, 60 * MILLI, 60)
    assert mrow(c, tight)["window_secs"] == 1000


# ---- seat budgets ---------------------------------------------------------------------------------------------------


def test_a_seat_cannot_spend_more_than_its_budget_in_total(c, vm, ledger):
    mid = create(c, vm, P.owner, per_payment=30 * MILLI, window_cap=GEN, review_delay=60)
    grant(c, vm, P.owner, mid, P.agent, budget=50 * MILLI)
    a = pay(c, vm, mid, 30 * MILLI, 100)
    execute(c, vm, P.stranger, a, offset=200)
    assert seat(c, mid, P.agent)["left"] == str(20 * MILLI)
    at(vm, 210)
    refuse(c, vm, "remaining budget", c.request_payment, mid, hx(P.payee), 30 * MILLI, PURPOSE, "", who=P.agent)
    b = pay(c, vm, mid, 20 * MILLI, 220)
    execute(c, vm, P.stranger, b, offset=300)
    assert seat(c, mid, P.agent)["left"] == "0" and ledger.total() == 50 * MILLI
    refuse(c, vm, "remaining budget", c.request_payment, mid, hx(P.payee), MILLI, PURPOSE, "", who=P.agent)


def test_an_approval_holds_budget_until_the_request_ends(c, vm):
    mid = create(c, vm, P.owner, per_payment=30 * MILLI, window_cap=GEN, review_delay=60)
    grant(c, vm, P.owner, mid, P.agent, budget=40 * MILLI)
    a = pay(c, vm, mid, 30 * MILLI, 100)
    assert seat(c, mid, P.agent)["left"] == str(10 * MILLI)
    b = ask(c, vm, P.agent, mid, P.payee2, amount=10 * MILLI, url="")
    refuse(c, vm, "remaining budget", c.request_payment, mid, hx(P.payee), 11 * MILLI, PURPOSE, "", who=P.agent)
    act(vm, P.owner)
    c.veto(a, "")
    assert seat(c, mid, P.agent)["left"] == str(40 * MILLI)
    review(c, vm, P.stranger, b, "APPROVE", 10)
    assert rrow(c, b)["state"] == APPROVED


def test_seats_have_separate_budgets(c, vm, ledger):
    mid = create(c, vm, P.owner, per_payment=30 * MILLI, window_cap=GEN, review_delay=60)
    grant(c, vm, P.owner, mid, P.agent, budget=30 * MILLI)
    grant(c, vm, P.owner, mid, P.agent2, budget=30 * MILLI)
    a = pay(c, vm, mid, 30 * MILLI, 100, agent=P.agent)
    b = pay(c, vm, mid, 30 * MILLI, 100, agent=P.agent2, payee=P.payee2)
    execute(c, vm, P.stranger, a, offset=200)
    execute(c, vm, P.stranger, b, offset=200)
    assert ledger.to(P.payee) == 30 * MILLI and ledger.to(P.payee2) == 30 * MILLI
    assert seat(c, mid, P.agent)["left"] == "0" and seat(c, mid, P.agent2)["left"] == "0"


def test_a_shrunk_budget_stops_further_requests_but_keeps_what_was_spent(c, vm):
    mid = create(c, vm, P.owner, per_payment=30 * MILLI, window_cap=GEN, review_delay=60)
    grant(c, vm, P.owner, mid, P.agent, budget=100 * MILLI)
    a = pay(c, vm, mid, 30 * MILLI, 100)
    execute(c, vm, P.stranger, a, offset=200)
    grant(c, vm, P.owner, mid, P.agent, budget=20 * MILLI)
    s = seat(c, mid, P.agent)
    assert s["spent"] == str(30 * MILLI) and s["left"] == "0"
    refuse(c, vm, "remaining budget", c.request_payment, mid, hx(P.payee), MILLI, PURPOSE, "", who=P.agent)


# ---- reservations ---------------------------------------------------------------------------------------------------


def test_approvals_can_never_promise_more_than_the_mandate_holds(c, vm):
    mid = create(c, vm, P.owner, deposit=50 * MILLI, per_payment=30 * MILLI, window_cap=GEN, review_delay=60)
    grant(c, vm, P.owner, mid, P.agent, budget=GEN)
    a = ask(c, vm, P.agent, mid, P.payee, amount=30 * MILLI, url="")
    b = ask(c, vm, P.agent, mid, P.payee2, amount=30 * MILLI, url="")
    review(c, vm, P.stranger, a, "APPROVE", 10)
    world(vm)
    refuse(c, vm, "unreserved funds", c.review, b, who=P.stranger)
    # the free money is 20 now, so a bigger request is refused up front
    refuse(c, vm, "unreserved funds", c.request_payment, mid, hx(P.payee), 21 * MILLI, PURPOSE, "", who=P.agent)
    assert mrow(c, mid)["free"] == str(20 * MILLI)


def test_funding_makes_a_blocked_review_possible(c, vm):
    mid = create(c, vm, P.owner, deposit=30 * MILLI, per_payment=30 * MILLI, window_cap=GEN, review_delay=60)
    grant(c, vm, P.owner, mid, P.agent, budget=GEN)
    a = ask(c, vm, P.agent, mid, P.payee, amount=30 * MILLI, url="")
    b = ask(c, vm, P.agent, mid, P.payee2, amount=30 * MILLI, url="")
    review(c, vm, P.stranger, a, "APPROVE", 10)
    world(vm)
    refuse(c, vm, "unreserved funds", c.review, b, who=P.stranger)
    act(vm, P.watcher, 30 * MILLI)
    c.fund(mid)
    vm.value = 0
    review(c, vm, P.stranger, b, "APPROVE", 10)
    assert rrow(c, b)["state"] == APPROVED and mrow(c, mid)["reserved"] == str(60 * MILLI)


def test_the_balance_is_enough_for_every_approved_payment(c, vm, ledger):
    mid = create(c, vm, P.owner, deposit=90 * MILLI, per_payment=30 * MILLI, window_cap=GEN, review_delay=60)
    grant(c, vm, P.owner, mid, P.agent, budget=GEN)
    ids = [pay(c, vm, mid, 30 * MILLI, 100 + i, payee=who) for i, who in enumerate((P.payee, P.payee2, P.extra[0]))]
    for rid in ids:
        execute(c, vm, P.stranger, rid, offset=300)
    assert ledger.total() == 90 * MILLI and mrow(c, mid)["balance"] == "0" and books(c)["balanced"]


# ---- what the AI cannot change --------------------------------------------------------------------------------------


def test_a_fooled_model_cannot_lift_any_hard_limit(c, vm):
    """Even when the model approves everything with zero risk, the numbers decide."""
    mid = create(c, vm, P.owner, per_payment=30 * MILLI, window_cap=60 * MILLI, window_secs=1000, review_delay=60)
    grant(c, vm, P.owner, mid, P.agent, budget=50 * MILLI)
    world(vm, "APPROVE", 0)
    refuse(c, vm, "per-payment limit", c.request_payment, mid, hx(P.payee), 31 * MILLI, PURPOSE, "", who=P.agent)
    refuse(c, vm, "per-payment limit", c.request_payment, mid, hx(P.payee), 10**24, PURPOSE, "", who=P.agent)
    refuse(c, vm, "active seat", c.request_payment, mid, hx(P.payee), MILLI, PURPOSE, "", who=P.stranger)
    a = pay(c, vm, mid, 30 * MILLI, 100)
    b = pay(c, vm, mid, 20 * MILLI, 100)
    execute(c, vm, P.stranger, a, offset=200)
    execute(c, vm, P.stranger, b, offset=200)
    refuse(c, vm, "remaining budget", c.request_payment, mid, hx(P.payee), MILLI, PURPOSE, "", who=P.agent)


def test_the_model_cannot_pay_a_payee_off_the_list(c, vm):
    mid = create(c, vm, P.owner)
    grant(c, vm, P.owner, mid, P.agent)
    rules(c, vm, P.owner, mid, payee_mode=1)
    world(vm, "APPROVE", 0)
    refuse(c, vm, "not on the allowlist", c.request_payment, mid, hx(P.payee), 20 * MILLI, PURPOSE, "", who=P.agent)


def test_a_model_that_approves_nothing_pays_nothing(c, vm, ledger):
    mid = create(c, vm, P.owner)
    grant(c, vm, P.owner, mid, P.agent)
    for i in range(3):
        rid = ask(c, vm, P.agent, mid, P.payee, url="")
        review(c, vm, P.stranger, rid, "REJECT", 100)
        assert rrow(c, rid)["state"] == REJECTED
    assert ledger.count() == 0 and books(c)["balanced"]
