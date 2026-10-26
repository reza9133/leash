"""The life of a payment request: filing, review, human decisions, payment and expiry."""

import json

import pytest

from conftest import *


@pytest.fixture
def c(direct_vm, direct_deploy):
    return deploy(direct_deploy, direct_vm)


@pytest.fixture
def vm(direct_vm):
    return direct_vm


@pytest.fixture
def m(c, vm):
    """A funded mandate with one seat for P.agent, a guardian, and the clock at 0."""
    mid = create(c, vm, P.owner, guardian=hx(P.guardian))
    grant(c, vm, P.owner, mid, P.agent, budget=GEN // 4)
    return mid


def file(c, vm, mid, **kw):
    kw.setdefault("payee", P.payee)
    kw.setdefault("agent", P.agent)
    return ask(c, vm, kw.pop("agent"), mid, kw.pop("payee"), **kw)


# ---- filing ---------------------------------------------------------------------------------------------------------


def test_a_request_is_stored_pending_with_its_deadline(c, vm, m):
    at(vm, 50)
    rid = file(c, vm, m)
    row = rrow(c, rid)
    assert rid == 0
    assert row["mandate"] == m and row["delegate"] == hx(P.agent) and row["payee"] == hx(P.payee)
    assert row["amount"] == str(20 * MILLI) and row["purpose"] == PURPOSE and row["url"] == EVIDENCE
    assert (row["state"], row["decided_by"], row["created"], row["ready_at"]) == (PENDING, BY_NONE, T0 + 50, 0)
    assert row["decide_by"] == T0 + 50 + 3 * 86400
    assert (row["review"], row["audit"], row["challenged"], row["bond_state"]) == (None, None, False, BOND_NONE)
    s = seat(c, m, P.agent)
    assert (s["open"], s["requested"], s["held"]) == (1, 1, "0")
    assert mrow(c, m)["reserved"] == "0"  # nothing is promised before an approval
    assert len(json.loads(c.list_requests(m, 0, 10))) == 1 and mrow(c, m)["requests"] == 1


def test_purpose_is_cleaned_and_the_link_trimmed(c, vm, m):
    act(vm, P.agent)
    rid = c.request_payment(m, hx(P.payee), 20 * MILLI, "  Hosting   for <the> studio, October  ", "  " + EVIDENCE + "  ")
    row = rrow(c, rid)
    assert row["purpose"] == "Hosting for (the) studio, October" and row["url"] == EVIDENCE


FILE_BAD = [
    ("stranger", dict(who=P.stranger), "active seat"),
    ("owner has no seat", dict(who=P.owner), "active seat"),
    ("guardian has no seat", dict(who=P.guardian), "active seat"),
    ("zero payee", dict(payee=ZERO_ADDRESS), "cannot be paid"),
    ("garbage payee", dict(payee="payee"), "not a valid address"),
    ("self payment", dict(payee="AGENT"), "cannot pay itself"),
    ("amount below minimum", dict(amount=MILLI - 1), "per-payment limit"),
    ("zero amount", dict(amount=0), "per-payment limit"),
    ("negative amount", dict(amount=-5), "per-payment limit"),
    ("amount above the cap", dict(amount=100 * MILLI + 1), "per-payment limit"),
    ("amount above the budget", dict(amount=100 * MILLI, budget=50 * MILLI), "remaining budget"),
    ("amount above free funds", dict(amount=100 * MILLI, deposit=50 * MILLI), "unreserved funds"),
    ("purpose too short", dict(purpose="too short"), "purpose needs"),
    ("purpose blank", dict(purpose="        "), "purpose needs"),
    ("purpose too long", dict(purpose="x" * 301), "purpose needs"),
    ("link is not public", dict(url="https://127.0.0.1/invoice"), "public http(s) link"),
    ("link has credentials", dict(url="https://user:pw@billing.example.org/i"), "public http(s) link"),
    ("link is not http", dict(url="ftp://billing.example.org/i"), "public http(s) link"),
    ("link too long", dict(url="https://billing.example.org/" + "a" * 300), "public http(s) link"),
    ("two links", dict(url="https://a.example.org/x https://b.example.org/y"), "public http(s) link"),
]


@pytest.mark.parametrize("label,kw,msg", FILE_BAD, ids=[x[0] for x in FILE_BAD])
def test_filing_refuses_bad_requests_and_changes_nothing(c, vm, label, kw, msg):
    mid = create(c, vm, P.owner, deposit=kw.get("deposit", GEN))
    grant(c, vm, P.owner, mid, P.agent, budget=kw.get("budget", GEN // 4))
    payee = P.agent if kw.get("payee") == "AGENT" else kw.get("payee", P.payee)
    payee = hx(payee) if isinstance(payee, (bytes, bytearray)) else payee
    refuse(
        c, vm, msg, c.request_payment, mid, payee, kw.get("amount", 20 * MILLI), kw.get("purpose", PURPOSE), kw.get("url", EVIDENCE),
        who=kw.get("who", P.agent),
    )


def test_evidence_can_be_made_mandatory(c, vm, m):
    rules(c, vm, P.owner, m, need_evidence=True)
    refuse(c, vm, "needs a link", c.request_payment, m, hx(P.payee), 20 * MILLI, PURPOSE, "", who=P.agent)
    refuse(c, vm, "needs a link", c.request_payment, m, hx(P.payee), 20 * MILLI, PURPOSE, "   ", who=P.agent)
    assert file(c, vm, m) == 0


def test_a_request_without_evidence_is_fine_when_not_required(c, vm, m):
    rid = file(c, vm, m, url="")
    assert rrow(c, rid)["url"] == ""


def test_open_requests_per_seat_are_limited_and_freed_on_close(c, vm, m):
    rids = [file(c, vm, m, url=f"https://billing.example.org/invoices/{i}") for i in range(3)]
    refuse(c, vm, "Too many open requests", c.request_payment, m, hx(P.payee), 20 * MILLI, PURPOSE, "", who=P.agent)
    act(vm, P.agent)
    c.cancel_request(rids[1])
    assert file(c, vm, m, url="") == 3
    assert seat(c, m, P.agent)["open"] == 3


def test_the_payee_may_be_the_owner_the_guardian_or_another_seat(c, vm, m):
    grant(c, vm, P.owner, m, P.agent2)
    for who in (P.owner, P.guardian, P.agent2):
        file(c, vm, m, payee=who, url="")
    assert stats(c)["requests"] == 3


# ---- evidence is single use -----------------------------------------------------------------------------------------


def test_the_same_evidence_cannot_back_two_live_requests(c, vm, m):
    file(c, vm, m)
    grant(c, vm, P.owner, m, P.agent2)
    for variant in (EVIDENCE, EVIDENCE + "/", EVIDENCE + "#top", EVIDENCE.replace("https", "http"), EVIDENCE.upper().replace("HTTPS", "https").replace("/INVOICES/", "/invoices/"), "https://www.billing.example.org/invoices/1001?utm_source=x"):
        refuse(c, vm, "already backs another request", c.request_payment, m, hx(P.payee2), 20 * MILLI, PURPOSE, variant, who=P.agent2)


def test_evidence_is_freed_when_a_request_is_closed_without_payment(c, vm, m):
    first = file(c, vm, m)
    act(vm, P.agent)
    c.cancel_request(first)
    assert file(c, vm, m) == 1
    review(c, vm, P.owner, 1, "REJECT", 90)
    assert rrow(c, 1)["state"] == REJECTED
    assert file(c, vm, m) == 2


def test_evidence_stays_used_after_a_payment(c, vm, m, ledger):
    mid, rid = approved(c, vm, P.owner, P.agent, P.payee, mid=m)
    execute(c, vm, P.stranger, rid, offset=100 + 300)
    assert rrow(c, rid)["state"] == EXECUTED
    refuse(c, vm, "already backs another request", c.request_payment, m, hx(P.payee), 20 * MILLI, PURPOSE, EVIDENCE, who=P.agent)


def test_evidence_is_per_mandate(c, vm, m):
    file(c, vm, m)
    other = create(c, vm, P.owner)
    grant(c, vm, P.owner, other, P.agent)
    assert file(c, vm, other) == 1


# ---- the review -----------------------------------------------------------------------------------------------------


def test_an_approval_reserves_the_money_and_sets_the_waiting_time(c, vm, m):
    rid = file(c, vm, m)
    review(c, vm, P.stranger, rid, "APPROVE", 10, offset=200)
    row = rrow(c, rid)
    assert (row["state"], row["decided_by"], row["ready_at"], row["risk"], row["policy_rev"]) == (APPROVED, BY_AI, T0 + 200 + 300, 10, 1)
    assert row["review"]["verdict"] == "APPROVE" and row["review"]["rev"] == 1 and len(row["review"]["hash"]) == 64
    assert mrow(c, m)["reserved"] == str(20 * MILLI) and mrow(c, m)["free"] == str(GEN - 20 * MILLI)
    s = seat(c, m, P.agent)
    assert (s["held"], s["left"]) == (str(20 * MILLI), str(GEN // 4 - 20 * MILLI))
    assert stats(c)["reviews"] == 1 and books(c)["balanced"]


def test_an_unsure_review_escalates_to_a_human(c, vm, m):
    at(vm, 10)
    rid = file(c, vm, m)
    review(c, vm, P.stranger, rid, "ESCALATE", 50, offset=100)
    row = rrow(c, rid)
    assert row["state"] == ESCALATED and row["decide_by"] == T0 + 100 + 3 * 86400
    assert mrow(c, m)["reserved"] == "0"


def test_a_negative_review_rejects_for_good(c, vm, m):
    rid = file(c, vm, m)
    review(c, vm, P.stranger, rid, "REJECT", 90, reason="Gambling is outside the policy.")
    row = rrow(c, rid)
    assert row["state"] == REJECTED and "Gambling" in row["note"]
    s = seat(c, m, P.agent)
    assert (s["open"], s["rejected"]) == (0, 1) and stats(c)["rejected"] == 1
    assert mrow(c, m)["reserved"] == "0" and books(c)["balanced"]


# (verdict, risk) -> state, with the default limits auto=35, reject=75
SETTLE = [
    ("APPROVE", 0, APPROVED), ("APPROVE", 35, APPROVED), ("APPROVE", 36, ESCALATED), ("APPROVE", 75, ESCALATED), ("APPROVE", 76, REJECTED),
    ("APPROVE", 100, REJECTED), ("ESCALATE", 0, ESCALATED), ("ESCALATE", 75, ESCALATED), ("ESCALATE", 76, REJECTED), ("REJECT", 0, REJECTED),
    ("REJECT", 100, REJECTED), ("approve", 10, APPROVED), (" Approve ", 10, APPROVED), ("MAYBE", 10, ESCALATED), ("", 0, ESCALATED),
    ("APPROVED", 0, ESCALATED), ("YES", 0, ESCALATED),
]


@pytest.mark.parametrize("verdict,risk,expected", SETTLE)
def test_the_model_can_only_make_approval_harder(c, vm, m, verdict, risk, expected):
    rid = file(c, vm, m)
    review(c, vm, P.stranger, rid, verdict, risk)
    assert rrow(c, rid)["state"] == expected


@pytest.mark.parametrize("auto,reject,verdict,risk,expected", [
    (0, 100, "APPROVE", 0, APPROVED), (0, 100, "APPROVE", 1, ESCALATED), (10, 20, "APPROVE", 10, APPROVED), (10, 20, "APPROVE", 21, REJECTED),
    (100, 100, "APPROVE", 100, APPROVED), (100, 100, "ESCALATE", 100, ESCALATED), (50, 50, "APPROVE", 51, REJECTED),
])
def test_the_owner_sets_the_risk_limits(c, vm, m, auto, reject, verdict, risk, expected):
    rules(c, vm, P.owner, m, auto_risk=auto, reject_risk=reject)
    rid = file(c, vm, m)
    review(c, vm, P.stranger, rid, verdict, risk)
    assert rrow(c, rid)["state"] == expected


@pytest.mark.parametrize("raw,expected", [
    ('{"verdict": "APPROVE", "risk": "12", "flags": [], "reason": "ok"}', APPROVED),
    ('{"verdict": "APPROVE", "risk": "12.5", "flags": [], "reason": "ok"}', ESCALATED),
    ('{"verdict": "APPROVE", "risk": "low", "flags": [], "reason": "ok"}', ESCALATED),
    ('{"verdict": "APPROVE", "risk": null, "flags": [], "reason": "ok"}', ESCALATED),
    ('{"verdict": "APPROVE", "risk": true, "flags": [], "reason": "ok"}', ESCALATED),
    ('{"verdict": "APPROVE", "flags": [], "reason": "ok"}', ESCALATED),
    ('{"verdict": "APPROVE", "risk": -50, "flags": [], "reason": "ok"}', APPROVED),
    ('{"verdict": "APPROVE", "risk": 100000, "flags": [], "reason": "ok"}', REJECTED),
    ('{"verdict": ["APPROVE"], "risk": 5}', ESCALATED),
    ('{"verdict": null, "risk": 5}', ESCALATED),
    ('{"risk": 5}', ESCALATED),
    ('```json\n{"verdict": "APPROVE", "risk": 5, "flags": [], "reason": "ok"}\n```', APPROVED),
    ('Sure! Here is my answer: {"verdict": "APPROVE", "risk": 5, "flags": [], "reason": "ok"} Hope it helps.', APPROVED),
])
def test_odd_model_output_never_lowers_the_bar(c, vm, m, raw, expected):
    rid = file(c, vm, m)
    world(vm)
    vm.clear_mocks()
    mock_page(vm)
    mock_reviewer(vm, raw=raw)
    act(vm, P.stranger)
    c.review(rid)
    assert rrow(c, rid)["state"] == expected


@pytest.mark.parametrize("raw", ["not json at all", "[]", "[1, 2, 3]", "42", "null", '"APPROVE"', "", "{"])
def test_a_model_failure_is_an_error_not_a_decision(c, vm, m, raw):
    rid = file(c, vm, m)
    vm.clear_mocks()
    mock_page(vm)
    mock_reviewer(vm, raw=raw)
    refuse(c, vm, "LLM_ERROR", c.review, rid, who=P.stranger)
    assert rrow(c, rid)["state"] == PENDING and rrow(c, rid)["tries"] == 0


def test_flags_are_filtered_to_the_vocabulary_and_text_is_cleaned(c, vm, m):
    rid = file(c, vm, m)
    review(
        c, vm, P.stranger, rid, "ESCALATE", 50, flags=["off_policy", "VAGUE", "made_up", 7, None, "off_policy"],
        reason="  <b>Looks</b> odd   and long " + "x" * 400,
    )
    r = rrow(c, rid)["review"]
    assert r["flags"] == ["off_policy", "vague"]
    assert "<" not in r["reason"] and len(r["reason"]) <= 160 and r["reason"].startswith("(b)Looks(/b) odd and long")


def test_a_non_list_flag_field_is_ignored(c, vm, m):
    rid = file(c, vm, m)
    vm.clear_mocks()
    mock_page(vm)
    mock_reviewer(vm, raw='{"verdict": "ESCALATE", "risk": 50, "flags": "off_policy", "reason": "x"}')
    act(vm, P.stranger)
    c.review(rid)
    assert rrow(c, rid)["review"]["flags"] == []


def test_a_review_without_evidence_does_not_fetch_anything(c, vm, m):
    rid = file(c, vm, m, url="")
    vm.clear_mocks()
    mock_reviewer(vm, "APPROVE", 10)  # no web mock at all
    act(vm, P.stranger)
    c.review(rid)
    row = rrow(c, rid)
    assert row["state"] == APPROVED and row["review"]["hash"] == ""


def test_review_refusals(c, vm, m):
    rid = file(c, vm, m)
    refuse(c, vm, "No such request", c.review, 99, who=P.stranger)
    review(c, vm, P.stranger, rid, "APPROVE", 10)
    world(vm)
    refuse(c, vm, "not waiting for a review", c.review, rid, who=P.stranger)


def test_a_review_needs_the_money_to_still_be_free(c, vm):
    mid = create(c, vm, P.owner, deposit=30 * MILLI)
    grant(c, vm, P.owner, mid, P.agent)
    a = file(c, vm, mid, amount=20 * MILLI, url="")
    b = file(c, vm, mid, amount=20 * MILLI, url="")
    review(c, vm, P.stranger, a, "APPROVE", 10)
    world(vm)
    refuse(c, vm, "unreserved funds", c.review, b, who=P.stranger)
    assert rrow(c, b)["state"] == PENDING
    act(vm, P.owner)
    c.veto(a, "freeing the money")
    review(c, vm, P.stranger, b, "APPROVE", 10)
    assert rrow(c, b)["state"] == APPROVED and books(c)["balanced"]


def test_a_review_needs_the_seat_budget(c, vm):
    mid = create(c, vm, P.owner)
    grant(c, vm, P.owner, mid, P.agent, budget=30 * MILLI)
    a = file(c, vm, mid, amount=20 * MILLI, url="")
    b = file(c, vm, mid, amount=20 * MILLI, url="")
    review(c, vm, P.stranger, a, "APPROVE", 10)
    world(vm)
    refuse(c, vm, "remaining budget", c.review, b, who=P.stranger)


def test_a_stale_pending_request_is_not_reviewed(c, vm, m):
    rid = file(c, vm, m)
    at(vm, 3 * 86400)
    world(vm)
    refuse(c, vm, "stale", c.review, rid, who=P.stranger)
    act(vm, P.stranger)
    c.expire_request(rid)
    assert rrow(c, rid)["state"] == EXPIRED


# ---- unreadable evidence --------------------------------------------------------------------------------------------


def test_unreadable_evidence_is_retried_then_escalated(c, vm, m):
    rid = file(c, vm, m)
    review(c, vm, P.stranger, rid, "APPROVE", 10, offset=100, status=404)
    row = rrow(c, rid)
    assert (row["state"], row["tries"]) == (PENDING, 1) and "could not be read" in row["note"]
    world(vm, status=404)
    refuse(c, vm, "Wait two minutes", c.review, rid, who=P.stranger)
    review(c, vm, P.stranger, rid, "APPROVE", 10, offset=100 + 120, status=404)
    assert (rrow(c, rid)["state"], rrow(c, rid)["tries"]) == (PENDING, 2)
    review(c, vm, P.stranger, rid, "APPROVE", 10, offset=100 + 240, status=404)
    row = rrow(c, rid)
    assert row["state"] == ESCALATED and row["tries"] == 2 + 1 and row["review"]["flags"] == ["unreadable"]
    assert stats(c)["reviews"] == 3


def test_evidence_that_comes_back_is_used_on_a_later_try(c, vm, m):
    rid = file(c, vm, m)
    review(c, vm, P.stranger, rid, "APPROVE", 10, offset=100, status=503)
    review(c, vm, P.stranger, rid, "APPROVE", 10, offset=300)
    assert rrow(c, rid)["state"] == APPROVED


def test_a_tiny_page_counts_as_unreadable(c, vm, m):
    rid = file(c, vm, m)
    review(c, vm, P.stranger, rid, "APPROVE", 10, page="<html>ok</html>")
    assert rrow(c, rid)["state"] == PENDING and rrow(c, rid)["tries"] == 1


def test_a_pending_request_with_unreadable_evidence_can_be_cancelled(c, vm, m):
    rid = file(c, vm, m)
    review(c, vm, P.stranger, rid, "APPROVE", 10, status=404)
    act(vm, P.agent)
    c.cancel_request(rid)
    assert rrow(c, rid)["state"] == CANCELLED


# ---- the human decision ---------------------------------------------------------------------------------------------


def escalated(c, vm, m, **kw):
    rid = file(c, vm, m, **kw)
    review(c, vm, P.stranger, rid, "ESCALATE", 50, offset=100)
    return rid


@pytest.mark.parametrize("who,by", [(P.owner, BY_OWNER), (P.guardian, BY_GUARDIAN)])
def test_a_human_approval_is_payable_at_once(c, vm, m, who, by, ledger):
    rid = escalated(c, vm, m)
    act(vm, who)
    at(vm, 150)
    c.decide(rid, True, "  Checked the invoice.  ")
    row = rrow(c, rid)
    assert (row["state"], row["decided_by"], row["ready_at"], row["note"]) == (APPROVED, by, T0 + 150, "Checked the invoice.")
    execute(c, vm, P.stranger, rid)
    assert rrow(c, rid)["state"] == EXECUTED and ledger.to(P.payee) == 20 * MILLI and books(c)["balanced"]


@pytest.mark.parametrize("who", [P.owner, P.guardian])
def test_a_human_rejection_closes_the_request(c, vm, m, who):
    rid = escalated(c, vm, m)
    act(vm, who)
    c.decide(rid, False, "")
    row = rrow(c, rid)
    assert row["state"] == REJECTED and row["note"] == "Rejected by a human."
    assert seat(c, m, P.agent)["rejected"] == 1 and seat(c, m, P.agent)["open"] == 0


def test_only_the_owner_or_guardian_decide_and_only_escalations(c, vm, m):
    rid = escalated(c, vm, m)
    for who in (P.agent, P.stranger, P.watcher):
        refuse(c, vm, "Only the owner or the guardian", c.decide, rid, True, "", who=who)
    pending = file(c, vm, m, url="")
    refuse(c, vm, "not waiting for a decision", c.decide, pending, True, "", who=P.owner)
    refuse(c, vm, "No such request", c.decide, 77, True, "", who=P.owner)
    act(vm, P.owner)
    c.decide(rid, True, "")
    refuse(c, vm, "not waiting for a decision", c.decide, rid, True, "", who=P.owner)


def test_a_late_decision_is_refused(c, vm, m):
    rid = escalated(c, vm, m)
    at(vm, 100 + 3 * 86400)
    refuse(c, vm, "stale", c.decide, rid, True, "", who=P.owner)
    refuse(c, vm, "stale", c.decide, rid, False, "", who=P.owner)
    act(vm, P.stranger)
    c.expire_request(rid)
    assert rrow(c, rid)["state"] == EXPIRED


def test_a_human_approval_rechecks_funds_and_budget(c, vm):
    mid = create(c, vm, P.owner, deposit=30 * MILLI)
    grant(c, vm, P.owner, mid, P.agent)
    a = file(c, vm, mid, amount=20 * MILLI, url="")
    b = file(c, vm, mid, amount=20 * MILLI, url="")
    review(c, vm, P.stranger, a, "ESCALATE", 50)
    review(c, vm, P.stranger, b, "ESCALATE", 50)
    act(vm, P.owner)
    c.decide(a, True, "")
    refuse(c, vm, "unreserved funds", c.decide, b, True, "", who=P.owner)
    act(vm, P.owner)
    c.decide(b, False, "")
    assert books(c)["balanced"]


def test_a_decision_note_is_cut_to_size(c, vm, m):
    rid = escalated(c, vm, m)
    act(vm, P.owner)
    c.decide(rid, False, "<i>" + "n" * 500)
    assert len(rrow(c, rid)["note"]) <= 200 and "<" not in rrow(c, rid)["note"]


# ---- veto -----------------------------------------------------------------------------------------------------------


@pytest.mark.parametrize("who", [P.owner, P.guardian])
def test_veto_stops_an_approval_and_gives_the_money_back(c, vm, m, who):
    mid, rid = approved(c, vm, P.owner, P.agent, P.payee, mid=m)
    act(vm, who)
    c.veto(rid, "Changed my mind")
    row = rrow(c, rid)
    assert (row["state"], row["note"]) == (VETOED, "Changed my mind")
    s = seat(c, m, P.agent)
    assert (s["held"], s["left"], s["open"], s["vetoed"]) == ("0", str(GEN // 4), 0, 1)
    assert mrow(c, m)["reserved"] == "0" and stats(c)["vetoed"] == 1 and books(c)["balanced"]


def test_veto_refusals(c, vm, m):
    mid, rid = approved(c, vm, P.owner, P.agent, P.payee, mid=m)
    for who in (P.agent, P.stranger, P.watcher):
        refuse(c, vm, "Only the owner or the guardian", c.veto, rid, "", who=who)
    pending = file(c, vm, m, url="")
    refuse(c, vm, "no approval to veto", c.veto, pending, "", who=P.owner)
    refuse(c, vm, "No such request", c.veto, 50, "", who=P.owner)
    act(vm, P.owner)
    c.veto(rid, "")
    refuse(c, vm, "no approval to veto", c.veto, rid, "", who=P.owner)


def test_veto_frees_the_evidence_and_the_budget(c, vm, m):
    mid, rid = approved(c, vm, P.owner, P.agent, P.payee, mid=m)
    act(vm, P.owner)
    c.veto(rid, "")
    assert file(c, vm, m) == 1


# ---- cancel ---------------------------------------------------------------------------------------------------------


@pytest.mark.parametrize("stage", ["pending", "escalated", "approved"])
def test_the_delegate_withdraws_a_request_at_any_open_stage(c, vm, m, stage):
    rid = file(c, vm, m)
    if stage == "escalated":
        review(c, vm, P.stranger, rid, "ESCALATE", 50)
    if stage == "approved":
        review(c, vm, P.stranger, rid, "APPROVE", 10)
    act(vm, P.agent)
    c.cancel_request(rid)
    row = rrow(c, rid)
    assert row["state"] == CANCELLED and seat(c, m, P.agent)["open"] == 0
    assert mrow(c, m)["reserved"] == "0" and seat(c, m, P.agent)["held"] == "0" and books(c)["balanced"]


def test_cancel_refusals(c, vm, m):
    rid = file(c, vm, m)
    for who in (P.owner, P.guardian, P.stranger, P.agent2):
        refuse(c, vm, "Only the delegate", c.cancel_request, rid, who=who)
    refuse(c, vm, "No such request", c.cancel_request, 10, who=P.agent)
    act(vm, P.agent)
    c.cancel_request(rid)
    refuse(c, vm, "can no longer be cancelled", c.cancel_request, rid, who=P.agent)


def test_a_revoked_agent_can_still_withdraw_its_request(c, vm, m):
    mid, rid = approved(c, vm, P.owner, P.agent, P.payee, mid=m)
    act(vm, P.owner)
    c.revoke_delegate(m, hx(P.agent))
    act(vm, P.agent)
    c.cancel_request(rid)
    assert rrow(c, rid)["state"] == CANCELLED and mrow(c, m)["reserved"] == "0"


# ---- execute --------------------------------------------------------------------------------------------------------


def test_execute_waits_for_the_waiting_time_and_pays_once(c, vm, m, ledger):
    mid, rid = approved(c, vm, P.owner, P.agent, P.payee, mid=m)  # approved at 100, ready at 400
    for t in (100, 399):
        at(vm, t)
        refuse(c, vm, "still in its waiting time", c.execute, rid, who=P.stranger)
    execute(c, vm, P.stranger, rid, offset=400)
    row = rrow(c, rid)
    assert (row["state"], row["executed_at"], row["closed_at"]) == (EXECUTED, T0 + 400, T0 + 400)
    assert ledger.count() == 1 and ledger.to(P.payee) == 20 * MILLI
    refuse(c, vm, "not approved", c.execute, rid, who=P.stranger)
    assert ledger.count() == 1
    row = mrow(c, m)
    assert (row["balance"], row["reserved"], row["paid"]) == (str(GEN - 20 * MILLI), "0", str(20 * MILLI))
    s = seat(c, m, P.agent)
    assert (s["spent"], s["held"], s["executed"], s["open"]) == (str(20 * MILLI), "0", 1, 0)
    assert stats(c)["executed"] == 1 and stats(c)["volume"] == str(20 * MILLI) and books(c)["balanced"]


def test_the_last_second_of_the_grace_time_still_pays(c, vm, m, ledger):
    mid, rid = approved(c, vm, P.owner, P.agent, P.payee, mid=m)
    execute(c, vm, P.stranger, rid, offset=400 + 3 * 86400 - 1)
    assert rrow(c, rid)["state"] == EXECUTED and ledger.to(P.payee) == 20 * MILLI


def test_a_late_approval_cannot_be_paid_only_expired(c, vm, m, ledger):
    mid, rid = approved(c, vm, P.owner, P.agent, P.payee, mid=m)
    at(vm, 400 + 3 * 86400)
    refuse(c, vm, "no longer payable", c.execute, rid, who=P.stranger)
    act(vm, P.stranger)
    c.expire_request(rid)
    assert rrow(c, rid)["state"] == EXPIRED and ledger.count() == 0
    assert mrow(c, m)["reserved"] == "0" and books(c)["balanced"]


def test_a_tightened_limit_applies_to_an_old_approval(c, vm, m, ledger):
    mid, rid = approved(c, vm, P.owner, P.agent, P.payee, mid=m)
    act(vm, P.owner)
    c.set_limits(m, 10 * MILLI, GEN // 2, 300)
    at(vm, 500)
    refuse(c, vm, "above the current per-payment limit", c.execute, rid, who=P.stranger)
    act(vm, P.owner)
    c.set_limits(m, 100 * MILLI, GEN // 2, 300)
    execute(c, vm, P.stranger, rid)
    assert rrow(c, rid)["state"] == EXECUTED


def test_a_revoked_seat_cannot_be_paid_and_the_request_can_be_expired_by_anyone(c, vm, m, ledger):
    mid, rid = approved(c, vm, P.owner, P.agent, P.payee, mid=m)
    act(vm, P.guardian)
    c.revoke_delegate(m, hx(P.agent))
    at(vm, 500)
    refuse(c, vm, "seat has been revoked", c.execute, rid, who=P.stranger)
    act(vm, P.watcher)
    c.expire_request(rid)
    assert rrow(c, rid)["state"] == EXPIRED and ledger.count() == 0 and mrow(c, m)["reserved"] == "0"


def test_a_vetoed_or_cancelled_request_cannot_be_paid(c, vm, m, ledger):
    mid, rid = approved(c, vm, P.owner, P.agent, P.payee, mid=m)
    act(vm, P.owner)
    c.veto(rid, "")
    at(vm, 500)
    refuse(c, vm, "not approved", c.execute, rid, who=P.stranger)
    refuse(c, vm, "No such request", c.execute, 9, who=P.stranger)
    assert ledger.count() == 0


def test_a_pending_or_escalated_request_cannot_be_paid(c, vm, m):
    pending = file(c, vm, m, url="")
    esc = escalated(c, vm, m)
    for rid in (pending, esc):
        refuse(c, vm, "not approved", c.execute, rid, who=P.stranger)


def test_anyone_may_trigger_the_payment_and_the_payee_gets_the_money(c, vm, m, ledger):
    mid, rid = approved(c, vm, P.owner, P.agent, P.payee, mid=m)
    execute(c, vm, P.watcher, rid, offset=1000)
    assert ledger.sent == [(hx(P.payee), 20 * MILLI)]


# ---- expire ---------------------------------------------------------------------------------------------------------


def test_expire_refuses_live_and_closed_requests(c, vm, m):
    rid = file(c, vm, m)
    refuse(c, vm, "Nothing has expired", c.expire_request, rid, who=P.stranger)
    refuse(c, vm, "No such request", c.expire_request, 5, who=P.stranger)
    act(vm, P.agent)
    c.cancel_request(rid)
    refuse(c, vm, "already closed", c.expire_request, rid, who=P.stranger)


def test_expire_closes_each_open_state_when_its_time_is_over(c, vm, m):
    pending = file(c, vm, m, url="")
    esc = escalated(c, vm, m)
    appr = file(c, vm, m, url="https://billing.example.org/invoices/77")
    review(c, vm, P.stranger, appr, "APPROVE", 10, offset=100)
    at(vm, 3 * 86400 - 1)
    for rid in (pending, esc, appr):
        refuse(c, vm, "Nothing has expired", c.expire_request, rid, who=P.stranger)
    at(vm, 400 + 3 * 86400)
    for rid in (pending, esc, appr):
        act(vm, P.stranger)
        c.expire_request(rid)
        assert rrow(c, rid)["state"] == EXPIRED
    assert seat(c, m, P.agent)["open"] == 0 and mrow(c, m)["reserved"] == "0" and books(c)["balanced"]


def test_expire_frees_the_evidence_again(c, vm, m):
    rid = file(c, vm, m)
    at(vm, 3 * 86400)
    act(vm, P.stranger)
    c.expire_request(rid)
    assert file(c, vm, m) == 1


# ---- listing --------------------------------------------------------------------------------------------------------


def test_list_requests_is_per_mandate_newest_first_and_paged(c, vm, m):
    other = create(c, vm, P.owner)
    grant(c, vm, P.owner, other, P.agent)
    ids = [file(c, vm, m, url="") for _ in range(3)]
    act(vm, P.agent)
    c.cancel_request(ids[0])
    c.cancel_request(ids[1])
    ids += [file(c, vm, m, url="") for _ in range(2)]
    stray = file(c, vm, other, url="")
    got = lambda off, lim: [r["id"] for r in json.loads(c.list_requests(m, off, lim))]
    assert got(0, 10) == [4, 3, 2, 1, 0]
    assert got(1, 2) == [3, 2] and got(4, 5) == [0] and got(9, 5) == [] and got(0, 0) == []
    assert [r["id"] for r in json.loads(c.list_requests(other, 0, 10))] == [stray]
    assert json.loads(c.list_requests(create(c, vm, P.owner), 0, 10)) == []
