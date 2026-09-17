# BUG MA-0375 — Beholder "Legendary Action Uses: 3 (4 in Lair)" (legendary_actions header, other) — FAIL

## Verdict
FAIL — legendary-uses economy DEAD (no counter, no spend, no refusal, no recovery) and children inert. Root cause = DATA authoring: header row lacks numeric `uses` field (MA-0092/MA-0217 fingerprint, playbook L525). Consumers exist and are live for other monsters; Beholder data never reaches them.

## Data (disk truth, public/data/monsters.json → Beholder.legendary_actions)
- [0] header: keys = name, description ONLY. **No `uses` numeric field.** "3 (4 in Lair)" is name-text only.
- [1] "Chomp" — "The beholder makes two Bite attacks." — prose; no attack_bonus, no dice, no delegates_to.
- [2] "Glare" — "The beholder uses Eye Rays." — prose; no numeric fields.
- NO Cantrip / Wing Attack children authored at all (manifest children guess unmatched — actual children = Chomp, Glare).

## Code grep (why inert)
- `legendaryHeaderAction()` (src/services/encounters/monsterLegendaryUses.js:153-157) returns row[0] only if `uses != null` → **null** for Beholder.
- MonsterCardBody.jsx:54-58: falsy legendaryHeader → plain `MonsterActionSection` branch — no `headerRow` counter, no `legendaryGate` prop.
- MonsterAction.jsx:157-158: `LegendarySpendLink` returns null when no legendaryGate; Chomp/Glare carry no attack_bonus/save_dc/dice → zero affordance (MV-17 family).

## Live proof (test-campaign, header verified "test-campaign" post-select and at Admin)
- EB "Beholder" exact → Join → cs: "Beholder 1" ac18 hp190/190 idx0 init3 (curl-verified). Armed ElderPaladin ac19 hp224/224; Beholder 1 targetName=ElderPaladin (curl-verified, survived probe).
- Card opened (initiative avatar click): Legendary Actions heading renders header text exactly ("Legendary Action Uses: 3 (4 in Lair). Immediately after another creature's turn…") + Chomp + Glare — as plain `mc-action` text rows.
- DOM probe: `.mc-legendary-counter` = false; `.mc-legendary-header-row` = false; `.mc-dice-link-legendary` count = 0; clickables inside header/Chomp/Glare rows = 0 each.
- Decisive control probe (MV-17/L525 recipe): forced `el.click()` ×4 on Chomp/Glare in one window (>max would require refusal after 3) — ALL four silently fire-free: zero popup, zero refusal, zero log gain (log stayed 2 entries: encounter joined + initiative roll; zero `ability_use`, zero `legendary_use_refused`).
- change-data sweep after probes: keys = combatSummary/__campaign__/__map__/AasimarTest/activeCreatureName/combat-ui-viewingMonster* — **`monsterLegendaryUses` key never created**.
- Spend 3→2: impossible (no counter). Refusal at 0: absent (no gate). Recovery at own-turn-start: dead — `regainLegendaryUses` (turnStartEffects.js:176) is never reached without header `uses`; no regain log producer reachable.
- "4 in Lair" advisory: unstructured, no lair toggle anywhere — gap note only, consistent with precedent (playbook L404 residual).

## Fix pattern (per MA-0227 precedent, line 545)
Author header `uses:3` on Beholder legendary_actions[0] and make prose children exercisable in the SAME pass: Chomp → `delegates_to:"Bite"` (numeric Bite +8 exists in actions); Glare → numeric save fields copied from Eye Rays block (DC16, dc_success per-ray) — prose-only children burn uses silently otherwise (MA-0164 silent-burn warning does NOT apply here since rows can't even be clicked without the gate, but the same single-pass rule prevents half-fixes). Do not encode "(4 in Lair)" until a lair toggle consumer exists.

## Cleanup
Admin native confirms both naming "test-campaign"; curl verified change-data `{}` and log `[]`. No data/manifest/docs edited outside .opencode/plans/.

VERIFIED: FAIL
