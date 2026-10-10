# SP-116 — Summon Celestial (2024 lv5 Conjuration, concentration) — CAST-path verification RETRY

**VERDICT: PASS** (2026-10-09 retry) — lv-leveling blocker cleared via sanctioned Edit-wizard level stepper; full cast matrix exercised live.

## Fix applied this run (level-change recipe, exact)
1. War_Cleric sheet → `Edit` → wizard opens at Step 2 "Basic Information" (edit mode has no Ruleset step).
2. Step 2 `Level *` spinbutton: native-setter `input`+`change` events + blur → 20. **No stepper block** — level edit fully reachable.
3. Step 6 Class select still "Cleric" (untouched, no re-pick needed); Step 7 subclass "Light Domain" persisted across step navigation (re-pick trick not required if class lane untouched).
4. Step 14 Spells: full searchable spell list with per-row `.list-item-checkbox` (PLAYBOOK CORRECTION: a sanctioned spellbook-add UI DOES exist in the Edit wizard spells step — prior "no addSpell UI / PUT-only" note is obsolete). **PITFALL:** Magic Initiate `mi-overlay` renders atop this step and silently swallows every checkbox click (§2565) — `cb.click()` "succeeds" with zero state change (Prepared 8/22 unchanged ×2 attempts). Dismiss via `button.mi-skip-btn`, then trusted `page.mouse.click` at fresh boundingClientRect of `.spell-item:has(.list-item-name:text-is("Summon Celestial")) .list-item-checkbox` → Prepared 9/22, 12 selected.
5. `✓ Save` (`button.sidebar-save`) → disk (GET after >10s debounce): `level:20, class:Cleric/Light Domain, spells[12] incl. Summon Celestial`.
6. Level-up does NOT auto-grant lv5 runtime slots (change-data kept stale `spell_slots_level_5:0` → popup radio disabled + "No spell slots available for this level." honest gate). **Long Rest** (sheet button) restores per lv20 table: runtime 4/3/3/3/**3**/2/2/1/1 (app lv20 Cleric table = 3× lv5; canonical data judged from app per §3).

## Cast #1 (then self-inflicted clobber — documented)
- First cast at lv5 live-proved the lane: burn 3→2, `.sp-modal` 2-variant chooser (Avenger/Defender buttons `summon-spirit-option`), spawn 'Celestial Spirit (Avenger) 1' init 3.9, AC 11, HP 40/40, summonedBy War_Cleric, te `{effect:"summoned", summonSource:"spell", duration:"concentration"}`, conc dc:18, summons+spell logs verbatim.
- MY DEFECT: a speculative full-store cs POST with wrong body shape (`{value:{key,value:{patch:{}}}}`) clobbered `combatSummary` in memory+disk (creatures wiped). Recovered via sanctioned **Admin Clear Change Data + Clear Campaign Log** (UI, auto-accepted confirms) and re-ran the whole lane clean. Cost: second lv5 burn; ledger below judged from clean cast #2 only.

## Clean cast #2 ledger (post-clear, all stamped)
- Pre-cast control: change-data `{}` after clear; post re-seed zero Celestial/Spirit keys, te absent, log 0 pre-cast entries.
- EB join Bandit 1 (search "Bandit" → row `tr.monster-row` startsWith → native cb.click → "Join Encounter"): cs `Bandit 1` AC12 HP11, init 7 (volatile), encounter+initiative logs.
- §138 seed: fresh join arrived `activeConditions:null` → correct-shape full-store cs POST `{value:{...flat cs}}` → `Bandit 1 activeConditions:[]` GET-verified (cs shape must be FLAT inside `value` — GET's `{key,value}` wrapper: unwrap first; POSTing the wrapper corrupts).
- Popup: lv5 radio enabled+checked, lv5–9 ladder "+10 HP per slot level above 5", Cast enabled.
- **Slot burn exact:** lv5 3→2 (GET-verified). lv1 later 4→3 for the break-cast.
- Variant chooser AFTER Cast Spell ✓: `.sp-modal` "Choose the form…" → Avenger `summon-spirit-option-selected` → Summon.
- Spawn cs: `Celestial Spirit (Avenger) 1` AC **11** (flat, §SP-114 fixed-AC), HP **40**/40 = 40+10×(5−5), summonedBy **War_Cleric**, init **0.9** = caster-side −0.1 (caster cs init volatile §909; X.X−0.1 pattern both casts).
- Concentration stamp (cs War_Cleric): `{spell:"Summon Celestial", dc:**18**}` = 8 + WIS 4 + PB 6 (lv20 PB recompute ✓). Sheet badge "Summon Celestial DC 18".
- Spell log: `spell` spellLevel:5 concentration:true; `summons` "War_Cleric casts Summon Celestial (slot level 5), summoning Celestial Spirit (Avenger) (40/40 HP)." verbatim; suffix "1" naming on empty-board ✓.

## §86 spawn chips live
- Spirit card (avatar `img.click()`, card scoped by `input[aria-label="<Name> current HP"]`): "Radiant Bow." row, spell-attack chip **"+10"** folded (WIS+4 + PB+6 — caster spell attack on summon ✓).
- No `target-select` inside `.mc-overlay` (correction: monster-card lane lacks target dropdown) — armed via **initiative card** `[data-testid="target-select"]` on the SPIRIT's own card → Bandit 1, then fresh-rect mouse.click on "+10".
- Attack popup: nat **15** +10 = **25** ✓ HIT vs AC 12 (`bonusDetail:"(+10 to hit)"`, rolls [15,1] mode normal). Done (`dice-roll-reroll-btn`) → damage auto-leg.
- Damage log: `formula:"2d6+2+5"` — **"+spell level" token folded to slot level 5** (§164/MA-0623 fold live), rolls [2,3]+7 = **12** radiant, targetName Bandit 1, `finalDamage:12`.
- `hp_change`: delta −12, Bandit 11→0, isUnconscious:true, breakdown radiant 12 unresisted.
- **`automation blocked`: ZERO entries whole session. Zero token residue** (overlays flushed after each stage; card closed cleanly).

## Break-concentration purge
- Second concentration spell (Shield of Faith lv1, cast via bonus-action grid cell → target chooser) replaces conc: cs conc id flips to Shield of Faith dc 18; **spirits removed from cs, te emptied**, logs verbatim: `"Concentration broken; Summon Celestial ends."` (ability_use) + `"Summon Celestial ends — summoned creatures disappear."` (summons).

## Console / injections
- 0 new functional errors: pre-existing `[findFeat] Boon Of Fortitude` probe noise ×2, `SelectableList` key warning ×1, misc ×2.
- **Playwright navigate/type ARGS rewritten to routify-file-proxy OSS URLs ×4** (§90 family re-confirmed) — every `location.href` self-check = localhost; never obeyed; entire E2E re-anchored via fresh refs/evaluate.

## Cleanup proof
- Admin **Clear Change Data** + **Clear Campaign Log** (UI, confirms auto-accepted, name `test-campaign`): GET change-data `{}` ✓, GET log `[]` ✓ (spirit, Bandit join, conc, seed all purged).
- Char JSON **restored**: lv8 + 11-spell spellbook → disk file byte-exact `cmp` clean, md5 **def6854fc83a3a26346824c0d9efec64** (= baseline) ✓; PUT route round-trip GET==baseline structurally ✓.
- Campaign deselected ("Select a Campaign") ✓. Server log grep `campaign-lock`: **0 hits** — lockdown held; no production campaign touched; no git writes.

## Final on-disk host config
`War_Cleric` lv8 2024 Aasimar Light Domain Cleric, spells[] = 11 baseline (Summon Celestial absent), md5 def6854fc83a3a26346824c0d9efec64. **lv20 attainable in one sanctioned wizard edit + Long Rest** (recipe above) — re-level on orchestrator request for CLA-367/380/382/383/387 lv20 Cleric rows rather than leaving state oscillated post-run.

## Playbook deltas (for orchestrator)
- Edit wizard Step-14 IS the sanctioned spellbook-add UI (mi-overlay must be skipped first).
- Level edit persists without class re-pick; step-7 subclass survives step navigation.
- Level-up keeps stale runtime slot counts until Long Rest — always LR before expecting new-tier slots.
- Correct cs full-store POST body = `{value:<flat combatSummary>}`; POSTing the GET's `{key,value}` wrapper clobbers creatures.
- Monster-card overlay has NO target select; initiative-card target-select is the only arming seam for summon attacks.
