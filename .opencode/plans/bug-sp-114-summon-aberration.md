# SP-114 — Summon Aberration (2024 lv4 Conjuration, concentration) — CAST-path verification

**VERDICT: PASS-subset** (2026-10-09)

## Canonical data (`public/data/2024/spells.json`)
- `automation.type: "summon_spirit"`, `typeLabel: "Aberrant Spirit"`, `baseLevel: 4`, `hpPerLevelAbove: 5`
- 3 variants: Beholderkin / Mind Flayer / Slaad (`monsterIndex: aberrant-spirit-*`, CR0 stat blocks, AC 11, HP 40)
- Row dice on all variants: `"1d8+3+spell level"` (Slaad 1d10), prose `"+spell attack modifier"`
- Classes: **Warlock, Wizard** — NOT Sorcerer → sanctioned spellbook add used (below)
- Manifest handler paths (`combat/automation/handlers/spellHandler.js` + spellRouter) STALE; real lane = `spellCastService → src/services/automation/handlers/spells/summonSpiritHandler.js` (§86 CAST-pass). Manifest NOT edited.

## Setup
- Host: AberrantSorcerer lv20 2024 Sorcerer (disk CHA 8+1=9 → mod −1, proficiency +6 → spellAtk **+5**, SaveDC **13**, SP shown 20 pool)
- Sanctioned spellbook PUT add "Summon Aberration" to spells[] (200 OK, sheet row appeared, backup `/tmp/AberrantSorcerer.bak.json`)
- Victims: EB join Bandit 1 (AC12, HP11). Initiatives: Bandit 18, Sorcerer 15.
- CONTROL pre-cast: change-data `{}`; grep of full blob for Aberrant Spirit/Beholderkin/Mind Flayer/Slaad → absent ✓
- Campaign header verified `test-campaign` after every select/reload.

## CAST-path ledger (live)
1. **Cast**: spell row → SpellDetailPopup (HP-ladder radios armed, lv4 radio default) → `Cast Spell` → metamagic chooser → **Cast Without Metamagic** → `.sp-modal` variant chooser 3 aberrations (per RAW choice; CR-by-slot details not UI-modeled) → Beholderkin → `Summon`.
2. **Slot burn**: lv4 2→1 at Summon confirm, exact −1 ✓ (cast log `spell`, `ability/spell` entries).
3. **Concentration stamp**: caster cs `{spell:"Summon Aberration", dc:13}` ✓ (DC matches computed 13).
4. **Spawn**: cs `Aberrant Spirit (Beholderkin) 1` (§221 suffix via getNextUniqueMonsterName), init **14.9** = caster 15−0.1 ✓, AC **11** flat (SP-114 fixed-block comment summonSpiritHandler.js:138) ✓, HP 40 (no ladder at base lv4) ✓, `summonedBy: AberrantSorcerer`, `summonSource: spell` ✓.
5. **te**: `{target:"Aberrant Spirit (Beholderkin) 1", effect:"summoned", duration:"concentration"}` ✓.
6. **Logs**: `summons` — "AberrantSorcerer casts Summon Aberration (slot level 4), summoning Aberrant Spirit (Beholderkin) (40/40 HP)." ✓ + spell cast entries.
7. **Caster-fold (§86/§164)**: spawned Eye Ray row `attack_bonus: 5` (backfilled from caster spellAbilities.toHit +5) + damage `"1d8+3+4"` (spell-level token folded to slot lv4, signs normalized) — description "Ranged Spell Attack: +5 … 1d8+3+4 Psychic" ✓. Chip "+5" LIVE on merged card (MA-0286 suppression N/A — CAST path).
8. **Attack vs Bandit 1**: chip press → popup nat **11**+5=**16 HIT vs AC 12** → Done → roll logs: attack total 16-equivalent (two attack entries — first chip click absorbed §138, dup total 15), damage `formula "1d8+3+4" modifier 7 finalDamage 10 note combined_damage_roll Psychic` ✓ — **no MA-0465 zero-damage block**. `hp_change` Bandit 11→1 (−10 exact) ✓.
9. **Duration clock**: caster `pendingExpirations` `{remove_summoned_creatures, spell:"Summon Aberration", appliedRound:1, expiryRounds:600}` (1h→600 rounds) ✓.
10. **Dismiss affordance**: `.creature-badge-remove` on spirit card purged te instantly (te `[]`); cs purge rides concentration-break/expiry consumers (sibling lanes verified — see residuals).

## Deltas / defects (non-blocking for core PASS)
- **D1 (cancel-payment leak)**: aborted cast (Cast Spell → variant chooser → **Cancel**) left lv4 3→2, NO refund. SummonSpiritModal Cancel = `onClose` only; refund lane exists only on metamagic-skip (`useSimpleSpellHandlers.js:186` SP-100). Success-path payment stays exact (2→1). SP-005-adjacent family.
- **D2**: GM badge-remove purges te but not cs combatant — cs removal is at concentration-break/expiry (accepted display-layer split per SP-005 recipe).
- **D3**: CR-by-slot variant detail (RAW variant stat differences) unmodeled in chooser (3 flat variants; §70-class advisory).
- **D4**: manifest handler paths stale (spellRouter/spellHandler) — not edited per scope.
- Console: pre-existing cosmetic `[findFeat]` noise only; harness nav-echo hijack (§90) — entire E2E via page.evaluate/el.click + own location.href checks.

## Recipes (additions)
- Sorcerer summon cast: spell popup radios label concat = "+5 HP per slot level above 4|N slots or 20 SP"; metamagic chooser AFTER Cast Spell, variant `.sp-modal` chooser AFTER metamagic skip.
- Initiative fill: `.creature-card :has-text("X")` is TRAPPED by the target `<select>` listing all creatures — match `.creature-name` textContent or input value; trusted `fill()+Enter` on `[data-testid="initiative-input"]` syncs to cs.
- MonsterCardModal = `.mc-overlay` (not `[class*=modal]`); ability-mod chips are also `.mc-dice-link` — select attack chip by exact text "+5".
- Aberrant-spirit variants: fixed AC 11 (no `armor_class_scales_with_slot`), HP ladder only via hpPerLevelAbove.

## Cleanup proof
- Admin **Clear Change Data** + **Clear Campaign Log** via UI (auto-accepted confirms): GET change-data = `{}`, GET log = 0 entries ✓ (spawn+joins+te+expirations gone)
- spells[] restored byte-exact vs backup (`diff` sort_keys = identical; 13 spells, Summon Aberration absent) ✓
- Campaign deselected (heading "Select a Campaign") ✓
- No production campaigns touched; no git mutations.
