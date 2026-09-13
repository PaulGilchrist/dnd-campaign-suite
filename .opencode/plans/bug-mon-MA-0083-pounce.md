# Bug MA-0083 — Adult Bronze Dragon · Pounce (legendary_actions / other)

**Verdict: FAIL — inert row, no automation.** (MV-30: inert = FAIL flavor(b); fingerprint matches MA-0040, contradicts MA-0072's PASS label.)

## Expected
Legendary action "Pounce" ("The dragon moves up to half its Speed, and it makes one Rend attack.") should be actionable: an attack-roll producer for the Rend attack (attack roll + damage or save prompt) and a campaign-log entry.

## Actual
- Row renders as `DIV.mc-action` in `.mc-overlay` (136 B: `<strong>Pounce.</strong> <span>…</span>`), `cursor: auto`, inputs=0, `.mc-dice-link`/`[role=button]`/button/a=0 — no click affordance, no numeric fields (MV-23 exception N/A).
- Forced pointerdown/mousedown/pointerup/mouseup/click/dblclick on row + inner span: no roll, no attack prompt, no dialog, HP unchanged (212/212), no token movement.
- Log delta after click: 6 → 6 entries (join + initiative only). Change-data byte-identical pre/post (9843 B); "Pounce" appears only inside the `combat-ui-viewingMonster` modal echo blob — zero te/runtime keys.

## Fingerprint match
- MA-0040 (Adult Black Dragon Pounce): identical authored shape (name+description only) and identical inert behaviour. Per MV-30 the correct label there and here is FAIL.
- MA-0072 (Adult Brass Dragon Pounce): same fingerprint but was labelled PASS — label discrepancy; this row re-confirms FAIL is correct for inert no-affordance legendary rows.
- MV-17: no-affordance legendary row renders inert; no legendary-economy tracking (MA-0039/MA-0021 family).
- §7: no monster movement-distance model — the "moves up to half its Speed" clause is unmodellable; downgraded to advisory (MV-12). The failure to produce the **Rend attack roll** is the actionable defect — a clickable row with an attack-roll producer for the single weapon attack is implementable within existing pipeline machinery (cf. Thunderclap sibling row which carries full save/dice metadata, proving the authoring schema supports it).
- MV-28: Rend lives on its own legendary row; Pounce references it by name only, no producer wires the reference.

## Grep evidence
`pounce` (case-insensitive) in src/server (non-test): only `src/services/automation/handlers/combat/combatStanceHandler.js` — Instinctive Pounce, a PC barbarian special action (`rage_bonus_movement`), not keyed to monster legendary actions. No handler keyed to this monster row anywhere.

## Repro
1. Join Adult Bronze Dragon in Encounter Builder (test-campaign)
2. Open initiative card (Init 17) → `.mc-overlay` → Legendary Actions → Pounce
3. Click / force-click row → no effect, no log, no movement, no roll.
