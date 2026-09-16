# Bug MA-0276 — Animal Lord Spellcasting (actions[4]) — FAIL

## Verdict: FAIL (MA-0249/MA-0237 prose-only family, 3rd confirm)

## Root cause — DATA
`GET /data/monsters.json` animal-lord `actions[4]` = bare `{name:"Spellcasting", description}` —
NO numeric `save_dc:20`, NO structured `spells[]` with usage. Wisdom DC 20, At Will/2/Day/1/Day
tiers exist only as prose → app parses spell NAMES from prose into chips but has no numbers to enforce.

## Live evidence (test-campaign, Animal Lord 1 cs idx0 init 20, 2026-09-16)
- 7 `.mc-dice-link-spell` chips render from prose; zero DC/+hit affordance text (`dcText:0`).
- **Sunburst (damage save)**: click → overlay "DC Unknown — no success or failure"; CON 4d20 save dice
  DID roll+log (log 42460375/589a701d: dc:None, saveResult:None, vs HeroesFeastBard) — phantom dice,
  no DC enforcement, no hp_change. No monsterSpellUses spend → no charge leak, but also NO 1/Day gate.
- **Animal Friendship / Speak with Animals (no damage)**: advisory `ability_use` record-only (CLA-325),
  "GM-enforced for monsters". At-Will free = correct shape, zero enforcement.
- **Awaken (2/Day)**: GATE LIVE — chip `(2/Day · 2 left)`→1→0, spend nested at
  change-data `"Animal Lord 1".monsterSpellUses = {Awaken:2}` (top-level null), 3rd click refused:
  `automation blocked … already cast Awaken today (2/Day)` (log 50391bb6). ✔ only enforcing leg.
  DEFECT: each spend click double-logs ability_use in ~40ms pairs (4 records for 2 spends).
- **1/Day (Sage Only) chips (Animal Shapes, Sunburst)**: NO usage counter rendered — "1/Day Each
  (Sage Only)" prose fails usage parse (MA-0249 sibling where 1/Day gate was live) → ungated refire.
- **Wisdom DC 20**: never enforced anywhere (dc:None on the only save prompt attempt).
- **Sage-only clause**: inert — no subclass context in monster runtime; clause text ignored.

## Log inventory (post-baseline delta)
ability_use×6 (AF×1, SwA×1, Awaken×4-double-logged), automation_blocked×1 (Awaken), roll×2
(Sunburst phantom CON/save dice), hp_change×0. No charge leak; phantom dice = dead-cast residue.

## Fix (DATA)
Add `save_dc: 20` to actions[4]; structure spells array with per-spell usage tiers
(`{name, save_dc:20, save_type, usage:"at-will"|"2/day"|"1/day", sage_only:true}`) per MA-0215
Ancient Gold healthy template (row-level save_dc consumed → real save prompts; monsterSpellUses
gate on all limited tiers; chips show DC). Also fix double-log on usage spend.

## Residue left in runtime
`"Animal Lord 1".monsterSpellUses = {Awaken:2}` (2 phantom spent charges), 2 Sunburst phantom rolls,
advisory ability_use entries; no HP/te applied to any target. No registry/manifest/playbook edits.
