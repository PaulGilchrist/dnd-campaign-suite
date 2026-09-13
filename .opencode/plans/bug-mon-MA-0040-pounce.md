# Bug MA-0040 — Adult Black Dragon · Pounce (legendary_actions / other)

**Verdict: FAIL — inert row, no automation.**

## Expected
Legendary action "Pounce" ("The dragon moves up to half its Speed, and it makes one Rend attack.") should be actionable: an attack-roll producer for the Rend attack (attack roll + damage or save prompt) and a campaign-log entry.

## Actual
- Row renders as `DIV.mc-action` inside the overlay's `mc-section`, `cursor: auto`, zero `input`/`button`/`select` — no click affordance, no numeric fields (MV-23 exception does not apply).
- Forced pointer/mouse/click/dblclick dispatch: no roll, no attack prompt, no dialog, HP unchanged (195/195), no token movement.
- Log delta after click: 2 → 2 entries (join + initiative only). Change-data post-click: nil (`[]`).

## Fingerprint match
- MV-17: no-affordance legendary row renders inert; no legendary-economy tracking (re-confirmed from MA-0039/MA-0021 family).
- MV-23: checked — row carries NO numeric fields, so clickable exception N/A.
- §7: no monster movement-distance model — the "moves up to half its Speed" clause is unmodellable in the current architecture.
- MV-12 adjudication: the move clause is downgraded to advisory (GM moves token manually); the failure to produce the **Rend attack roll** is the actionable defect — a clickable row with an attack-roll producer for the single weapon attack is implementable within existing pipeline machinery.

## Grep evidence
`Pounce` (case-insensitive) in src/server (non-test): only `src/services/automation/handlers/combat/combatStanceHandler.js` — Instinctive Pounce, a PC barbarian special action (`effect: 'rage_bonus_movement'`), not keyed to monster legendary actions. No handler keyed to this monster row anywhere.

## Repro
1. Join Adult Black Dragon in Encounter Builder (test-campaign)
2. Open initiative card → `.mc-overlay` → Legendary Actions → Pounce
3. Click / force-click row → no effect, no log, no movement, no roll.
