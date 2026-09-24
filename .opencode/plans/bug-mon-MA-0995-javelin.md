# MA-0995 — Hobgoblin Warlord "Javelin" — FAIL(a) wrong-slot save_effect (Speed-decrease rider inert)

- **id:** MA-0995 | **stableKey:** `hobgoblin-warlord|actions|1`
- **monster:** Hobgoblin Warlord (`hobgoblin-warlord`) | **actionIndex:** 1 | **category:** actions
- **actionName:** Javelin | **actionType:** attack
- **verdict:** FAIL(a)-DATA (wrong-slot structured rider; attack core exact) — MA-0984 Trash Lob adjudication twin
- **date:** 2026-09-23 | **campaign:** test-campaign (header verified live)

## Expected

Row description (monsters.json, verbatim):

> "Melee or Ranged Attack Roll: +6, reach 5 ft. or range 30/120 ft. **Hit:** 11 (2d6 + 4) Piercing damage, and the target's Speed decreases by 10 feet until the start of the hobgoblin's next turn."

On a hit, the target takes 11 (2d6+4) Piercing **AND** its Speed decreases by 10 ft until the start of the hobgoblin's next turn. Authored numbers: attack_bonus 6, damage 2d6+4 Piercing, reach 5 ft., range 30/120 ft.

## Actual

Attack core verified EXACT live (subagent MA-0995 run, server-truth):
- P1 nat10+6=16 ✓AC12 → "2d6 + 4" [2,5]+4=11 Piercing, 325→314, fd==|hpΔ|, resisted:false
- P2 nat12+6=18 ✓AC12 → [6,2]+4=12 → 302; fd==|hpΔ|
- P3 nat1+6=7 ✗ CRIT MISS, done-less, zero damage
- bonus:6 separate; targetAc==effAc==12; log exact; console 0 errors

**Rider inert:** the Speed-decrease clause never applies. Disk authors it in the WRONG slot — `save_effect` on an attack row with NO `save_dc`. §118/§116 fingerprint: `save_effect` consumers are gated `save_dc != null` (`MonsterAction.jsx:92`, `MonsterCardModal.jsx:567`; attack chips null saves `MonsterCardModal.jsx:960-962`), and the hit path consumes ONLY `hit_conditions`/`hit_target_effect` (`MonsterCardHelpers.js:622-624` → `handlePlainDamage.js:543`). No speed-modifier transport exists for monster attack hits (no te authored, no consumer). Live probe: no condition/modifier/meta entries on Bandit 1 post-hit (zero delta).

## Steps to Reproduce

1. localhost:5173 → test-campaign → EB exact "Hobgoblin Warlord" → Join → arm Bandit 1 on Warlord's own card.
2. Open Warlord card → §142-scope row `strong` startsWith "Javelin" (note MA-0640 hasText trap: first hasText hit is Multiattack row).
3. Press Javelin "+6" until a hit lands (nat≥6). Observe damage applies exactly; Bandit gains NO Speed reduction — no modifier log, no meta, no badge.

## Likely Location

`public/data/monsters.json` hobgoblin-warlord.actions[1] — wrong-slot structured field (identical to MA-0984 hill-giant Trash Lob). Fix options:
- (A) one-field move to a slot the hit path consumes (`hit_conditions:["poisoned"]`-style precedent MA-0556 does not fit "Speed decrease" — Speed is not a condition).
- (B) Proper fix requires a targeted-effect (te) for temporary speed reduction with until-owner-next-turn duration registered in `src/services/combat/conditions/targetEffectDefinitions.js` + hit-path producer (hit_target_effect) — design ticket.

## Notes

- Adjudication overturned by orchestrator from subagent's PASS: subagent noted the clause "inert-by-construction… outside chip-scope", but per MA-0984 precedent a wrongly-slotted structured rider that is part of the row's own HIT effect text = FAIL(a), not PASS-with-note. Prose-only riders remain PASS-subset per MA-0937/MA-0983 precedent; THIS row authors a structured field, so it takes the MA-0984 lane.
- Same-family rows to sweep: any attack row with authored `save_effect` and no `save_dc`.
- Reference: `.opencode/plans/bug-mon-MA-0984-trash-lob.md`.
