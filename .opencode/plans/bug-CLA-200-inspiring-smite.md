# Bug — CLA-200 Inspiring Smite: no once-per-Divine-Smite latch (Channel Divinity double-dip)

**ID:** CLA-200
**Feature:** Inspiring Smite (Oath of Glory lv3, 2024) — `post_cast_inspiring_smite`
**Host:** ElderPaladin lv20, Oath of Glory, 2024, test-campaign
**Verdict:** FAIL (latch unimplemented → wrong economy)
**Date:** 2026-10-06

## Expected Behavior (RAW / manifest)
"Immediately after you cast Divine Smite, you can expend **one use** of your Channel Divinity and distribute Temporary Hit Points to creatures of your choice within 30 feet of yourself, which can include you. The total number of Temporary Hit Points equals **2d8 plus your Paladin level**, divided among the chosen creatures however you like."

⇒ Exactly **one** Channel Divinity use and **one** THP pool per **Divine Smite cast**.

## Core that PASSES (exact, live-verified)
- Distributor opens via gated sheet row (`Inspiring Smite:` clickable, row click gated by `lastAttack.attackName==='divine smite'`).
- Rolled total label **"Rolled 2d8 + 20: 28 total temp HP"** — 2d8 rolled = 8, 8 + paladin level 20 = **28 exact**.
- Target list = allies + self (FeyRanger, War_Cleric, ElderPaladin); enemy **Bandit 1 correctly excluded** (allies-only lane).
- Allocation **FR12 / WC8 / EP8 = 28** exact; each recipient received its numeric THP in change-data (`tempHp` 8 / 12 / 8).
- Channel Divinity decremented **exactly 1 at CONFIRM** (3→2); **pre-confirm CD=3** (not spent early).
- `ability_use` log exact: "ElderPaladin used Inspiring Smite (28 temp HP). Distribution: FeyRanger=12, War_Cleric=8, ElderPaladin=8".
- Skip / Cancel = **zero delta** (CD stayed 2, THP unchanged).

## The Bug — no latch keyed to the specific Divine Smite cast
`inspiringSmiteHandler.handle` gate (lines 69-99) checks only:
1. `resolveChannelDivinityCharges(...) <= 0` → refuse
2. `lastAttack?.attackName?.toLowerCase() === 'divine smite'` **and** `lastAttack?.attackerName === playerName`

`useCharActionsModalHandlers.handleInspiringSmiteConfirm` (line 333) sets per-target `tempHp` and `channelDivinityCharges - 1` but sets **no once-per-cast latch flag**, and `classes.json` Inspiring Smite carries no `uses` / latch token. Because `lastAttack.attackName` persists as "Divine Smite" until overwritten by another attack, the passive `Inspiring Smite:` row can be clicked **repeatedly** while `lastAttack` still reads Divine Smite, each click re-running `handle()` → **fresh 2d8+level roll** → a distributor spendable for **another** Channel Divinity.

### Live evidence (single Divine Smite cast, three distributor opens, no re-cast in between)
| Trigger | Distributor total | Notes |
|---|---|---|
| cast Divine Smite → row click | **2d8+20 = 28** | confirmed: FR12/WC8/EP8, CD 3→2 |
| re-click (no new Smite) | **2d8+20 = 29** | opened again, spendable |
| re-click (no new Smite) | **2d8+20 = 33** | opened again, spendable |

A player can therefore burn **multiple Channel Divinity charges and gain multiple THP pools from a single Divine Smite cast**, contradicting "expend **one use** ... immediately after you cast Divine Smite".

## Root cause / suggested fix
Add a per-cast latch stamped at confirm and checked at open, e.g. write `setRuntimeValue(playerName,'inspiringSmiteCastKey', <lastAttack ref/id>)` on confirm and refuse re-open when `lastAttack` already answered (mirror the `_cunningStrikeCostUsed` / `unerringStrikeUsed` latch pattern used by CLA-068 / Living Legend). Alternative: gate on a monotonic `lastAttack` token (timestamp/id) not yet consumed.

## Related (not the decisive bug)
- Distributor does **not auto-open as a modal** immediately after Divine Smite "Done"; it requires clicking the gated sheet row. Manifest Step 3 wording ("row auto-surfaces ... click it") permits this row-click lane, so not counted as the failure cause.
- `InspiringSmiteModal` clamps each allocation input individually to `[0, tempHp]` but `handleInspiringSmiteConfirm` has **no sum ≤ pool check**, so total distributed could exceed the pool; live run allocated exactly 28 so this was not exercised (latent).

## Repro
1. test-campaign, ElderPaladin (Oath of Glory lv20) active; Manage Allies = {FeyRanger, War_Cleric}; arm target Bandit 1.
2. Cast Divine Smite → Done (radiant applied).
3. Click `Inspiring Smite:` → distributor (28) → allocate → Inspire (CD 3→2).
4. Without casting Divine Smite again, click `Inspiring Smite:` again → **opens again (29)** → skip.
5. Click again → **opens again (33)**. Each click could spend another Channel Divinity.
