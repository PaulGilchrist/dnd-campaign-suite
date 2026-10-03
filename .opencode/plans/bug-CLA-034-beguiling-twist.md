# Bug CLA-034 — Beguiling Twist (FAIL)

Campaign: test-campaign · Host: FeyRanger (2024 Ranger lv17, subclass set Beast Master→**Fey Wanderer** via Edit wizard) · Date: 2026-10-03

## Canonical data (quoted)
public/data/2024/classes.json → classes[7] Ranger → majors[1] **Fey Wanderer** → features[2], level **7**:

> "Advantage on saving throws to avoid/end Charmed or Frightened. When you or creature within 120 feet succeeds on save vs Charmed/Frightened, take Reaction to force **different creature** within 120 feet to make Wisdom save (**your spell save DC**) or be Charmed/Frightened **for 1 minute**."

automation array:
- `{type:"conditional_advantage", target:"saving_throw", condition:"charmed", effect:"advantage"}`
- `{type:"conditional_advantage", target:"saving_throw", condition:"frightened", effect:"advantage"}`
- `{type:"reaction_save", trigger:"save_success_charmed_frightened", saveType:"WIS", saveDc:"spell_save_dc", condition:"charmed_frightened", duration:"1_minute", range:"120_ft", casting_time:"1 reaction", target:"different_creature"}`

**No uses/recharge in data → unlimited is RAW-correct** (no once-limit defect; re-fire after fresh qualifying trigger worked). Ranger `spell_casting_ability` = "Wisdom" → holder DC = 8+WIS3+PB6 = **17**.

## What works (verified live)
- Reaction row on holder sheet; trigger gate honest: refusal popup with no/empty/non-qualifying lastAttack ("No recent save against Charmed or Frightened found") ×2 (empty + post-DEX-success).
- Qualifying trigger read: campaign-root `lastAttack {rollType:"save", saveResult:"success", saveConditions:["frightened"], attackName:"2. Fear Ray"}`.
- Redirect loop live: picker → confirm → victim sp-modal WIS save → FAIL(11 vs DC) → change-data `Bandit 1.activeConditions:["frightened"]` + ability_use + save_result logs ("…frightened for 1 minute.").
- Advantage applied when ALREADY frightened (gazer Fear Ray re-save): popup "d20 (2, 10) + 3 (Advantage)", log mode:'advantage'.

## Defects (all live-captured)
### (1) Wrong save DC — CHA hardcoded, data says spell_save_dc (WIS for Ranger)
- beguilingTwistHandler.js:88-90: `const chaBonus = getAbilityModifier(playerStats.abilities, 'CHA'); const saveDc = 8 + chaBonus + prof;`
- Live: picker prose, victim sp-modal, and logs all show **DC 13** (8 + CHA−1 + PB+6). Correct spell_save_dc for this holder = **DC 17** (8 + WIS+3 + PB+6; sheet saves WIS +3 row, Hunter's Mark DC17 precedent). Affects every Ranger holder whose CHA ≠ WIS.

### (2) "different creature" gate absent
- Handler passes `targets: allCreatures` unfiltered and never threads the triggering saver into the picker; the triggering creature **FeyRanger herself** was listed ("16 available") and Force Save produced her own prompt: sp-modal "FeyRanger must make a WIS saving throw. DC 13" + log `ability_use "FeyRanger used Beguiling Twist — FeyRanger must make WIS save (DC 13)…"`.
- Data `target:"different_creature"` inert. (120 ft band likewise never consulted — gridless family, recorded advisory §147/§190 pattern.)

### (3) Advantage semantics wrong in both directions
- **Avoid half broken:** fresh Fear Ray save while NOT yet frightened = single die, **mode:"normal"** (log rolls:[20] mode:'normal') — expected 2d20 advantage "to avoid".
- **Over-grant:** SavePromptModal.jsx `modifierListGrantsAdvantage` :99 `if (mod.condition && conditionSet.has(mod.condition)) return true;` keys off ACTIVE conditions only, ignoring the save's own ability/condition → Beguiling Twist granted advantage on an unrelated **DEX** Frost Ray save (log name:"3. Frost Ray" mode:'advantage' rolls:[5]).

### (4) Duration "for 1 minute" never enforced (CLA-033(a) fingerprint)
- CharReactions.jsx:741 `addExpiration` omits `rounds` → change-data `{target:"Bandit 1", effects:[{type:"condition",condition:"frightened"}], appliedRound:1, expiryRounds:null, expireOnCreatureName:null}` → frightened never auto-expires. saveAttackHandler.js:155 / clearExpirationEffects.js:411 10-round precedent unused.

## Repro recipe
1. test-campaign; Edit FeyRanger wizard step-7 → Fey Wanderer → Save.
2. EB Join (adds whole roster + monsters); reload; Gazer 1 card Target=FeyRanger → press "DC 12 Wisdom" chip #2 ("2. Fear Ray").
3. sp-modal Roll Save → first save single d20 mode:normal (defect 3); fail/refire until success → lastAttack qualifies.
4. FeyRanger sheet → Reactions "Beguiling Twist" → picker shows self (defect 2), prose "DC 13" (defect 1) → Force Save target=Bandit 1 → fail → frightened granted, expiryRounds null (defect 4).
5. Grant frightened via initiative-card Add → ea-modal Frightened → Apply; refire ray → "d20 (a, b) … (Advantage)"; press Frost Ray chip → DEX save also shows "(Advantage)" (defect 3 over-grant).

## Registry
- docs/test-character-registry.json FeyRanger: subclass **Fey Wanderer lv17 PERMANENT** (was Beast Master) — retest-ready host post-fix; CHA 9/−1, WIS 16/+3, PB+6 = DC discriminator.
- Monsters: Gazer 1 (Fear Ray DC12 WIS frightened; Frost Ray DEX), Bandit 1 redirect victim.
