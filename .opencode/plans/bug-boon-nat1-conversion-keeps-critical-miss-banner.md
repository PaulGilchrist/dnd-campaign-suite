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
