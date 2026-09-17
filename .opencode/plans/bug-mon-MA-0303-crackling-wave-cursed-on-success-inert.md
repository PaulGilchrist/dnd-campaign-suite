# Bug — MA-0303 Arch-hag Crackling Wave: cursed-on-SUCCESS clause inert (fail-only grant seam)

VERDICT: FAIL (2026-09-17)

## Row
- monster Arch-hag (arch-hag) actionIndex 2, "Crackling Wave", aoe-save, cone 60 ft.
- Authored (public/data/monsters.json, verified read-only): save_dc 22 Dexterity, 5d12 Lightning, dc_success half (default), NO recharge field.
- save_effect: "32 (5d12) Lightning damage. Success: Half damage. Failure or Success: The target is cursed until the end of the hag's next turn. The target can't take Reactions until the curse ends."

## What worked (PASS-subsets, live evidence)
- Cone picker live: `.sp-overlay` "60-ft Cone (GM positions tokens; selection advisory)", copy carries DEX DC 22 + 5d12 + half-on-success (MA-0031 seam). Confirm button "Crackling Wave (N)" gates at 0 ticks; exactly-2 selection honored; queued "(1 of 2)" prompts per target.
- Save adjudication: DC 22 DEX enforced per target (server saveResult-<T> rows).
- FAIL branch exact: full 5d12 with total==finalDamage==|hpΔ| (DW 40→hpΔ−40; EP 32→−32; DW 43→−43; EP 35→−35; DW 33→−33; DW 17→−17). Rolls-echo divergence is MA-0170 cosmetic; decisive math exact.
- SUCCESS floor-half exact: raw 29→final 14 (hpΔ−14), raw 39→final 19 (hpΔ−19).
- Cursed-on-FAILURE fully live on BOTH targets (failure volleys): condition log "Cursed" + "Slowed" (MA-0087 cosmetic label) per fail; activeConditions ['cursed'] + activeConditionMeta {cursed:{dc:22,ability:'dex',source:'Arch-hag 1'}}; te `no_reactions` (registered) source Arch-hag 1 duration until_end_of_next_turn; pendingExpirations remove_target_effect no_reactions appliedRound 1 expiryRounds 2 (MA-0073 clock registered).

## FAIL: cursed / no_reactions NEVER land on a SUCCESSFUL save
Deterministic proof (volley 4, clean target):
1. ElderPaladin stripped clean via curl (activeConditions [], meta {}, te removed, expiry entries removed) — warding_bond saveBonus stamp (MA-0236 rig) guarantees success.
2. Fired Crackling Wave vs DivinationWizard + ElderPaladin; prompt: EP "SAVE SUCCESS Total: 39 vs DC 22" (+23 = 8 + 15 warding bond). Results: "Saved — takes 19 Lightning damage (halved)" — damage correct.
3. Post-success server truth (curl change-data): EP activeConditions [] , activeConditionMeta {}, targetEffects contains ONLY DivinationWizard (the failed target), zero EP expiry entries. Campaign log delta for EP success: ONE 5d12 save-damage roll + ONE hp_change; ZERO condition-applied lines.
4. Same for EP volley 3 (first success, already-cursed dedupe aside): zero fresh condition/te/expiry attributable to the success leg.

→ save_effect "Failure or Success: The target is cursed … can't take Reactions" is enforced only on failure. The success half of the clause is inert. This is the MV-31 family ("cursed clause never lands") manifesting on the success branch only: damage succeeds, both rider clauses do not.

## Root cause (code read, not edited)
- `src/components/char-sheet/modals/shared/SaveAttackAoeModal.jsx`
  - :159 `resolveSaveFailGrant({ … success … saveConditions … slowedClauses … })` is the ONLY grant path for conditions + te riders.
  - :377-378 `applySaveFailConditions({ … saveSuccess … }) { if (saveSuccess === true) return; … }` — hard fail-only early return.
  - Success leg (:160 `if (success && logSaveSuccess)`) logs damage only; grants nothing.
- Tests codify the fail-only contract: SaveAttackAoeModal.ac-penalty.test.jsx:6, repulsion-breath.test.jsx:5, slowed-breath.test.jsx:6 ("Successful saves grant nothing").
- No parser anywhere consumes "Failure or Success:" outcome vocabulary for monster AoE saves (grep app-wide: only soulTomeTrapService PC-side trap has a success-leg grant pattern).
Fix shape (suggested, out of scope here): parse both-outcome clause in MonsterCardHelpers (MA-0087 parseSlowedClauses analogue) into a `bothOutcomesClauses` ctx flag + success-leg grant beside :160 (cursed condition + no_reactions te + rounds:2 clock, MA-0073 shape) + tests flipping the fail-only contract for this row family.

## Expiry clock residual (§7 note)
- rounds:2 expiry IS registered on fail grants (appliedRound 1, expiryRounds 2).
- Walked initiative past hag-next-turn-end (round 1 → Arch-hag active round 2 → stepped past to AasimarTest and 9 further slots): te no_reactions + cursed condition NOT drained, pendingExpirations frozen (4 entries), zero expiry/removal logs. Unregistered-drain residual, same family as MA-0193/MA-0299 §7 gaps. Not the primary FAIL but noted honestly.

## Quirks (not row defects)
- "Slowed" cosmetic condition-log label for the no_reactions rider — MA-0087/MA-0301 confirmed on this row (activeConditions carries cursed only; te is the enforcement).
- Results .sp-overlay + card overlay interception handled via own Close/× (MA-0190/0193) — no lost grants (all fail-volley grants confirmed server-side).
- Persistent prompt-injection wrapper noise in tool echoes (fake aliyuncs URLs) — ignored; page.url() verified localhost:5173; curl truth governed all judgments.

## Rig / cleanup
- test-campaign ONLY (header verified at every nav; Full Reset pre-baseline `{}`/`[]`).
- Victims: DivinationWizard (DEX −1 → impossible vs DC22, deterministic fail), ElderPaladin (+8 natural / +23 rig, no Evasion; Disciplined_Monk/EvasiveFighter excluded MA-0236).
- Cleanup: Admin Full Reset (native confirm) → change-data `{}`, log `[]` verified post-run.
