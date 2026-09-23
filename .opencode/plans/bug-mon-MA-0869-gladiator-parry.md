# BUG MA-0869 — Gladiator Parry (reactions[0]): prose-only row, zero automation, parry inert

## Overview
`MA-0869` / `gladiator` / reactions[0] `Parry` carries only `name`/`trigger`/`description` — no `automation` block. The app's parry machinery (`resolveMonsterParry`/`buildParryBuff` → `_parryAcBonus` → hitResolution) arms **exclusively** off authored `automation {effect:'parry', acBonus:N}` (§114). With no automation the row renders as dead prose: no chip, no gate, no AC bump, no logs. Verified live 2026-09-22 in test-campaign: a melee hit landing **inside** the would-be-parry window resolved at base AC with `parryAcBonus:0` and full damage through. FAIL(b) / DATA one-field fix (MA-0565 precedent; fixed twins MA-0643 drow elite warrior acBonus 3, MA-0702 erinyes acBonus 4).

## Expected
> The gladiator adds 3 to its AC against that attack, possibly causing it to miss.

Trigger: melee attack roll hit while holding a weapon (Gladiators hold weapons — trigger satisfied). With AC 16, an armed parry raises effective AC to **19** (acBonus 3) against the triggering attack; totals 16–18 convert to MISS; one reaction per round; consumed on use.

## Actual
- **Static:** `public/data/monsters.json` gladiator reactions[0] = `{name, trigger, description}` only. Machinery consumers confirmed arm-only-from-automation: `MonsterCardHelpers.js:1181` (`buildParryBuff` reads `action.automation.acBonus`), gated-reaction registry `:931` arms off `automation.effect`; `MonsterCardModal.jsx:567` effectKey; `useLoggedDiceRollAttack.js:476` `ctx._parryAcBonus = getParryAcBonus(...)`; `hitResolution.js:284` adds `context._parryAcBonus` to effective AC.
- **Chip absence (live, defender card open over pending-hit popup):** Parry row DOM = `<div class="mc-action"><strong>Parry.</strong> <span>The gladiator adds 3 to its AC against that attack, possibly causing it to miss.</span></div>` — links/buttons/chips in row: **0**; whole-card `.mc-dice-link` inventory: `+5 (15), +4, +2, +3, +0, +1, +2, Athletics +10, Performance +5, +7, 2d4 + 4, DC 15 Strength` — no "Parry" chip (§60/§114 fingerprint).
- **In-window hit zero-delta (live):** Bandit 1 (Scimitar +3) → Gladiator 1 (AC 16):
  - roll 1: d20 nat13 → total 16 ✓ hit — log `effectiveAc:16, parryAcBonus:0` (16 ∈ would-be-parry window [16,18]; AC 19 would have forced miss).
  - roll 2 (applied): d20 nat14 → total 17 ✓ hit — `lastAttack {d20:14,total:17,targetAc:16,effectiveAc:16,hit:true,damageApplied:true}`, damage 5 (1d6+1=4+1) applied unmitigated, HP 992→987 (`hp_change` exact).
  - Zero `parry_refused` / `parry_consumed` / any parry automation or ability_use log entries whole-log (filtered on automationType/abilityName, never substring — §187).

## Steps to Reproduce
1. test-campaign, admin-clear; EB Join **Bandit** +1 and **Gladiator** ×1 (exact td-text `Bandit`/`Gladiator`, native cb.click()).
2. Full-store `/combatSummary` POST maxHp/currentHp 999 on both; Initiative page.
3. Arm Bandit 1 own-card `[data-testid="target-select"]` → Gladiator 1; open Bandit card, click Scimitar "+3" chip until HIT pending Done (nat 13–15 = totals 16–18 in-window; got 16 and 17).
4. While popup pending: DOM-click `img.avatar-image[alt="Gladiator 1"]` (card switch preserves pending popup, §233) — Reactions section renders Parry as plain prose, **no chip** (`mc-dice-link` count in row = 0).
5. Real pointer-click Done → log/`lastAttack`: `parryAcBonus:0`, `effectiveAc:16`, `hit:true`, damage applied; no parry logs of any kind.

## Likely Location
**DATA — `public/data/monsters.json` gladiator reactions[0]:** add automation block per MA-0643/MA-0702 byte-shape (§239 camelCase convention):
```json
"automation": { "type": "reaction", "trigger": "melee_attack_against", "effect": "parry", "acBonus": 3 }
```
keep existing name/trigger/description; usage At Will + uses/maxUses 999 honest sentinel per §60 RAW-unlimited pattern (Bandit Captain MA-0341 authored template / MA-0643 twin). No code change — machinery live off automation (§114).

## Notes
- §114 precedent: machinery LIVE (producer `resolveMonsterParry`/`buildParryBuff` → `_parry_ac_bonus` activeBuffs channel → `getParryAcBonus` → `hitResolution.js:284`); prose Parry without automation = FAIL(b) DATA one-field fix (MA-0565 family).
- Parry channel mechanics for the fixed twin (§217/§235): chip "Parry (N left)"; press defender chip via `link.click()` in page.evaluate (pending Done `.popup-overlay` intercepts pointer); armed buff rides NEXT resolved attack, consumption at re-resolve; round latch keys cs `round`; same-round second press = `parry_refused` log-only zero-spend; refusal has no popup (§235d).
- Ops pitfalls this session: DOM `done.click()` on stage-1 hit popup ABANDONED damage silently (no hp_change, popup vanished — re-confirmed §140 inverse); real pointer click on `button.dice-roll-reroll-btn` applied cleanly (2/2). `lastAttack` GET wraps `{lastAttack:{...}}`; `roll.total` in log = raw d20 (§33), adjudicate total via lastAttack.
- Evidence session: Bandit 1 init 19, Gladiator 1 AC16 init 17, round 1; ledger HP 999→992→987.
