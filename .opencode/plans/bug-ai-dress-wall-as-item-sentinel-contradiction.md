# Bug: AI Dress accepts `wall`-typed items the modal claims are impossible, and the structure sentinel contradicts the live preview

## Summary

The AI Dress modal (since `6781bb6d1`) states “It cannot add, move or remove walls, doors or other structural changes”, but the op validator only constrains `target` (`item|poi|token`) — `item.type` is a free-form string. When asked to build a wall, the model smuggles `target:'item', item:{type:'wall'}` ops through; the preview then lists eight literal `add wall at x,y` lines **while the same panel shows the new sentinel claiming “The model proposed no structural changes (dress supports items only)”** — a direct self-contradiction in the shipped honesty copy. Applying lands the ops as generic unknown-type props (dashed “?” placeholder boxes), not walls.

## Steps to reproduce

1. On localhost, in `test-campaign`, ensure Admin → AI Referee is configured (mode `suggest` or `autopilot`, local endpoint live).
2. Create (or reuse) a small indoor sandbox map — API: `POST /api/campaigns/test-campaign/maps {"name":"xa-dress-1","type":"indoor","gridSize":10}`.
3. Maps view → row button `Dress "xa-dress-1" with AI`. Note the ask form hint: “Dress supports item-level operations only … It cannot add, move or remove walls, doors or other structural changes.”
4. Enter a structure-implied instruction, e.g. `Build a stone wall around the center of the room and place a treasure chest inside the enclosure.` and press `Dress map`.
5. Read the preview panel.

## Expected behavior

Either (a) the proposal is refused/errors (the vocabulary truly cannot express walls — the schema or `validateLiveDressPlan` should reject item ops whose `item.type` is a structural noun, or the prompt/hint should stop advertising “door” as a served item type), or (b) if wall-as-prop is deemed acceptable dressing, the sentinel “The model proposed no structural changes (dress supports items only)” must NOT render while the preview list visibly reads `add wall at 4,5 …`.

## Actual behavior

- Preview shows: `add wall at 4,5` ×8 lines + `add chest at 5,6`, **and simultaneously** the notice `The model proposed no structural changes (dress supports items only).` (element `.ai-dress-notice`).
- `Apply to map` succeeds: disk doc gets 9 `placedItems` rows (`ai-dress-item-wall-4-5-0` … `type:'wall'`, `name:'stone wall'`); the real `walls[]` array stays `[]` (the structural lane is honestly protected — no data-integrity break).
- In the indoor editor the “walls” render as dashed generic “?” placeholder squares (unknown prop type), visually nothing like a wall. Screenshot taken at 2D mount.
- Control probe (item-only ask `add table at 2,2`): proposal + preview honest, sentinel correctly absent — the contradiction is specific to structure-named item types.

## Likely location

- `src/services/ai/dressCapabilities.js` — `proposalIncludesStructuralOps()` gates the sentinel on `op.target` ∈ {item, poi, token} only; blind to `op.item.type === 'wall'`. Confident.
- `server/services/ai/authoring/dressMap.js` `applyOne()` (~line 141) — only checks `op.item?.type` presence; no vocabulary check, so `type:'wall'` (or any noun) is stored verbatim as a prop. Confident.
- `server/services/ai/authoring/entitySchemas.js` `liveDressPlanSchema` — `item.type: SHORT` free-form by design. Confident.
- The modal hint copy itself lives in `src/components/maps-manager/AiDressButton.jsx` (`AiDressAsk`), and mirrors the system prompt which lists “chest, trap, torch, door…” as served item types — the hint saying doors “cannot” be added conflicts with that vocabulary too.

## Suggested fix

Cheapest honest option: extend `dressStructureNotice`/`proposalIncludesStructuralOps` to also scan `op.item.type` (and `op.item.name`) against the same `STRUCTURE_TERMS` regex, so the sentinel never contradicts the preview. Better: whitelist item types server-side in `applyOne` (reject structural nouns fail-closed with the existing all-or-nothing errors lane), and soften the modal hint to match the real served vocabulary (props named e.g. “door” ARE served as props; actual wall/paint/fog layers are not). Unit-pin the wall-as-item proposal face in `AiDressButton.test.jsx`.

## Severity

Minor UX issue — the shipped honesty copy actively contradicts adjacent UI and over-promises enforcement that doesn’t exist. No data-integrity risk: the real `walls[]` / fog / paint lanes remain untouchable (verified byte-empty after apply).
