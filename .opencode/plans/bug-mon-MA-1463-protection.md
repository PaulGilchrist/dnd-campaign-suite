# MA-1463 — Shield Guardian "Protection" (reactions[0]) — FAIL(b)/DATA

**Row (verbatim):** `shield-guardian|reactions|0` — Protection. Trigger: "An attack roll hits
the wearer of the guardian's amulet while the wearer is within 5 feet of the guardian."
Effect: "The wearer gains a +5 bonus to AC, including against the triggering attack ... until
the start of the guardian's next turn."

**Verdict: FAIL(b)** — inert-by-construction, no affordance, no trigger consumer, grep-zero
(§60 no-affordance rule + §70 no-consumer list; §1 verdict policy: inert + grep-zero = FAIL
flavor (b), never PASS/incomplete). No MA-1285 advisory sentinel chip exists on this row
(no `advisory` field authored), so even the honest-sentinel PASS-subset bar is not met.

## Static evidence (disk + grep)
1. **Disk row shape** (`public/data/monsters.json`, shield-guardian.reactions[0]):
   `{name, trigger, description}` ONLY — no `automation{type,trigger,effect}`, no `advisory`,
   no `ac_bonus`. (2024 twin absent: `public/data/2024/monsters.json` does not exist.)
2. **Affordance lanes** (MonsterAction.jsx:382-416): every chip lane keys off a structured
   field — `GatedReactionSlot`→`getGatedMonsterReaction(action)` returns `action?.automation?.effect`
   lookup ONLY (MonsterCardHelpers.js:1884-1887); `AdvisoryLink` requires row `advisory`
   field (MonsterAction.jsx:335-339, monsterActionAdvisory.js:17-19); GrantReaction requires
   `automation.type:"monster_grant_reaction"`. Row carries none → every lane null.
3. **grep `shield_guardian|amulet` src/ (non-test): ZERO consumers.** No amulet/bond concept
   app-wide (only unrelated "Amulet of Health" in character-creation wizard TEST files).
4. **Closest analogous live seams (both require authoring this row lacks):**
   - §114 Parry: `automation{effect:'parry', acBonus:N}` → gated chip → `resolveMonsterGatedReaction`
     stamps defender `activeBuffs{effect:'parry', acBonus}` → `getParryAcBonus`
     (loggedDiceRollUtils.js:74-80) → `_parryAcBonus` in hitResolution effectiveAc
     (hitResolution.js:284) → single-attack consume (attackPostProcessing.js:38).
     Bandit Captain MA-0341 authored template.
   - `warding_bond` te carries `acBonus` via same activeBuffs channel
     (`getWardingBondAcBonus`, loggedDiceRollUtils.js:62-68 → `_wardingBondAcBonus`,
     useLoggedDiceRollAttack.js:483).
   Neither producer ever runs for Shield Guardian Protection — no automation.effect exists.

## Live evidence (test-campaign, :5173, 2026-09-27)
- Campaign header verified `test-campaign`. Initiative: Shield Guardian 1 (AC17, init9, 142hp)
  + Bandit 1 (AC12, init16) + 14 PCs, round 1 — matches registry LIVE config.
- **Card render:** Reactions section = plain text `strong "Protection." + span description`.
  `protRow` chips = `[]`, `[role=button]` = `[]`, overlay advisory chips = `[]`
  (9 non-advisory dice chips elsewhere on card). **Zero affordance.**
- **Press x2** (fresh rects, un-clipped, viewport h=907): zero popup, zero log delta (29→29).
- **Path A — triggering attack (wearer proxy):** armed Guardian's own `[data-testid="target-select"]`
  → Bandit 1 (monster-vs-monster targeting allowed — "Bandit 1" in options), fired Fist +7 chip:
  `roll targetAc:12 hit:true` (d20 8+7=15 vs AC 12 — **NOT AC 17**), `roll 7 finalDamage:7`,
  `hp_change Bandit 1`. Full damage to "wearer"; trigger never evaluated; no chip/badge/te/popup.
  Post-hit re-audit of card: `protChips: []` (no gated-reaction chip appears even with
  lastAttack = Guardian→Bandit1 HIT armed).
- **Path B — GM Add→Effects (§76):** modal Effects tab has a chip literally labelled
  "Protection" — but it is `te 'protection'` = Protection fighting style, "Attacks against
  target have Disadvantage" (targetEffectDefinitions.js:281-289, fields:['source']). Apply →
  badge "Disadv vs" on Bandit 1 + log `condition/target-effect-applied protection`. Re-roll
  Fist: disadvantage consumed (d20 4,13→4+7=11 vs **AC 12**, `lastAttack.effectiveAc:12`) —
  proves even the identically-named te is a disadvantage channel, NOT the +5 AC bond.
- **Machine truth:** `lastAttack` after trigger-shaped events: `attackerName:"Shield Guardian 1",
  targetName:"Bandit 1", targetAc:12, effectiveAc:12`. Whole campaign log: 1 "protection" mention
  = my own GM-added fighting-style te. Zero "amulet". Zero +5 AC anywhere.

## Trigger-path attempts (exhaustive)
| Path | Built? | Result |
|---|---|---|
| Guardian attacks Bandit 1 (wearer proxy) via live Fist chip | YES | AC 12, no trigger, no te, full damage |
| GM Add→Effects "Protection" chip on Bandit 1 | YES | Wrong te (disadv fight style); AC stays 12 |
| Guardian card post-hit affordance (gated chip appearing on trigger) | YES (audited) | protChips [] — no gate keys off lastAttack for this row |
| Row text press (advisory sentinel press) | YES x2 | zero popup, zero log |
| PC attacks Bandit 1 (PC attacker) | NO — unreachable | GM board has no seam to roll PC attacks; PC combat runs through each PC's own client/sheet |
| Second Bandit attacks Bandit 1 | NO — moot | same consumer absence; monster-vs-monster already proven via Path A (guardian→bandit) |
| External lastAttack seed + reload (§109) | NO — prohibited | hard rule: no API mutation POSTs; and moot: `getGatedMonsterReaction` returns null (no automation.effect), nothing evaluates the row regardless of lastAttack |
| 5-ft adjacency token placement | NO — moot | no distance/proximity consumer exists for this row (grep-zero); §42 gridless lenient; no trigger to satisfy |

## Why FAIL(b) not PASS-subset
MA-1285 precedent: honest advisory sentinel requires authoring ONE field
(`advisory:"monster_uncanny_dodge"`) on the name/trigger/description-only row → AdvisoryLink
chip + record-only ability_use log. This row authors NOTHING → zero affordance, zero press
surface, trigger physically unreachable = FAIL(b)/§60/§70.

## Fix direction (DATA, precedent-backed, not applied by subagent)
- **Minimal honest (MA-1285 template):** add `advisory:"monster_shield_guardian_protection"`
  (+ optional advisory_message) to reactions[0] → record-only chip, GM-enforced +5 AC/bond.
- **Full RAW (MA-0341 parry template):** `automation{type,trigger:'wearer_hit',effect:'guardian_protection',acBonus:5}`
  + registry entry in `GATED_MONSTER_REACTIONS` + gated chip gated on lastAttack.targetName ==
  amulet wearer — blocked by RAW prerequisite: app has NO amulet/bond concept (grep-zero), so
  wearer identity is unmodellable without a new bond-state producer.

## Session record
- test-campaign ONLY; no API mutation POSTs; all presses via Playwright UI; no manifest/git writes.
- Deltas this session: log 29→34 (2 guardian attack+damage+hp to Bandit 1 [Path A], 1 GM te
  applied, 1 disadv miss [Path B]); Bandit 1 848→841 hp; Bandit 1 carries GM-added `protection` te.
- Cleanup: admin clear change-data + log performed at session end (Shield Guardian block done).
