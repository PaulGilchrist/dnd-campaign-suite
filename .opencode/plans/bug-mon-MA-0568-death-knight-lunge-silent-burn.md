# bug-mon-MA-0568 — Death Knight Legendary Lunge: silent-burn chip, Dread Blade delegation absent (MA-0511 twin)

**Verdict:** FAIL (b / DATA) — MA-0568, `death-knight`, legendary_actions[2], "Lunge", uses:1.

## Row
`public/data/monsters.json` death-knight.legendary_actions[2]:
`{"name":"Lunge","description":"The death knight moves up to half its Speed, and it makes one Dread Blade attack.","uses":1}` — **no `delegates_to`**, no numeric attack fields. (Disk-ground-truthed 2026-09-19.)

## Defects (re-ground-truthed live 2026-09-19, test-campaign :5173)
1. **Silent burn CONFIRMED:** Lunge's only affordance = `.mc-dice-link-legendary` "Expend Legendary" chip (row audit: chips `["Expend Legendary"]` only; Dread Blade +11 lives in actions row, never rides Lunge). With Bandit 1 AC12 armed, chip fire produced:
   - `monsterLegendaryUses` burn `{max:1, used:1}` — the shared swallowed-header counter (rows[0] Dread Authority uses:1 swallowed by `legendaryHeaderAction`; MA-0566/MA-0510 shape) zeroed by Lunge.
   - `console.error` `[MonsterCardModal] legendary action "Lunge" delegates_to "undefined" — no resolvable mechanic on "Death Knight 1"` (MonsterCardModal.jsx:411).
   - `ability_use` log "Death Knight 1 expends a legendary use for Lunge after AasimarTest's turn — 0 of 1 left".
   - **ZERO roll attack, ZERO roll damage** (log damage entries: 0; attack-type rolls absent), Bandit 1 hp 11 unchanged. RAW "moves up to half its Speed, and it makes one Dread Blade attack" never adjudicated.
2. **Move clause inert-by-construction:** token-move/OA-suppression has no consumer app-wide (MA-0079 family, §70 playbook) — advisory even after delegate fix.

## Fix (DATA, same pass as MA-0566 header)
Prepend header `{"name":"Legendary Action Uses: 2","uses":2}` (MA-0510/0566 §46 rule: header+children same pass), **Lunge `delegates_to:"Dread Blade"`** — chip then routes through the live structured Dread Blade row (+11, 2d6+5 Slashing + 3d8 Necrotic, damage_dice_secondary transport live MA-0531). Keep prose move clause; record move advisory MA-0079 family (accepted residual).

## Live probe ledger
- Disk first: legendary_actions 3 child rows, no header; Lunge delegates_to absent ✓.
- EB join Death Knight (cs idx0 ac20 hp199) + Bandit exact-td (Bandit 1 ac12 hp11); DK maxHp/currentHp staged 999 via full-store POST /combatSummary 200.
- Arm Bandit 1 via DK own-card `[data-testid="target-select"]` (ancestor depth-3 from avatar alt).
- Card audit: Dread Authority = inert `mc-legendary-header-row`; Lunge chips = ["Expend Legendary"] only ✓ fingerprint.
- Click rig: initial boundingBox y=1135 OFF-VIEWPORT → 3 mouse.down/up clicks missed silently (zero counter/log/console). `scrollIntoView({block:'center'})` + fresh rect → **first in-viewport click FIRED** (burn + console.error + ability_use; log 4→5).
- Evidence: log tail new entry = ability_use only; damage:0; Bandit hp 11 == pre-fire.
- Cleanup: admin clear-change-data + clear-log 200; API re-verified cdEmpty+logEmpty after 13s quiet. Registry merge-append MA-0568 into Death Knight verifiedRow, JSON.parse disk-checked. No manifest/git writes.

## New pitfalls
- MA-0511 "absorbs first two clicks" did NOT reproduce — apparent multi-click absorb was viewport-clipping (playwright mouse coords beyond viewport height silently miss); always scrollIntoView + fresh rect before counting absorbed clicks.
- Burn latch token "after AasimarTest's turn" again stamps non-attacker activeCreature — same MA-0511 economy artifact.
