# MA-0308 — Arch-hag Malicious Magic (legendary_actions[2]) — FAIL (inert legendary child)

## Row
- stableKey: arch-hag|legendary_actions|2
- actionType: other
- description: "The hag uses Spellcasting to cast Dimension Door or Hypnotic Pattern. The hag can't take this action again until the start of its next turn."
- Raw dict: name+description only (no automation/delegates_to/usage/cooldown fields).

## Evidence (live run MA-0306 session 2026-09-16, cs idx2, test-campaign header verified)
- Text-only render; zero clickable affordances (same DOM query result as MA-0307).
- Malicious Magic ×2 immediate clicks: popups `[]`, zero log rows — spell never cast from this row; the "can't take again until start of next turn" cooldown clause is DEAD (cooldown implemented only inside `expendLegendaryUse`, unreached without numeric `uses` — MA-0187 rule).
- Spell legs (DD/Hypnotic Pattern) live only via own Spellcasting row (MA-0304 advisory shape); no linkage from legendary.

## Root cause
Data authoring gap (no numeric `uses` on header :MA-0306, no delegation/automation here). Consumers would auto-activate with authored metadata.

## Fix (data)
Header `uses: 3`; this row `"delegates_to"` → Spellcasting subset or automation effect with per-turn cooldown flag. No code change.
