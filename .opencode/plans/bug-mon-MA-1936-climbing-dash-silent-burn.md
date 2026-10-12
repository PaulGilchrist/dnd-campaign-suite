# MA-1936 King Kong — Climbing Dash (Costs 2 Actions): legendary Expend chip silent-burns (FAIL(b)/DATA one-field advisory fix)

**Verdict:** FAIL(b)/DATA — silent-burn fingerprint (MA-0510/MA-0696) confirmed live. Cost-2 economy enforcement PASSES honestly (MA-1883 lane).

## Row
- monsterIndex `king-kong`, category `legendary_actions`, actionIndex 3, stableKey `king-kong|legendary_actions|3`
- Disk (public/data/monsters.json, verified 2026-10-11): `{name:"Climbing Dash (Costs 2 Actions)", delegates_to:null, description:"Kong moves up to his Speed without provoking Opportunity Attacks, climbing or swinging, and can make one Slam attack at any point along the path."}` — keys exactly `delegates_to/description/name`; **NO `advisory`, NO `advisory_message`**, no attack_bonus/save_dc/dice. That absent `advisory` field IS the defect.

## Live proof (test-campaign, EB King Kong ×1 + Bandit 1 @999, cs-unstick per boundary MA-1852; 2026-10-11)
- **Legal-boundary press** (`lastAppliedTurnStartCreature=1:Bandit 1` after cs mirror unstick — first live press had read honest `(own-turn)` refusal from frozen cs mirror §113): spent exactly **2** — change-data `King Kong 1.monsterLegendaryUses {max:3, used:2}`, counter `"Legendary Action Uses: 3 (1 left)"`, ONE log entry `ability_use` counter-line copy: "King Kong 1 spends 2 legendary uses for Climbing Dash (Costs 2 Actions) after Bandit 1's turn — 1 of 3 left (regain at the start of King Kong 1's turn; 4 in lair advisory)." (MA-1926 lair-suffix boilerplate). **NO popup rendered** (popup-overlay audit empty post-press) and **console.error**: `[MonsterCardModal] legendary action "Climbing Dash (Costs 2 Actions)" delegates_to "null" — no resolvable mechanic on "King Kong 1"` → MA-0696 silent-burn pure shape: burn recorded only as counter-spend; RAW movement / no-opportunity-attacks / optional mid-path Slam never adjudicated nor named GM-enforced.
- **Same-boundary re-press**: refusal popup + `legendary_use_refused (turn)` — zero spend (MA-1917 gate order turn→cost).
- **Cost-floor control** (fresh boundary `1:AasimarTest`, pressed FIRST at 1-left): refusal popup "costs 2 legendary uses but King Kong 1 has only 1 left…" + `legendary_use_refused (insufficient-cost: costs 2, 1 left)` — zero spend, counter held `{max:3, used:2}` — MA-1883/MA-1928 costs-2 enforcement LIVE on this prose child. FAIL(a) axis clean.
- Zero attack/save rolls fired; Bandit untouched (999). Console: 1 error total (the burn line above).

## Fix (DATA, one field — §253 movement-row template, MA-253/MA-0696 precedent)
Author a flat advisory on the row (MA-1863 codex: movement-gated riders advisory; MA-253 sanctioned fix for movement rows = flat `advisory:"<snake_key>"` + advisory_message → honest record-only popup + ability_use "GM-enforced" log):

```json
{
  "name": "Climbing Dash (Costs 2 Actions)",
  "delegates_to": null,
  "advisory": "climbing_dash",
  "advisory_message": "Kong moves up to his Speed without provoking Opportunity Attacks, climbing or swinging, and can make one Slam attack at any point along the path — GM-enforced movement; resolve any optional mid-path Slam as a separate Slam action (GM-enforced).",
  "description": "Kong moves up to his Speed without provoking Opportunity Attacks, climbing or swinging, and can make one Slam attack at any point along the path."
}
```

- Do **NOT** set `delegates_to:"Slam"` — that would force an un-optional full Slam attack resolution and misrepresent the movement row (MA-1847 axis); advisory rides BEFORE any delegate resolution (§225), so `delegates_to:null` stays byte-unchanged and the press becomes an honest record-only popup + "GM-enforced" ability_use log while the costs-2 gate keeps spending 2.
- Advisory child shape precedent twins: §225 "Nameless advisory child {advisory,advisory_message} = honest record-only spend"; MA-0658 Cloaked Flight GM-enforced advisory.

## Residuals (accepted §70 movement-subsystem floor — enumerate, do not build)
- No grid token move / movement-distance model (grid token move grep-zero §70) — "moves up to his Speed" is GM-adjudicated.
- Opportunity-Attack suppression has no consumer (no OA register app-wide) — advisory copy only.
- "climbing or swinging" / vertical movement: zero consumers §70.
- Optional mid-path Slam timing ("at any point along the path"): no auto-fire consumer (§402/§419 legacy); GM fires Slam row manually if taken.
- Costs-2 enforcement itself: NOT residual — MA-1883 lane live on this row (proof above).
