# CLA-364 Trance of Order — E2E Retry (Clockwork Sorcery host swap)

**Verdict: PASS-subset.** Feature live and pressable on repurposed host; runtime ledger, buff stamp, refusal/restore lane, and SP semantics verified live. Two spec-deviation defects confirmed live (free-first-use, active re-press gate) plus the known save-damage seam. d20 floor-10 leg code-verified only (no out-of-combat attack seam).

## Path executed (sanctioned repurpose, test-campaign ONLY)
Header verified `test-campaign` at join and on sheet. Backup md5 `b4864b73c460e152689e04d5fdd5008c` → Edit wizard step-6 re-pick Sorcerer (major cleared, select reset to "Select a subclass / major") → step-7 option list **contained Clockwork Sorcery** → trusted Save → disk `subclass: Clockwork Sorcery`, lv20 ≥ lv14.

## Verified legs (own reads, ground truth)
1. **Sheet row post-swap: PASS** — "Trance of Order:" feature row + `automation-badge` "Trance of Order" appear after swap; absent pre-swap (re-confirmed). Press → popup stamp "Trance of Order activated … Attack rolls against you can't benefit from Advantage. D20 tests treat 9 or lower as 10." + runtime `tranceOfOrderActive=true`. Duration: popup says 1 minute; **no visible clock/countdown badge** (badge is static text) — minor UI gap.
2. **Resource semantics: DEVIATION (defect A)** — first press consumed 5 SP (sorceryPoints 20→15) and logged "restored and activated … spending 5 Sorcery Points". Spec: first use is the free 1/LR use; 5 SP only restores an expended use. Root cause: `tranceOfOrderHandler.js:18-19` — on newly-granted feature `tranceOfOrderUses` initializes to 0 (not 1) via resource tracking, so `active` false → restore lane taken on first press.
3. **Second press while active: DEVIATION (defect B)** — popup "activated (5 SP spent)" again; **no already-active gate** in handler (`tranceOfOrderHandler.js` has no active-state check before re-running). Repeated presses drain SP.
4. **Refusal text captured (restore lane)** — at 0 uses & <5 SP path exists: "Trance of Order has no uses remaining. Recharges on a Long Rest, or you can spend 5 Sorcery Points to restore." (handler:52). SP≥5 restore lane proven live (that's how both presses activated). LR reset path code-verified `restRules-longRest.js:157`; not exercised live (no LR UI pressed).
5. **Attack differential / d20 floor: PARTIAL (code-verified)** — sheet exposes no out-of-combat attack-roll button (attacks table is display-only; clicks produced no rolls). Floor seam verified in code: `automationModifiers.js:133-143` (no_advantage_against + d20_floor_10 gated on trance_of_order_active), `d20RollComputation.js:189` (r≤9→10), `useLoggedDiceRollAttack.js:373`. No live enemy-advantage differential run (would require full EB Bandit combat; Bandit join not needed for cheap-version leg per retry brief).
6. **Known gap re-noted** — `handlePlayerSaveDamage.js:218` hardcodes `isTranceOfOrderActive: false`: holder save-prompt rolls will NOT apply the floor-10 leg. Unfixed.

## Defects for fix (all handler-side, no data issues)
- A: first free use skipped (uses init 0 + `null→usesMax` default never reached) → first press spends 5 SP.
- B: no gate on re-press while active → SP drain.
- C: `handlePlayerSaveDamage.js:218` hardcoded false (pre-existing).

## Cleanup proof
- **Byte-exact restore**: after wizard reverse-swap to Aberrant Sorcery + tab close, `md5 AberrantSorcerer.json = b4864b73c460e152689e04d5fdd5008c` = backup md5 (byte-identical; subclass back to Aberrant Sorcery).
- **Admin clear + GET-verify**: POST `clear-change-data` → `{"message":"Change data cleared"}`; POST `clear-log` → `{"message":"Campaign log cleared"}`; GETs return not-found and `data/` dir confirms both files gone; `grep -ri trance` over campaign dir: zero hits (sole HexWarlock.json hit is pre-existing, untouched).
- Tab closed; no selection persists.
