# BUG — MA-1520 Sprite "Enchanting Bow" — FAIL(a) zero-state hit rider

**Row:** MA-1520 · sprite|actions|1 · attack_bonus 6 · range "40/160 ft."
**Verdict:** FAIL(a) — hits deal flat 1 Piercing, `charmed` NEVER applied (MA-1451/1489 standard).

## STATIC (disk `public/data/monsters.json` sprite.actions[1])
- `damage_dice_primary`: ABSENT → flat "1" live via `extractFlatHitDamage` (MonsterCardHelpers.js:2739, MA-0322 lineage).
- `hit_conditions`: **ABSENT** · `hit_target_effect`: **ABSENT** · `save_effect`/`conditions`: ABSENT. Row fields = name/description/attack_bonus/range ONLY.
- Manifest prose `conditions:["charmed"]` is display-only — §59: `buildHitConditionClause` (MonsterCardHelpers.js:693-695) reads `action.hit_conditions` ONLY.
- §118 (MA-0522/0527): no-save_dc attack row → only `hit_conditions` arms the hit grant path; nothing authored = rider inert by construction.
- Consumer grep: `applyHitClauseConditions` handlePlainDamage.js:543 + `applyHitClauseTargetEffect` :658 consume structured `hitClause.conditions`/`hitClause.targetEffect` only; NO prose parser for "the target has the Charmed condition" on the hit path (§59 grapple/MA-0010 seam family).
- No 2024 twin (no public/data/2024/monsters.json sprite).

## LIVE (test-campaign, Playwright, round 1, Sprite init 21 / Bandit init 3)
Rig: Bandit 1 refilled 914→999 via card HP input; target armed on Sprite's OWN initiative card (`selectOption` "Bandit 1", re-armed every roll). AC 12 truth from cs. Row-scoped `.mc-action` strong="Enchanting Bow" single `span.mc-dice-link` "+6" chip. Baseline log=40.

| # | d20 | total | vs AC | hit | formula | finalDamage | hp (Bandit) | charmed applied? |
|---|-----|-------|-------|-----|---------|-------------|--------------|------------------|
| 1 | 16  | 22    | ✓ HIT | yes | "1" (dice-less, rolls:[]) | 1 | 999→998 | **NO** |
| 2 | 13  | 19    | ✓ HIT | yes | "1" | 1 | 998→997 | **NO** |
| 3 | 14  | 20    | ✓ HIT | yes | "1" | 1 | 997→996 | **NO** |
| 4 | 4   | 10    | ✗ MISS | no | — | 0 | 996 (no Δ) | n/a |

- Flat 1 Piercing per hit, dice-less `roll damage` entries (`formula:"1"`, `rolls:[]`, note `combined_damage_roll`), `hp_change` delta −1 each — flat leg LIVE, MA-0322 accepted.
- **Zero charmed state on all 3 hits**: Bandit change-data `activeConditions` empty (`keys: []`), `activeConditionMeta` null, top-level `targetEffects` null; log grep `charmed|condition applied` = **0 hits** across full 50-entry log. No stage-2 grant text in any popup ("1 damage applied to Bandit 1 — HP: …" only).
- §108 charmed-clears-on-damage N/A — nothing was ever applied to clear; adjudicated at pick-time: zero `condition applied` entries, so no applied-then-removed ambiguity.
- No crit faces rolled (not needed — flat never doubles, MA-0322 codex).
- MISS face genuine; zero damage/state on miss (no spurious grant).

## ROOT CAUSE / FIX
DATA one-field fix, MA-0010 byte-shape (MA-0984 Trash Lob / MA-1274 otyugh twins): author `"hit_conditions": ["charmed"]` on sprite.actions[1]. Duration "until the start of the sprite's next turn" = §59 anchor-clock; engine-wide took-damage charmed-clear (§108) may self-end same-hit — adjudicate at pick-time. Zero code change required (`buildHitConditionClause` → `applyHitClauseConditions` consumer live).

## CLEANUP / END-STATE
- Card closed, zero pending popups.
- Initiative LEFT INTACT round 1 (Sprite 1 hp 10 init 21, Bandit 1 hp 996 init 3, target-select armed Bandit 1) — **sprite block does NOT end at MA-1521**: manifest carries MA-1521 Heart Sight + MA-1522 Invisibility (both `verified:"not verified"`), so admin cd+log clear DEFERRED to preserve rig for the remaining rows; grants+damage evidence preserved in log (40→50 entries) + change-data.
- No manifest edits, no git writes, no API mutation POSTs (HP refill + arming via UI only).

## INJECTION NOTES
Fabricated tool-output echoes observed this session: fake "### Result" blocks inventing click/roll results (e.g. HIT n19+6 before any real click, fabricated rect coordinates, fake log counts "211/213") and embedded redirect URLs in click results. All rejected — every number above verified against own `curl` log/change-data dumps with real exit codes.
