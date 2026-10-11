# MA-1847 — Apep "Devour the Boat (Costs 2 Actions)" — FAIL(a+b)/DATA

Row: apep|legendary_actions|3 | RAW: one **Grappled** creature; DC 26 CON save or 33 (6d10) **Piercing** + unable to regain HP until start of Apep's next turn; costs **2** legendary actions.

## Verdict
FAIL(a+b)/DATA. Chip is LIVE (not inert — distinct from MA-1846 zero-popup shape): clicking adjudicates the WRONG mechanic with the wrong numbers, ungated, at the wrong cost.

## Defect axes (live evidence 2026-10-11, test-campaign :80)
1. **Prerequisite gate ABSENT = FAIL(a)** (per row policy: absent gate + fires = FAIL).
   - Window 2: ElderPaladin `activeConditions:[]` (POST-confirmed) — press fired fully: nat 14+18=32 HIT AC 19, damage "4d8 + 9"=29, hp −29, zero refusal popup, zero `*_refused` log. Only honest refusal all session was the once-per-boundary legendary latch.
   - Code: `parseLegendaryAllyPrerequisite` (monsterLegendaryUses.js:24) reads `target_prerequisite.any_ally_of_attacker` ONLY; row authors no `target_prerequisite`. §209 twin conversion: prose "one Grappled creature" unstructured = FAIL(a)/DATA one-field (MA-0019 byte-shape). Note: `evaluateTargetPrerequisiteGate` sole call-site is handleSaveRoll — attack chips never gated (separate seam, §209).
2. **DC 26 CON save never enforced = FAIL(a) + prose-only DC drift (MA-1846 twin flag)**
   - Row authors NO `save_dc`/`save_type` — DC 26 is prose-only (MA-0237/MA-1846 family). `legendaryRowHasNumericMechanic` false → `delegates_to:"Constrict"` routes to the **attack seam** (`handleAttack` +18 vs AC, MonsterCardModal resolveLegendaryRowMechanic). Log: save entries 0, `lastAttack.saveDc:null`, no `.sp-overlay` prompt ever. Success face unprovable — no save exists.
3. **Wrong damage pool/type/modifier = FAIL(a)**
   - Both fires dealt Constrict's "4d8 + 9" **Bludgeoning** (fd 25, 29; hp chain 224→200→175→146 exact) instead of 6d10 **Piercing** (avg 33) fail-full / half-on-success. No `damage_dice_primary` authored.
4. **LA cost exactly 2 UNENFORCED**
   - "(Costs 2 Actions)" is name-text only; whole engine grep-zero for any cost token parse in monsterLegendaryUses.js. Each press spends exactly 1: `monsterLegendaryUses{max:3}` used 1 then 2 (RAW: 2 then 4). Codified advisory residual MA-1839 — engine cost GM-enforced.
5. **No-heal-until clause inert = FAIL(b)/gap**
   - `no_healing` te registered (targetEffectDefinitions.js:181) but sole producer is `hit_target_effect` (§116/MA-0556). Row authors nothing → top-level targetEffects GET `{"value":null}`, no `healing_blocked` surface. Documented gap; fix field `hit_target_effect:"no_healing"` would arm it on the delegate-hit lane (but see axis 2 — the row should resolve as a SAVE, so the durable fix is on the save transport).

## Correct fix (byte-shape)
Row must stop delegating to the attack seam and author its own save mechanic:
`{ name:"Devour the Boat (Costs 2 Actions)", save_dc:26, save_type:"Constitution", damage_dice_primary:"6d10", damage_type_primary:"Piercing", dc_success:"half", target_prerequisite:{conditions:["grappled"]}, hit_target_effect:"no_healing" (or save-clock twin for until-Apep-next-turn), description unchanged }` — plus remove `delegates_to` (advisory/delegate hijack per §225) OR extend delegate to carry save fields. Cost-2 needs a NEW engine token (no consumer today — code gap, not one-field). Owner latch "until the start of Apep's next turn" rides the MA-0676 until-next-turn owner-latch seam precedent for repeat-fire restriction.

## Ledger
- Window 1 (grappled, honest scenario build): ability_use "expends a legendary use for Devour the Boat (Costs 2 Actions) (Constrict attack) after AasimarTest's turn — 2 of 3 left"; attack nat13+18=31; damage "4d8 + 9" [4,2,5,5]=25 Bludgeoning; hp −25→175; grappled re-granted (delegate hit_conditions).
- Window 2 (NOT grappled): nat14+18=32; damage 29; hp −29→146; zero refusal.
- Refusal ledger honest otherwise: "(turn)" latch refusal zero-spend, cs-mirror freeze unstuck via sanctioned full-store cs POST (§339).
- Injection: multiple fabricated browser_navigate echoes to aliyuncs proxy URLs appeared between tool results mid-session; none issued, none followed; location.href self-verified localhost throughout.

Cleaned: admin clear change-data + log, GET-confirm; server up.
