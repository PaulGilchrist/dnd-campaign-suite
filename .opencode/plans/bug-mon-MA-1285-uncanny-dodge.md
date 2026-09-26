# MA-1285 — Performer "Uncanny Dodge" (reaction) — FAIL(b) zero-affordance

- **Monster**: Performer (`public/data/monsters.json`, index `performer`)
- **Category**: reactions[0] — Uncanny Dodge
- **Trigger (authored)**: "The performer is hit by an attack roll"
- **Description (authored)**: "The performer halves the damage (round down) it takes from that attack."
- **Verdict**: FAIL(b) — DATA, zero affordance (§60)
- **Date**: 2026-09-26, live test-campaign (header verified)

## Disk fingerprint

Performer `reactions[0]` keys = `name`/`trigger`/`description` ONLY. No `automation`, no `advisory`, no `usage`.
§60: monster reaction rows without `automation:{type,trigger,effect}` are inert prose.

**Twin: Scout Captain** — byte-identical shape ("The scout is hit by an attack roll / halves the damage") — same defect, fix both rows in one pass.

## Static evidence (own greps)

- Monster gated-reaction registry `src/components/encounter/MonsterCardHelpers.js:982-1140` — 13 keys:
  feather_fall :982, counterspell :988, hellish_rebuke :996, parry :1007, shield :1026, jinx_negate :1039, split :1053, heal :1062, attack :1076, portent :1086, limited_foresight :1103, elemental_absorption :1123, redirect_attack :1140 — **NO `uncanny_dodge` entry**.
- `'uncanny_dodge'` grep app-wide: **zero monster-side consumers**. Only PC-side files: `src/services/rules/trackedResources.js`, `initiativeHandler.js`, `useInitiativeEffects.js`, `initiativeProcessing.js`, `restRules*` (uncanny metabolism) and PC class-feature tests (`superiorHunterDefenseHandler.test.js` etc.). No `monster_uncanny_dodge` advisory key exists either.
- `MonsterAction.jsx` chip lanes all key off `attack_bonus`/dice/`save_dc`/Spellcasting-markup/`automation.effect`/legendaryGate/zone dict/`advisory` (§190 MA-0648 fingerprint) — the row matches none → no chip, no gate, no resolver.

## Live census (test-campaign, 2026-09-26)

- EB exact-td native `cb.click()` tick ['Bandit','Performer'] → explicit "Join Encounter".
- cs idx0 Performer 1 hp27 AC13 init4; idx1 Bandit 1 hp11 AC12 init1. Baseline log 0.
- `img.avatar-image[alt="Performer 1"].click()` → `.mc-overlay` "Performer 1 — Medium Humanoid, Neutral".
- Uncanny Dodge row DOM: `<strong>Uncanny Dodge.</strong> <span>The performer halves the damage (round down) it takes from that attack.</span>` ONLY.
  diceLinks 0, roleButtons 0, buttons 0, anchors 0, advisoryChip false, gatedSlot false.
  Cosmetic note: authored `trigger` text is not rendered at all (name+description only).
- Center-click probe ×2 at row center: popups 0, log delta 0 (log held at 3 join/initiative entries), `uncanny`/`dodge` log entries 0, console errors 0.
- RAW damage passes un-halved structurally: no producer, no consumer, no gate — nothing can fire.

Cleanup: Admin → Full Reset (native confirm accepted via dialog listener, one snippet) → post-verify `log[] = 0`, `change-data {}`.

## Fix options

### Option A — interim advisory (cheap, zero-code, MA-1251 precedent)
Add one field to both Performer and Scout Captain rows: `advisory: "monster_uncanny_dodge"`.
Advisory seam is a GENERIC passthrough (`isMonsterActionAdvisoryRow = !!row.advisory`, value never inspected, category-agnostic — `MonsterAction.jsx` AdvisoryLink :335-343, resolver `MonsterCardModal.jsx:2385` → `resolveMonsterActionAdvisoryRow`, record-only ability_use popup + log, CLA-320 GM-enforced). Semantics stay GM-enforced: "halve it yourself" advisory popup + log. Precedent: MA-1251 Ink Cloud (same zero-affordance reaction/other-row family).

### Option B — full fix: registry effect + one-shot damage-halve consumer (MA-0681 template)
MA-0681 Elemental Absorption (playbook §233 line 233; Helpers `elemental_absorption` :1123, gate/resolver :1592-1648) is the closest LIVE twin — gated damage-taken reaction that halves damage:
1. **DATA**: `automation:{type:"reaction", trigger:"damage_taken", effect:"uncanny_dodge", usage:"At Will", uses:999, maxUses:999}` (+ 1/round latch) on Performer + Scout Captain rows, camelCase byte-shape per MA-0643/MA-0681 convention.
2. **CODE**: new registry entry in `MonsterCardHelpers.js` gated-reaction dict + `uncannyDodgeGate`/resolver arming a ONE-SHOT `activeBuffs {effect:'uncanny_dodge', halveNextHit:true}` + spend `MONSTER_REACTION_USES` + stamp `lastAttack.uncannyDodgeResolved` — parry (:1007/:1308) and shield (:1026/:1416) channels are the precedents.
3. **CODE**: applyDamage.js consumer — extend the NPC-only `addElementalAbsorptionResistances` reader lineage (MA-0681: buffs were player-only `addBuffResistances`) with a narrow `effect==='uncanny_dodge'` halve-at-resolve + consume + `uncanny_dodge_applied` log.
- **§214/§233 pitfall**: a defender-reaction chip press TEARS DOWN the attacker's pending-Done `.popup-overlay`; live model = press ARMS the one-shot buff, the NEXT resolved hit's Done halves & consumes. Press defender chips via DOM `link.click()` in page.evaluate (popup overlays intercept real pointer clicks).
- Same fix pass covers both twins; register any new te in `targetEffectDefinitions.js` if a visible badge is desired (§5 te-registry rule).

**Recommendation**: Option A unblocks now (one field ×2 monsters, zero code); Option B is the RAW-correct fix if automated halving is wanted.
