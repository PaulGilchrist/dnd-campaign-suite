# bug-mon-MA-0072 — Adult Brass Dragon "Pounce" — inert legendary row; no attack-roll producer, move clause unmodellable

## Title
MA-0072 Adult Brass Dragon · Pounce · legendary_actions · other · FAIL (flavor b: inert; per MV-28 bar)

## Overview
Row has no authored numeric fields, renders zero affordance, forced clicks produce zero delta, and no Pounce consumer exists. Subagent labeled "PASS — fingerprint confirmed inert" — wrong per strict trichotomy: inert + grep-zero = FAIL (MA-0040/0022 precedent).

## Expected Behavior (row)
"The dragon moves up to half its Speed, and it makes one Rend attack."

## Actual Behavior
- Data: `{name, description}` only.
- Row DOM: 0 dice-link/[role=button]/inputs; forced click → zero popup/log/state delta.
- grep Pounce consumers: none (only `_instinctivePounce` barbarian feature, unrelated).
- Move clause: no monster movement-distance model (§7 — advisory); attack clause: no dedicated producer on this row (Rend lives on its own clickable row — does not satisfy MV-28 bar for reference-only rows).

## Steps to Reproduce
1. test-campaign → EB join "Adult Brass Dragon" → .mc-overlay → Pounce row → click → nothing.

## Likely Location
MonsterCardBody generic inert path (MV-17 family); no legendary economy.

## Notes
Playbook pitfall: subagents repeatedly mislabel "confirmed inert" as PASS — orchestrator corrects to FAIL per rules.
