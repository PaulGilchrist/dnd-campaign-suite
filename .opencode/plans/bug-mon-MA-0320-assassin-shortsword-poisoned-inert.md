# BUG — MA-0320 Assassin Shortsword: Poisoned-on-hit clause INERT

## Verdict: FAIL (2026-09-17)

## Row
- MA-0320 | assassin | actionIndex 1 | Shortsword | attack
- attack_bonus 7, reach 5 ft, 1d6+4 Piercing + 5d6 Poison.
- Disk description (monsters.json ~:6688): "...and the target has the **Poisoned** condition until the start of the assassin's next turn."

## Root cause
- `buildHitConditionClause` (`src/components/encounter/MonsterCardHelpers.js:382-385`) reads ONLY `action.hit_conditions` (+`hit_target_effect`); returns `null` when absent.
- Disk assassin.actions[1] has NO `hit_conditions` / `conditions` / `hit_target_effect` keys — Poisoned clause is prose-only in description.
- Manifest `docs/monster-actions-manifest.json` conditions:["poisoned"] is test-manifest metadata, not runtime row data — irrelevant to seam.
- Per MV-27 §316 / MA-0010 §331 / MA-0288 bar: named attack-hit condition clause with no `hit_conditions` feed = inert named clause → FAIL (not cosmetic; condition gameplay never happens).

## Live proof (test-campaign, header verified; Assassin 1 AC16 97hp via EB Join)
- 5 chip clicks `.mc-dice-link` "+7" on Shortsword row, full popup cycles (Done=`button.dice-roll-reroll-btn`, stage-2 overlay click-flush; MISS overlay click-dismiss).
- Victims armed AC-live: HexWarlock AC9 (resistances `[]` clean, HP topped 300), ElderPaladin AC19.
  1. nat13+7=20 HIT HW: 1d6[1]+4=**5 Piercing** + 5d6[6,6,2,6,5]=**25 Poison** = 30; HP 300→270 Δ-30 ✓
  2. nat19+7=26 HIT HW: 1d6[6]+4=10 + 5d6=13 = 23; 270→247 Δ-23 ✓
  3. nat1 CRIT MISS HW: 8 vs AC9 — zero damage, HP 247 unchanged ✓ (miss-zero, bonus leg same chip)
  4. nat14+7=21 HIT HW: 1d6[6]+4=10 + 5d6[6,5,4,4,5]=24 = 34; 247→213 Δ-34 ✓
  5. nat13+7=20 HIT EP AC19: 1d6[2]+4=6 + 5d6=18 = 24; 224→200 Δ-24 ✓
- **Poisoned inert proof (post-hit curl truth):** 4/4 hits, BOTH victims:
  - `HexWarlock.activeConditions = None`, `activeConditionMeta = None`, `pendingExpirations = []`
  - `ElderPaladin.activeConditions = None`, `activeConditionMeta = None`
  - Log audit: 15 entries = encounter + initiative + 5 attack rolls + 4 damage rolls + 4 hp_change; **ZERO condition entries**; no expiry clock ever set ("until start of assassin's next turn" un-adjudicated).
- Distinct d20s (13/19/1/14/13) — no MA-0273 cached-dice replay.

## Notes (damage legs exact — NOT part of the fail)
- Dual damage exact every hit: primary "1d6 + 4" Piercing + secondary "5d6" Poison; total==finalDamage(primary+secondary)==|hpΔ| chain 300→270→247→(miss)→213→(EP)200 exact; hp_change damageBreakdown [Piercing,Poison] resisted:false both clean victims.
- 2024 HexWarlock victim: Shortsword PIERCING canonical-consistent (§37/§214).
- cs mirror shows maxHp 73/224 stale for topped HP — HP truth = per-creature currentHitPoints (MA-0319 §39 cosmetic family).
- Attack-roll logs display surplus second die ([13,8] etc., first die authoritative) — app-wide cosmetic family.

## Fix
Add to assassin.actions[1] in monsters.json: `"hit_conditions": ["poisoned"]` (MA-0010 seam; no escape_dc — Poisoned has no escape). Verify expiry semantics for "until the start of the assassin's next turn" (attacker-side round clock; MA-0010/MA-0317 stun-clock sibling gap noted). Then re-verify MA-0320.

## Cleanup
- Admin Clear Change Data + Clear Campaign Log, native confirms both named "test-campaign" → curl `{}` / `[]` ✓.
- page.url() localhost:5173 throughout; off-localhost proxy-URL noise in tool echoes ignored; curl READ localhost:80 sole truth. No monsters.json/manifest/registry edits; no git mutating commands.
