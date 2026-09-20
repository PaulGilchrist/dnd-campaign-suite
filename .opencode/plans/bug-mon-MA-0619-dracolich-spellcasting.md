# Bug: MA-0619 Dracolich — Spellcasting row renders ZERO spell chips (unmarked names)

## Overview
**Verdict: FAIL(b) — DATA GAP.** MA-0576/MA-0599/MA-0611-family spellcasting-markup twin (MA-0421 §89/§115 template). Dracolich Spellcasting (public/data/monsters.json `dracolich` actions[3], stableKey `dracolich|actions|3`) authors its 4-spell, 2-tier list as plain text. `extractSpellNamesFromSpellcasting` (src/components/encounter/MonsterCardHelpers.js:292-303) only recognizes `<strong>`/`<em>`-wrapped names and skips marked text ending `:` (line 299). Disk marks ONLY the two tier headers (`<strong>At Will:</strong>`, `<strong>1/Day Each:</strong>`) → extraction `[]` → `SpellCastLinks` renders nothing (MonsterAction.jsx:62-63) → zero clickable spell affordances on the live joined card. `extractSpellcastingSpellUses` (:305-320, §141) binds `1/Day Each:` limit ONLY to marked names → uses map `{}` → Create Undead + Finger of Death invisible AND ungated by construction. Row-level `spell_save_dc: 19` never renders a save-shell chip (row named "Spellcasting" renders SpellCastLinks XOR ActionSaveRoll — §115/MA-0532). No cast, save, or N/Day spend adjudication reachable.

## Expected (manifest row + monsters.json)
- Manifest MA-0619: monster Dracolich, actionIndex 3, actionName "Spellcasting", actionType `spellcasting`, attackBonus 11, saveDc 19, verified "not verified".
- Authored row keys: `spell_save_dc: 19` (numeric, prose "spell save DC 19" matches — NOT MA-0237 prose-DC class), `spell_attack_bonus: 11` (NOT `attack_bonus`/`save_dc` — key names recorded), `spellcasting_ability: "Charisma"`.
- Authored spells (4, two tiers): At Will: Detect Magic, Ray of Sickness (level 2 version) · 1/Day Each: Create Undead (level 8 version), Finger of Death.
- Expected per §57/§89/§115/§141: four `.mc-dice-link-spell` chips; 2 gated via `monsterSpellUses` limit 1 (2nd 1/Day use refused `automation blocked`); At-Will ungated; tier headers skipped.

## Actual
- **Static (decisive):** disk dump actions[3] verbatim — `<strong>`/`<em>` spans = exactly 2: `At Will:`, `1/Day Each:` (both end `:`, parser-skipped). Marked spell names = **0** → chips `[]`, uses `{}`. No decoy mid-prose emphasis (no MA-0599 fake-chip variant). `save_dc` absent; `spell_save_dc: 19` + `spell_attack_bonus: 11` numeric authored.
- **Spell existence:** Detect Magic 5e ✓ · Ray of Sickness 5e **absent** / 2024 ✓ (§143 corroborated MA-0616 tail) · Create Undead 5e ✓ · Finger of Death 5e ✓.
- **Live (test-campaign, header-verified):** EB join exact "Dracolich" + "Bandit" → cs `[Dracolich 1, Bandit 1, …]`. Card open (.mc-overlay): Spellcasting row `.mc-action` links = `[]`; card-wide `.mc-dice-link-spell` = **0**. Renderer healthy — siblings render: Rend "+13"/"2d10", Necrotic Breath "8d12" + "DC 20 Constitution", Terrifying Presence "2d10" + "DC 19 Wisdom" (attributed by row-walk — not the Spellcasting row), "Expend Legendary". Row inert by markup.
- **Probes:** NOT executable — zero chips means no At-Will cast, no 1/Day double-click refusal reachable. Log post-audit = 3 entries (encounter join + 2 initiative rolls), zero `ability_use`; change-data holds no `monsterSpellUses` keys, "Dracolich 1" absent entirely — gating machinery never engaged (§57/§141).

## Likely Location
DATA — `public/data/monsters.json` dracolich actions[3].description markup gap; parser/consumers byte-stable (MA-0421 archmage/lich fixed template). Fix = wrap EACH of the 4 spell names `<strong>Name</strong>`, keep tier headers as-is, e.g.
`<strong>At Will:</strong> <strong>Detect Magic</strong>, <strong>Ray of Sickness</strong> (level 2 version)` / `<strong>1/Day Each:</strong> <strong>Create Undead</strong> (level 8 version), <strong>Finger of Death</strong>`. Strip-tags byte-equality proves markup-only diff. Post-fix (§21/§106): DELETE combat-ui-viewingMonster keys + hard-reload + re-join; re-verify 4 chips, 1/Day `monsterSpellUses` gates (`automation blocked`, `mc-dice-link-spell-spent`) and DC 19/+11 routing on first live cast.

## Reproduce
1. localhost:5173 → test-campaign (header verified).
2. Encounters → EB → filter "Dracolich" → scrollIntoView+fresh-rect checkbox exact row → filter "Bandit" → exact td "Bandit" checkbox → Join Encounter; cs = Dracolich 1 + Bandit 1.
3. Click Dracolich 1 avatar → card open. Spellcasting row: zero chips, zero affordances; card-wide .mc-dice-link-spell = 0.
4. GET /api/campaigns/test-campaign/log → join + 2 initiative rolls only; change-data → no monsterSpellUses, "Dracolich 1" absent.

## Cleanup
npc-remove ×2 (confirm-override) → cs NPCs removed; admin clear-change-data + clear-log (200); curl verified log `[]`, change-data `{}`, cs creatures `[]`. No src/public-data/manifest/git writes.

## Notes
- **Authored field key names:** row carries `spell_save_dc: 19` and `spell_attack_bonus: 11` (+ `spellcasting_ability: "Charisma"`); there is NO `save_dc` or `attack_bonus` key. Manifest's saveDc 19 / attackBonus 11 map to those two keys.
- **Ray-of-Sickness cast-dead-end:** 5e-absent (§143 grep confirmed); `findMonsterSpell` (MonsterCardModal.jsx:962-968) is 5e-first with 2024 fallback, so a post-fix chip resolves via 2024 — level-2 variant scaling/DC rides 2024 data only; re-confirm at post-fix verification.
- **Create Undead summon-producer ceiling:** grep — `createUndeadHandler.js` exists only in PC spell automation layer (src/services/automation/handlers/spells/) + char-sheet CreateUndeadModal; ZERO Create Undead/summon references in MonsterCardModal.jsx — monster spell-chip casts never route to it; post-fix its chip would log advisory cast without spawned skeleton construction — ceiling noted, not this row's markup defect.
- Row renders NO DC 19 save chip: row-named-Spellcasting XOR rule (§115/MA-0532); DC 19 only reachable per-cast once chips exist.
- Twins: MA-0611 Djinni, MA-0576 Death Slaad (headers marked/names plain), MA-0572, MA-0524/MA-0532; MA-0599 fake-chip variant NOT present here.
- EB gotchas re-confirmed: Dracolich row clipped below viewport (§109) — scrollIntoView required; Join button y=-143 off-screen likewise; checkbox absorbed first clicks (§152).
