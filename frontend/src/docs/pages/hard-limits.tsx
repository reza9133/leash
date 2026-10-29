import { H2, Lead, Note, DocTable, MethodLink } from "../kit";
import { LIMITS } from "../../lib/types";

export default function Page() {
  return (
    <>
      <Lead>These limits are enforced by code. The AI cannot move them, and none of them depends on how a request is worded.</Lead>

      <H2 id="table">The limits</H2>
      <DocTable>
        <thead>
          <tr><th>Limit</th><th>Set by</th><th>Checked</th></tr>
        </thead>
        <tbody>
          <tr><td>Per-payment cap (at least 0.001 GEN)</td><td><MethodLink name="create_mandate" />, <MethodLink name="set_limits" /></td><td>Filing, payment</td></tr>
          <tr><td>Seat budget: spent plus held never above it</td><td><MethodLink name="grant_delegate" /></td><td>Filing, review, decision</td></tr>
          <tr><td>Window cap over a rolling window (60 s to 30 days)</td><td><MethodLink name="create_mandate" />, <MethodLink name="set_limits" /></td><td>Payment</td></tr>
          <tr><td>At most {LIMITS.maxWindowEntries} payments inside one window</td><td>Contract</td><td>Payment</td></tr>
          <tr><td>Unreserved funds cover the amount</td><td>Balance</td><td>Filing, review, decision</td></tr>
          <tr><td>Payee list (allowlist mode)</td><td><MethodLink name="add_payee" />, <MethodLink name="set_rules" /></td><td>Filing, payment</td></tr>
          <tr><td>Evidence link required; one request per link</td><td><MethodLink name="set_rules" /></td><td>Filing</td></tr>
          <tr><td>At most {LIMITS.maxOpen} open requests per seat</td><td>Contract</td><td>Filing</td></tr>
          <tr><td>Paused or expired mandate accepts nothing</td><td><MethodLink name="set_paused" />, <MethodLink name="set_rules" /></td><td>Filing, review, payment</td></tr>
        </tbody>
      </DocTable>

      <H2 id="rolling">The rolling window</H2>
      <p>
        The window is not a calendar period. At any moment the contract adds up the payments made in the last <code>window_secs</code> seconds; a new payment may not push that sum
        above the window cap. Payments leave the sum as time passes. The window length is fixed when the mandate is created.
      </p>

      <H2 id="ranges">Ranges of the settings</H2>
      <DocTable>
        <thead><tr><th>Setting</th><th>Range</th></tr></thead>
        <tbody>
          <tr><td>Name</td><td>{LIMITS.minName} to {LIMITS.maxName} characters</td></tr>
          <tr><td>Policy</td><td>{LIMITS.minPolicy} to {LIMITS.maxPolicy} characters</td></tr>
          <tr><td>Purpose of a request</td><td>{LIMITS.minPurpose} to {LIMITS.maxPurpose} characters</td></tr>
          <tr><td>Review delay</td><td>{LIMITS.minDelay} to {LIMITS.maxDelay} seconds (7 days)</td></tr>
          <tr><td>Window length</td><td>{LIMITS.minWindow} to {LIMITS.maxWindow} seconds (30 days)</td></tr>
          <tr><td>Escalation window and grace time</td><td>{LIMITS.minSpan} to {LIMITS.maxSpan} seconds</td></tr>
          <tr><td>Expiry</td><td>0 (never) or {LIMITS.minExpiry} to {LIMITS.maxExpiry} seconds from now</td></tr>
          <tr><td>Risk limits</td><td>0 &lt;= auto &lt;= reject &lt;= 100; defaults {LIMITS.defaultAuto} and {LIMITS.defaultReject}</td></tr>
        </tbody>
      </DocTable>

      <Note title="Tightening later is safe">
        If you lower a cap, remove a payee or revoke a seat after a request was approved, the payment is checked again at the moment it is made and refused if it no longer fits.
      </Note>
    </>
  );
}
