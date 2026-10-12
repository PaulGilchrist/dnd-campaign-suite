# BUG MA-1952 — Nidhogg "Grave Gale (Costs 2 Actions)" delegate resolves Corpse Wind's CON 12d10 instead of its own prose STR 4d8

**Verdict: FAIL(a)** — wrong dice/save-type vs this row's description (axis B). Affordance and economy are LIVE (not FAIL(b)/silent-burn): chip presses resolve a real save, spend exactly 2, and refuse "(turn)" honestly.

## Row
- id MA-1952 · `nidhogg|legendary_actions|3` · actionType save
- actionName: "Grave Gale (Costs 2 Actions)" · `delegates_to: "Corpse Wind (Recharge 5-6)"`
- Prose (authors the mechanic): "one creature within 60 ft. must succeed on a **DC 24 Strength** saving throw or take **18 (4d8) Necrotic** damage and be pushed 30 ft."
- Child row carries NO numeric fields (save_dc/save_type/damage_dice_primary absent).

## Live evidence (test-campaign, dev :5173, 2026-10-11)
- Press #1 (fresh join-pre-stamp boundary, victim EB Bandit 1 999/999 rig): chip `.mc-dice-link-legendary` on "Grave Gale" row fired immediately — popup header **"Corpse Wind (Recharge 5-6)"**, formula **12d10 = 70**, raw d20 17+0 FAIL vs DC 24, hp −70 (999→929). Machine truth `lastAttack.saveType:"Constitution"`, `saveDc:24`, `rawDamage:70`, attackName "Corpse Wind (Recharge 5-6)".
- Spend ledger exact: `monsterLegendaryUses {max:3, used:2}` → log "spends 2 legendary uses for Grave Gale (Costs 2 Actions) (Corpse Wind (Recharge 5-6) save) … 1 of 3 left" (MA-1883 cost parse honest; MA-1948 recharge name-text inert — no recharge interaction, as expected).
- Press #2 same-turn boundary → "Only one legendary action can be expended immediately after each creature's turn. Nothing spent, no roll." + `legendary_use_refused (turn)`, uses frozen at used:2 ✓.
- Owner-turn regain: round-2 walk → uses reset 0/3 ✓ (self-heal per MA-1949).
- Press #3 (round 2 legal boundary after cs full-store unstick-to-truth, victim ElderPaladin): second spend −2 → "1 of 3 left"; `.sp-modal` chrome verbatim: **"ElderPaladin must make a CONSTITUTION saving throw. DC 24. Half damage on successful save."** — the row's prose says STRENGTH. EP d20 7 +10 (+5 mod +5 aura) = 17 FAIL → full **12d10 = 65** (224→159). Success-half leg is live at this seam but rides the master's 12d10 pool (half of ~66, never the authored half of 4d8 ≈9).
- 0 console errors (delegation resolves — MA-0510/1944 silent-burn family ruled out).
- Push 30 ft: advisory-inert as anticipated (push te is save-picker-only + "push(ed) up to" regex, §101/§115; §70 no-consumer list) — documented gap, NOT the fail driver.

## Root cause (grep orientation, file:line pre-press)
- `MonsterCardModal.jsx:744-749` `legendaryRowHasNumericMechanic`: child has no attack_bonus/save_dc; prose fallback `extractDamageDiceFromDescription` misses "or take 18 (4d8)" — regex at `MonsterCardModal.jsx:934-939` requires a `Hit|Failure|Success:` prefix Grave Gale's prose lacks → child judged non-numeric.
- `MonsterCardModal.jsx:895-905` → `legendaryDelegateMechanic` (`:841-846`) → `legendaryDelegateChooserAction` (`:723-742`, master has no variants → returns delegate verbatim) → mechanicAction = Corpse Wind row.
- `MonsterCardModal.jsx:754` save leg: `handleSaveRoll(delegate, extractDamageDiceFromDescription(delegate.description, delegate.damage_dice_primary)=\"12d10\", …)` → DC24 **Constitution 12d10** enforced. No prose-DC/prose-save-type extractor exists on delegate children (playbook §6: prose fallback covers attack-bonus "+N to hit" only — MA-0237/0318/0328/0362 family). This is the §5 fingerprint: "prose spellcast child needs NUMERIC spell fields copied (delegates_to misfires through save leg)."

## Numbers drifted
- save_type: **Strength → Constitution**
- damage_dice: **4d8 (avg 18) → 12d10 (avg 66)** — ~3.7× overkill; popup applied 70/65 live where RAW max is 18.
- DC 24 matches only by coincidence (both rows authored 24).
- Area: one creature → (picker semantics inherit Corpse Wind's per-target leg; single-target press observed).

## Proposed DATA fix (MA-05xx template — never edit via app; manifest untouched here)
Copy the row's own numeric truth onto the legendary child in `public/data/monsters.json` (nidhogg.legendary_actions[3]):
```json
"save_dc": 24,
"save_type": "Strength",
"damage_dice_primary": "4d8",
"damage_type_primary": "Necrotic",
"dc_success": "half"
```
Keep `delegates_to` (or drop it — with numeric fields the child self-resolves via `legendaryRowHasNumericMechanic` BEFORE the delegate leg at :895; byte-inert for the economy). MA-1898/1901 Garmr save-row data-fix twin. After edit: `fetch(cache:'reload')` proof + EB remove/re-join (stale snapshots, §21).

## Cleanup
Admin clear-change-data + clear-log → cd {} / log [] verified quiet. No manifest edits, no git writes.
