# bug-mon-MA-0025 — Aboleth lair action 2 "grasping tide" is inert flavor text

## Verdict
FAIL (flavor b) — data drift: DC 14 STR is text-only, no structured field, no automation consumer.

## Evidence
### Data
- `public/data/monsters.json` Aboleth `lair_actions` = plain string array (no `save_dc`, no `ability`, no objects).
- `lair_actions[1]`: "Pools of water within 90 feet ... DC 14 Strength saving throw or be pulled up to 20 feet into the water and knocked prone."

### Grep — zero consumers
- No code parses lair-action DC/strength; no lair handler in `automationInfoBuilder/core-handlers.js` or `automation/`.
- `src/components/encounter/MonsterCardBody.jsx:306` `MonsterLairAction` renders string via `dangerouslySetInnerHTML` in `<div className="mc-action">` — `<span>` content, no button/onClick.
- No `targetEffectDefinitions.js` key for lair water-tide / prone-on-lair.

### E2E (localhost:5173, campaign header confirmed "test-campaign")
- EB: joined Aboleth (CR 10, 5,900 XP roster entry), opened `.mc-overlay`.
- Lair row present: `DIV.mc-action` inside `.mc-overlay`, `hasButtonChild: false` — no affordance.
- Click + forced click/pointer events: no DC 14 STR save prompt, no prone badge, no log entry, modal unchanged.
- Console noise noted (pre-existing): feat-collection expression error + `characterKey === campaignName` runtime warning when opening modal — unrelated to this row.

## Cleanup
- Aboleth removed from unsaved builder roster; admin clear POSTs issued with Host: localhost.
