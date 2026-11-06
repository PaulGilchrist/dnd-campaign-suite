# Boon of Combat Prowess converts a natural-1 critical miss but the popup keeps showing "CRITICAL MISS!" alongside "✓ HIT"

## Summary
On a 2024 host, Boon of Combat Prowess offered on a **natural 1** attack roll converts the miss to a hit ("Fearless Aim"), but the converted popup renders `CRITICAL MISS!` and `✓ HIT (12 vs AC 19)` **at the same time**. This is the exact mirror of the banner-vs-outcome contradiction that `e923a05ef` (Stroke of Luck crit) just fixed on the stroke lane: the popup announces one verdict while the resolved outcome is the opposite. The persisted/ledger side is honest (damage single pool, `isCrit:false`); the defect is display copy on the converted face.

## Steps to reproduce
1. In `test-campaign`, ensure a 2024 lv20 character holding the `Boon Of Combat Prowess` feat exists — fixture `Disciplined_Monk` already has it (feats list in `public/campaigns/test-campaign/Disciplined_Monk.json`).
2. Start a combat board containing the monk and a target (Encounter Builder join, or the hand-rolled combatSummary full-store POST rig, playbook §2).
3. Open Disciplined_Monk's sheet, arm the target (`targetName` on the monk's combatSummary creature record, e.g. via scoped PATCH).
4. Click the `Quarterstaff` attack row (`.attacks div.left.clickable`) repeatedly until the MISS popup shows a **natural 1** (`d20 1 +11`), which renders `CRITICAL MISS!` plus the ` Boon of Combat Prowess` button (leading space in label).
5. Press ` Boon of Combat Prowess`.
6. Observe the converted popup.

## Expected behavior
One consistent verdict on the converted face: with the boon applied there is no miss banner (compare: converting a *non*-nat-1 miss shows `✓ HIT …` with no leftover miss/crit-miss banner — ledger `AttackResultPopup.stroke-of-luck-crit.test.jsx` and live face the same session). If the team rules that Fearless Aim must NOT apply to a nat-1 auto-miss, then the button should not be offered at all on a critical miss; either way the current contradictory state is wrong.

## Actual behavior
Converted popup innerText:

    Quarterstaff
    12
    d20 1 +11 (+11 to hit)
    Advantage
    Disadvantage
    CRITICAL MISS!
    ✓ HIT (12 vs AC 19)
     Boon of Combat Prowess: Miss converted to Hit
     Done
    click to dismiss

`CRITICAL MISS!` and `✓ HIT` render simultaneously. Damage then applies non-crit (`1d6+5: 5 +5` = 10, log `roll` row `isCrit:false`, formula `1d6+5 [bludgeoning]`), and `campaign.lastAttack` persists `hit:true, missConverted:true, convertedBy:"Boon of Combat Prowess", d20:1`. Ability_use copy is correct: `Disciplined_Monk used Boon of Combat Prowess on Quarterstaff: d20 1 + 11 = 12 vs ElderPaladin — Miss converted to Hit.`

No console errors; the contradiction is purely the fumble notice surviving the conversion.

## Likely location
Confident (display layer): `DiceRollResult.jsx` `CritNotices` renders `{showFumble && … "Critical Miss!"}` — `showFumble` is derived from the original `d20 === 1` face and is never suppressed when `missToHitApplied` flips the outcome. The stroke fix touched the same component family (`e923a05ef` added `convertedNat20` suppression for the `Natural 20!` face) but not the fumble notice. The popup content path is `AttackResultPopup.jsx` → `DiceRollPopupContent` → `DiceRollResult`; `missToHitApplied` state already lives in `AttackResultPopup.jsx`.

## Suggested fix
Follow the e923a05ef pattern: thread a suppression flag so that when a miss→hit conversion is applied (`missToHitApplied` on the popup), the `Critical Miss!` notice is not rendered (e.g. compute `showFumble` to `false` on the converted face, or gate the notice on `!missToHitApplied` in the popup path). Also decide (owner ruling) whether Fearless Aim should be offered on nat-1 auto-misses at all — the app's authored copy (`public/data/2024/feats.json`, "When you miss with an attack roll, you can hit instead.") has no nat-1 carve-out, so offering it is defensible; the double banner is not.

## Severity
Minor UX issue — display-copy inconsistency on an edge-case face (nat-1 + boon). No state or damage corruption observed; the ledger and persisted records are honest.

## Owner ruling (2026-11-06, DF+ session)
**Allow the conversion; fix the banner.** Fearless Aim legitimately applies to natural-1 auto-misses (the authored copy has no nat-1 carve-out) — the defect is purely that `showFumble` survives the miss→hit conversion. Fix target: suppress the "Critical Miss!" notice on the converted face (mirror of the `convertedNat20` suppression pattern in `e923a05ef`), keeping the no-boon nat-1 face byte-unchanged.

## Resolution

**FIXED 2026-11-06 (subagent fix-run).** The "Likely location" proved correct against the real code.

**Root cause (verified):** `DiceRollResult.computed.js` computed `showFumble = isNatural1 && rollType === 'attack'` — gated only on the original d20 face. The FT-007 miss→hit conversion channels (host `AttackResultPopup` `missToHitApplied` prop and the standalone `boonUsed` offer-click state, both already authoritative in `computeComputedHit`) never fed into `showFumble`, so `CritNotices` kept rendering the "Critical Miss!" banner on the converted face beside "✓ HIT". No popup-threading changes were needed — `missToHitApplied` already arrives as a prop; no new event types or architecture.

**Fix (display layer, ruleset-agnostic — covers both the 2024 and 5e boon twins with one gate, per playbook §3 the boon is non-crit conversion in both):** in `src/components/char-sheet/DiceRollResult.computed.js`, hoisted `const missToHitConversion = missToHitApplied || boonUsed;` and gated `showFumble` on `!missToHitConversion` (the same expression `computeComputedHit` already uses, now shared). Unconverted nat-1 faces pay nothing: without a conversion the gate is byte-identical to the old expression. Side benefit: a stroke-of-luck press on a nat-1 in the popup lane (which also sets `missToHitApplied`) no longer pairs "Critical Hit!" with a surviving "Critical Miss!".

**Files changed:**
- `src/components/char-sheet/DiceRollResult.computed.js` — fumble suppression on the converted face (3-line logic change + comment).
- `src/components/char-sheet/DiceRollResult.boon-nat1-fumble.test.jsx` — NEW regression ledger (6 tests), modeled on `AttackResultPopup.stroke-of-luck-crit.test.jsx`: unconverted nat-1 keeps `Critical Miss!` + `✗ MISS`; 2024 boon press → no fumble banner, `✓ HIT (12 vs AC 19)`, conversion note intact, no crit banner, Done dispatches `isCrit:undefined` (non-crit twin pinned); 5e-host twin same suppression; post-consume roll (flag off at roll time) keeps the banner; non-nat-1 boon face byte-unchanged; standalone `DiceRollResult` `boonUsed` channel suppressed too.

**Live repro (pre-fix, Playwright on :5173, test-campaign, zero-surgery rig):** hand-rolled 2-creature `type:player` combatSummary board (Disciplined_Monk → ElderPaladin armed, sheet AC 19); Quarterstaff row (~55 rolls) → nat-1 MISS popup `d20 1 +11 … CRITICAL MISS! ✗ MISS (12 vs AC 19)` + " Boon of Combat Prowess" button; pressed the boon → converted innerText carried **`CRITICAL MISS!` and `✓ HIT (12 vs AC 19)` simultaneously** (+ "Boon of Combat Prowess: Miss converted to Hit" note) — bug file "Actual" reproduced byte-for-byte.

**Live re-verification (post-fix, same rig):** fresh nat-1 MISS face → `CRITICAL MISS!` + `✗ MISS (12 vs AC 19)` + boon offer **byte-unchanged** (adjacent sanity PASS); pressed the boon → converted face:
`Quarterstaff / 12 / d20 1 +11 (+11 to hit) / ✓ HIT (12 vs AC 19) / Boon of Combat Prowess: Miss converted to Hit / Done` — **no `CRITICAL MISS!`, no crit banner**; Done applied non-crit damage (log damage row `1d6+5 [bludgeoning]`, `isCrit:false`) and persisted `lastAttack {hit:true, isCrit:false, missConverted:true, convertedBy:"Boon of Combat Prowess", d20:1}` over honest originals.

**Test/lint evidence:** new ledger 6/6; touched-family run `npx vitest run DiceRollResult AttackResultPopup` → 29 files / **396/396**; sibling seam run `CharSheet.handlers.miss-conversion` + `CharActions` → 55 files / **619/619**; `npm run lint` → zero warnings. (Boon re-arm mid-verify used the documented scoped-PATCH `combatSummary.round` bump.)

**Cleanup:** Admin-panel "Clear Change Data" + "Clear Campaign Log" (native confirms handled via `browser_handle_dialog`), tab closed, ~12s settle → GET-verified `change-data {}` + `log []` with no rehydration; fixture characters untouched (all rig writes were change-data only).
