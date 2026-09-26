# MA-1309 — Pirate Admiral "Defensive Stance" (reaction) — FAIL(b) / DATA

- **Monster**: Pirate Admiral (`public/data/monsters.json`, index `pirate-admiral`, row :47753)
- **Category**: reactions[0] — Defensive Stance
- **Trigger (authored)**: "The pirate is hit by a melee attack roll while holding a weapon"
- **Description (authored)**: "The pirate adds 4 to its AC against melee attack rolls (including the triggering attack) until the start of its next turn, possibly causing the attacks to miss."
- **Verdict**: FAIL(b) — DATA, zero affordance (§60)
- **Date**: 2026-09-26, live test-campaign (header verified `test-campaign` at select + throughout)

## Disk fingerprint

Pirate Admiral `reactions[0]` keys = `name` / `trigger` / `description` ONLY.
No `automation`, no `advisory`, no `usage`, no `save_*`.
§60: monster reaction rows arm affordance solely off `automation.effect` → row inert.

## Static evidence (own greps, line-cited)

- `rg "defensive_stance|Defensive Stance" src/` → **2 hits, both PC-primal lane**: `src/services/combat/automation/automationInfoBuilder/primal.test.js:89` / `:94` — `primal_companion_command` pass-through `commandType: 'defensive_stance'` (PC beast-command feature). **Zero monster-side consumers; unrelated lane.**
- Gated-reaction registry `src/components/encounter/MonsterCardHelpers.js:981` (`const GATED_MONSTER_REACTIONS = {`, block ends :1141) — **13 keys**: feather_fall :982, counterspell :988, hellish_rebuke :996, parry :1007, shield :1026, jinx_negate :1039, split :1053, heal :1062, attack :1076, portent :1086, limited_foresight :1103, elemental_absorption :1123, redirect_attack :1140 — **NO `defensive_stance` entry**.
- Arm condition `getGatedMonsterReaction` (MonsterCardHelpers.js:1714-1717): reads `automation.effect` only → undefined ⇒ null. Renderer `GatedReactionSlot` (MonsterAction.jsx:165-168): `if (!def) return null` ⇒ zero chip. §190 chip lanes (attack_bonus/dice/save_dc/Spellcasting-markup/automation.effect/legendaryGate/zone/advisory) — row matches none.

## Live census (test-campaign, localhost:5173, Playwright, 2026-09-26)

1. Campaign header verified `test-campaign` immediately after select (body top line).
2. EB search → exact-td native `cb.click()` **Bandit** (checked=true) + **Pirate Admiral** (checked=true) → Selected Monsters (2) → explicit "Join Encounter" → board avatars exactly `["Bandit 1","Pirate Admiral 1"]`.
3. `img.avatar-image[alt="Pirate Admiral 1"].click()` → `.mc-overlay` "Pirate Admiral 1".
4. **Defensive Stance row DOM**: `<div class="mc-action "><strong>Defensive Stance.</strong> <span>The pirate adds 4 to its AC against melee attack rolls (including the triggering attack) until the start of its next turn, possibly causing the attacks to miss.</span></div>` — diceLinks **0**, buttons **0**, anchors **0**, inputs **0**, roleButtons **0**. **Trigger prose NOT rendered** (name+description only — MA-1285 cosmetic twin note re-confirmed).
5. **Center-click probe ×2** (real pointer, row center 1015,728): popups **0**, log delta **0** (held at 3 = encounter + 2× initiative join noise), `defensive`/`stance`/`acBonus` log entries **0**, card stays open, app console **0 errors** (sole recorded 404 = tester's own wrong-endpoint probe `/api/log/...`, not app traffic).
6. RAW passes un-modified structurally: no producer, no consumer, no gate — nothing can fire; the +4 AC leg is GM-imagined only.

## Family / precedents

- **MA-1285** (Performer Uncanny Dodge, FAIL(b)/DATA, 2026-09-26): name/trigger/description-only reaction row, zero affordance, same §60 fingerprint.
- **MA-1290** (Performer Legend Warding Charm, FAIL(b)/DATA, 2026-09-26): same family + prose-DC caveat; both carry bug files.
- **MA-1236** (nimblewright prose Parry), **MA-0869** (gladiator prose Parry) — original §114 prose-row twins.

## Fix options

### Option A — interim advisory (zero-code, MA-1251/MA-1285-A/MA-1290-A precedent)
Add `advisory: "monster_defensive_stance"` to the row. Advisory seam is generic passthrough (`isMonsterActionAdvisoryRow = !!row.advisory`, value never inspected — MonsterAction.jsx AdvisoryLink :335-343, resolver MonsterCardModal.jsx:2385): record-only popup + ability_use log; GM enforces "+4 AC vs melee until your next turn, re-roll the trigger to see if it misses" manually.

### Option B — full fix: registry effect + SUSTAINED multi-hit AC buff (not one-shot)
Closest live channels: **parry** (Helpers :1007, mummy lord acBonus:2 fold §637) and **shield** (:1026) — BUT both are **one-shot** (armed → next resolved attack consumes). Defensive Stance is **sustained-until-next-turn against ALL melee attack rolls** (including the trigger):
1. **DATA**: `automation:{type:"reaction", trigger:"melee_hit", effect:"defensive_stance", acBonus:4}` + `usage:"At Will"` + `uses:999`/`maxUses:999` (§60 sentinel, camelCase MA-0643/0681 byte-shape).
2. **CODE**: `GATED_MONSTER_REACTIONS.defensive_stance` entry + gate/resolver arming a **persistent** `activeBuffs {effect:'defensive_stance', acBonus:4, meleeOnly:true}` — buff-channel (activeBuffs/effAc fold lineage, **NOT** a targetEffect: te is for visible cross-creature conditions; this is a self AC modifier resolved inside applyDamage effAc, per §214/§233 buff-not-te nuance) — **no consume-on-apply**; instead expiry at the monster's **next turn START** via the pendingExpirations anchor-clock (§38 anchor caveat), plus round-latch refuse on re-arm.
3. **CODE**: applyDamage effAc reader extends the parry fold (:1308 lineage) with `effect==='defensive_stance' && melee` → effAc+4 for every melee attack in the window; log `defensive_stance_expires` at turn-start unwind.
- **§214/§233 pitfall**: defender chip press tears down attacker's pending-Done `.popup-overlay`; press via DOM `link.click()` in page.evaluate. Trigger is "is hit" → press happens AFTER the triggering attack's verdict, same round (§239 hellish-timing twin); the "+4 including the triggering attack" RAW leg therefore needs miss-negation on the committed trigger OR press-before-Done semantics — same unresolved hit-negation seam flagged in MA-1290 Option B.
- Trigger prose render gap: `trigger` field is authored but the renderer shows name+description only — cosmetic, separate ticket-class (§1285 note).

**Recommendation**: Option A unblocks now (one field, zero code). Option B is RAW-correct but requires the sustained-buff expiry clock + melee-only effAc fold + trigger-hit-negation decision — materially larger than the parry/shield one-shot precedents.

## Cleanup evidence trail

Card closed (`×`; overlays 0) → Admin (`test-campaign`) → Clear Campaign Log + Clear Change Data, native confirms accepted (stale duplicate dialog listeners threw harmless "already handled"; both clears landed) → post-verify: `log.length = 0`, `change-data keys = 0`, overlays 0, header still `test-campaign`, app console 0 errors (1 tester-probe 404 only). No encounter saved (direct join, MA-1285/1290 sibling cleanup precedent).

## Registry delta

`docs/test-monster-registry.json` "Pirate Admiral": verdict `PASS` → **MIXED** (MA-1306/1307/1308 PASS; MA-1309 FAIL(b)/DATA).
