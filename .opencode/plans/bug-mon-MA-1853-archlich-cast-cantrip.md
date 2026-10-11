# Bug MA-1853 — Archlich "Cast Cantrip" (legendary_actions[1]): inert cantrip lane

**Verdict: FAIL(b) — INERT-CANTRIP-LANE (spend-only, DATA)** — 2026-10-11, test-campaign, :80 dist build.

## Row
```json
{"name":"Cast Cantrip","description":"The archlich makes one Cantrip spell attack."}
```
Keys: name + description ONLY. No `attack_bonus`, no `delegates_to`, no `save_dc`, no `advisory`, no `automation`, no dice, no spell list.

## Live evidence (E2E)
- Setup: EB native-checkbox join 1x Archlich 1 (init 8, round 1, cs.activeCreatureName=AasimarTest — fresh boundary, no cs-mirror fixup needed this run); per-card `select[data-testid=target-select]` armed ElderPaladin (224 HP, AC 17 disk — 19 prior-run rig irrelevant since no attack fires).
- Card audit: legendary header `(3 left)`; Cast Cantrip row renders exactly ONE affordance — `span.mc-dice-link-legendary` "Expend Legendary", title "Expend 1 legendary use — Cast Cantrip". Card-wide `.mc-dice-link-spell` count = 0 → NO cantrip picker exists (utility spell chips structurally suppressed for legendary rows, MonsterAction.jsx:400; and Spellcasting row is itself markup-less inert per MA-1850 — the +14/DC22/Fire Bolt prose has no chip lane anywhere on the card).
- Chip press at fresh boundary: LA spent honestly — `monsterLegendaryUses{max:3,used:1}`, counter `(2 left)`, ability_use log "Archlich 1 expends a legendary use for Cast Cantrip after AasimarTest's turn — 2 of 3 left...".
- Resolution: **ZERO spell attack.** No popup, no roll modal, ElderPaladin HP unchanged 224, cs.lastAttack ABSENT, full log = 3 entries only: encounter/joined + initiative roll (join-time, rolls:[8,15] total 8) + the Cast Cantrip ability_use spend. Console: `[MonsterCardModal] legendary action "Cast Cantrip" delegates_to "undefined" — no resolvable mechanic on "Archlich 1"` = the §464/§225 live-silent-burn fingerprint, resolveLegendaryRowMechanic fall-through MonsterCardModal.jsx:715.
- Economy axes already PASS via this very chip (MA-1852) — the defect is purely the missing cantrip mechanic behind a row whose prose promises "one Cantrip spell attack".

## Root cause
`resolveLegendaryRowMechanic` (MonsterCardModal.jsx:690-716) arms mechanics from `attack_bonus` / `save_dc>0` / `advisory` / self-buff / damage-dice-in-description. The row authors none. Grep: zero monster-side cantrip consumers app-wide (`isCantrip` appears once, MonsterCardModal.jsx:1398, PC-damage-side); cantrip pickers live only in PC spellbook modals (WarMagicCantripModal etc.). Legendary sections route ALL handlers through legendaryGate (MonsterCardBody.jsx:228-231) — even a spell chip would only re-spend, never cast.

## Fix options (data-first, per household precedent)
- (A) Honest-delegation byte-shape (§225): add `delegates_to` to a structured cantrip attack row — but Archlich has no cantrip attack row in `actions[]`, and MA-1850 shows Spellcasting can't supply one; would need new structured row e.g. Fire Bolt `{attack_bonus:14, damage_dice_primary:"1d10", damage_type_primary:"Fire", range:"120 ft."}` + `delegates_to:"Fire Bolt"`, or
- (B) Fix MA-1850 spellcasting markup (`<em>` wrap MA-0611/0619 byte-shape) AND extend the legendary lane to offer spell picks (engine work, no consumer today), or
- (C) §253 advisory seam: `advisory:"cast_cantrip"` + `advisory_message` = honest GM-enforced record-only spend (cheapest, zero rolls, matches nameless-advisory precedent MA-0073).

## Not the defect
Economy (spend/latch/exhausted/regain/refusals) PASS under MA-1852 on this same chip. Log naming is honest ("Cast Cantrip"). Generic "Expend Legendary" label is the sanctioned single-chip design (MA-1852), not a defect.

## Cleanup
Board cleared, `POST admin/clear-change-data` + `admin/clear-log` → cd:{} log:[] quiet; server up.
