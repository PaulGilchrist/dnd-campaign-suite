# SP-026 — Compelled Duel — VERIFIED: PASS-subset

**Host:** ElderPaladin (lv20 2024 Paladin, Oath of the Ancients) · **Campaign:** test-campaign (header verified) · **Date:** 2026-10-04 · **Build served:** production `dist/assets/index-DS6gi1Ds.js` (built Oct 1 14:37) — predates src SP-002 guard (commit 5726f7549, Oct 2).

## Canonical spell text (public/data/2024/spells.json, index `compelled-duel`)

> "You try to compel a creature into a duel. One creature that you can see within range makes a Wisdom saving throw. On a failed save, the target has Disadvantage on attack rolls against creatures other than you, and it can't willingly move to a space that is more than 30 feet away from you."
>
> "The spell ends if you make an attack roll against a creature other than the target, if you cast a spell on an enemy other than the target, if any ally of yours damages the target, or if you end your turn more than 30 feet away from the target."

Level 1 · Enchantment · Paladin · Bonus Action · 30 ft · Concentration up to 1 minute · DC WIS (dc_success "none").

## Evidence (live, browser)

1. **Spellbook lane:** Compelled Duel NOT auto-assigned (spells[]=[], absent from Bonus Actions lane). Added via Edit wizard → Spells step: `.mi-overlay` "Skip for now" flush required before `list-item-checkbox-trigger` click (intercepts pointer events). Save → disk `spells:["Compelled Duel"]`; row renders "1 · 30 ft. · DC 19 WIS · Utility" in Bonus Actions. `spell_slots_level_1`=4 baseline.
2. **EffectAdder round-trip (caster):** Initiative → `button.effect-add-btn[title*="ElderPaladin"]` → Effects tab → search → `ea-badge` "Compelled Duel" → Source select (ElderPaladin) → Apply → `GET /api/campaigns/test-campaign/targetEffects` = `[{target:ElderPaladin, effect:compelled_duel, source:ElderPaladin}]` → Remove ("Remove effect" badge) → `targetEffects:[]`. NOTE: campaign targetEffects live at **dedicated endpoint** `/api/campaigns/:name/targetEffects`, NOT under change-data `__campaign__` key.
3. **Cast abort (stale bundle):** First cast → `executeSpellCast error for Compelled Duel: Error: activeConditions must be an array for caster`. Deployed bundle guard is `if(i==null||!Array.isArray(i)) throw` (index-DS6gi1Ds.js:76) — throws on MISSING key. Current src (`execution/index.js:122`, `spellResolution.js:42`) tolerates null (SP-002 fix, Oct 2) — not deployed. **Cast abort burns a slot** (4→3) — SP-002 bug-class live in deployed lane. Workaround: pre-stamp caster `activeConditions` via EffectAdder Conditions tab (Deafened→Apply → `["deafened"]`).
4. **Target arming:** Bonus-action row → description popup → "Cast Spell" with no armed target proceeds to save prompt addressed to **"Unknown"** ("ElderPaladin casts Compelled Duel on Unknown"), consumes slot (3→2), Dismiss clears cleanly (no te). Recipe: arm Target select on caster's initiative card FIRST (filter by `.creature-name` — option-text collision hits wrong card).
5. **Save prompt / DC:** re-cast with target armed → sp-overlay savePrompt: "**Bandit 1 must make a WIS saving throw. DC 19. No damage on successful save**" → Roll Save → "**SAVE FAILURE** Total: 13 vs DC 19 — d20 (13) + 0" → Done. Slot 2→1 (one slot per cast).
6. **State stamp:** `GET /targetEffects` → `{target:"Bandit 1", effect:"compelled_duel", source:"ElderPaladin", duration:"concentration"}`. Caster concentration record: `{spell:"Compelled Duel", dc:19}` in combatSummary. Compelled Duel badge on Bandit 1 card. Log: `ability_use` "…WIS save (DC 19)…", `save_result` "Bandit 1 failed WIS save (DC 19, rolled 13 = 13)", `condition applied` note "Bandit 1 has Disadvantage on attack rolls against creatures other than ElderPaladin (Concentration, up to 1 minute)."
7. **Disadvantage-vs-other probe (NPC lane):** Bandit 1 active, target=Bandit 2, attack chip `+3` (mc-dice-link) → log roll `{rolls:[9,3], mode:"disadvantage", targetName:"Bandit 2"}`; popup "d20 9, 3 → 3 +3 … Disadv (conditions)". Consumers: `conditionEffects.js:380` → `combineAttackModes` dis++ when `targetName !== attacksOtherDisadvantageSource` (`conditionEffects.js:864`), folded in `MonsterCardModal.jsx:2110`.
8. **Normal-vs-caster probe:** target= ElderPaladin → log roll `{rolls:[5,17], mode:"normal", targetName:"ElderPaladin"}`; popup single die "d20 5 +3 (8) vs AC 19", no disadv marker ✓.
9. **Early-end clause (auto, observed):** caster attacks Bandit 2 (longsword) → te removed (`targetEffects:[]`), log `condition removed` "ElderPaladin attacked or forced a saving throw against Bandit 2 instead of the duel target." (`targetResolution.js:73` → `checkCompelledDuelAttackExpiry` → `endCompelledDuel`). Caster concentration record intentionally persists post-end (RAW-adjacent; GM manually releases).
10. **Ally-damage clause (grep-backed):** `applyDamage.js:480 endDuelIfDamagedByOther` wired at `:701` — target damaged by non-caster ends duel (not run live).
11. **Spell-on-enemy clause:** partial — only dominate monster/dominate person/ray rows call `checkCompelledDuelAttackExpiry` (`triggerSpells.js:292,305,318`); generic harmful-spell gate NOT wired.
12. **Unmodeled clauses (grep-backed):** "can't willingly move >30 ft" and "ends if caster ends turn >30 ft away" — no consumers app-wide (no movement/turn-end consumers referencing compelled_duel). GM-enforced advisory.

## Defect detail (deploy-side, not src)

- **Stale prod bundle:** localhost serves Oct 1 dist; `activeConditions` missing-key abort in spellCast execution lane (fixed in src Oct 2, SP-002 twin guard). Any caster with cleared runtime state cannot cast (aborts + burns slot). **Fix: rebuild/redeploy.**
- Minor: save_result log `characterName:"Unknown"` while `description` correct; un-armed single-target casts proceed to "Unknown" save prompt instead of opening a target picker.

## Verdict rationale

Core exact and live: targeted WIS save prompt DC correct, te stamp `{target, effect, source, duration:'concentration'}` exact, disadvantage-vs-others enforced bidirectionally (mode:"disadvantage" vs non-caster, normal vs caster), concentration honored, primary early-end clause auto-fires with canonical log. Gaps (movement/turn-end 30-ft unmodeled, generic spell-on-enemy partial, stale-bundle cast abort requiring pre-stamp workaround) → **PASS-subset**.

## Cleanup

NPCs removed (confirm dialogs accepted), caster badges removed, concentration cleared, `spells:[]` restored disk-verified (incidental wizard-save artifact: `languages` gained "Giant" — Goliath canonical re-derivation), Admin Clear Change Data + Clear Campaign Log → log 0 entries, change-data empty, targetEffects empty. Server untouched.
