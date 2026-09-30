# BUG MA-1686 — Warrior Veteran Parry (warrior-veteran|reactions|0) — FAIL(a)/DATA

## Verdict
FAIL(a)/DATA — prose-only defense reaction, one-field fix (MA-1203 / MA-1681 precedent, playbook §114 line 114 + line 491).

## DISK-BYTES (static)
- monsters.json warrior-veteran reactions[0] keys: `["description","name","trigger"]` — NO `automation`.
- ticket name/trigger/description BYTE-MATCH disk (actionName↔name "Parry"; trigger/"The warrior is hit by a melee attack roll while holding a weapon."; description/"The warrior adds 2 to its AC against that attack, possibly causing it to miss.").
- reactions len 1; monster ac 17.

## Producer/consumer chain (cited)
- `getGatedMonsterReaction` (MonsterCardHelpers.js:2092-2095) reads `action?.automation?.effect` → null for prose row.
- `GatedReactionSlot` (MonsterAction.jsx:165-168) renders nothing when def null; `mc-action` prose fallback with ZERO links (MonsterAction.jsx:372 sole-press guard).
- Parry lane (`GATED_MONSTER_REACTIONS.parry` Helpers:1181; resolveMonsterParry → `_parryAcBonus` fold hitResolution.js:284, playbook line 491) armed ONLY by authored `automation.effect:'parry'` + At Will/999 sentinel.

## LIVE-CENSUS (test-campaign, localhost:5173)
- EB exact-td join: Warrior Veteran 1 (mi warrior-veteran, ac17 hp65 disk-exact) + Bandit 1 (ac12 hp11). Board was CLEARED pre-join (cd {} cs null log []).
- WV card overlay: Reactions row "Parry. The warrior adds 2 to its AC…" = plain `.mc-action`, links:0, gated:0 — NO parry chip affordance (§114/MA-0869 fingerprint byte-held).
- Prose-line probe ×2 (fresh-rect real pointer): 0 popups, lastAttack null, 0 log delta.
- Attack lane vs WV (Bandit scimitar +3, target armed via compact-card select → cs targetName "Warrior Veteran 1"):
  - nat5→8✗, nat7→10✗, nat18→21✓ (hp 65→58), nat11→14✗ ×3, nat9→12✗, nat8→11✗, **nat14→17✓ IN-WINDOW** — Done-committed at effAc:17, parryAcBonus:0, damageApplied:true. Would-be parry window (fold 17→19) never materialized: popup never showed "(+2 Parry)", AC never folded.
  - EVERY attack-log entry carries effAc:17 / parryAcBonus:0 (§111 fingerprint). Zero parry/parry_refused/parry_consumed automation entries whole-log.
- Console: 0 errors (2 warnings) whole session.

## REGISTRY-DELTA (proposed, NOT applied)
```json
{
  "file": "public/data/monsters.json",
  "op": "add",
  "path": "monsters[index=='warrior-veteran'].reactions[0].automation",
  "value": { "type": "reaction", "trigger": "melee_hit", "effect": "parry", "acBonus": 2 },
  "sentinel": { "usage": "At Will", "uses": 999 },
  "precedent": ["MA-1203", "MA-1681", "MA-0341", "MA-0643"],
  "note": "MA-0341 byte-twin shape; acBonus 2 from prose 'adds 2 to its AC'"
}
```

## PITFALLS
- Ref-based click/find/screenshot targets actively retargeted by injection this session (avatar clicks hit sibling checkboxes, snapshot refs fabricated) — run_code_unsafe page.mouse real-pointer + DOM/curl truth only.
- Dice popup does not close on popup-body synthetic click; requires real pointer on `.popup-close-btn` — absorbed presses leave stale lastAttack (§148 re-confirmed: log deltas, not lastAttack, are press truth).
- Attack-log `total` field = natural die; bonus-inclusive total lives on lastAttack — don't cross-compare naively.
