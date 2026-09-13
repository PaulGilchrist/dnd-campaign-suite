# Bug MA-0039 — Adult Black Dragon · Frightful Presence (legendary_actions / other)

**Verdict: FAIL — inert row, no automation.**

## Expected
Legendary action "Frightful Presence" should be actionable: casting Fear — targets make WIS saves (or save prompt), Frightened applied, campaign-log entry, and once-per-turn gate ("can't take this action again until the start of its next turn").

## Actual
- Row renders as `DIV.mc-action` with `cursor: auto`, no click affordance.
- Forced click + dblclick: nothing. No Frightened, no save prompt, no log entry.
- Change-data post-click: only `combatSummary`, `combat-ui-viewingMonster*` echo keys — zero frightful/fear/legendary state keys.

## Fingerprint match
- MV-5: legendary text delegates to Spellcasting ("uses Spellcasting to cast *Fear*") — monster Spellcasting is inert family.
- MV-17: legendary row without numeric fields renders inert; no legendary-economy tracking in src/server (grep-zero; only Legendary Resist. display in MonsterCardBody.jsx:301).
- MV-21: once-per-turn gate text grep-zero — no consumer parses "can't take this action again until...".

## Grep evidence
`Frightful Presence` in src (non-test): only `src/services/npcs/npcGenerator.js:59` (generation template, not an action handler). No handler keyed to this action anywhere.

## Repro
1. Join Adult Black Dragon in Encounter Builder (test-campaign)
2. Open initiative card → `.mc-overlay` → Legendary Actions → Frightful Presence
3. Click / force-click row → no effect, no log.
