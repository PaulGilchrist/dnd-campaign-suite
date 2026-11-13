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

## Resolution

**FIXED (2026-11-14).** Both honesty seams were fixed, plus the copy drift — the bug file’s guesses were verified against the code and held, with one extra hole found live during the fix (below).

### What was actually wrong

1. **Sentinel gate blind to item nouns** (`src/services/ai/dressCapabilities.js`): `proposalIncludesStructuralOps()` only checked `op.target ∉ {item, poi, token}`. A smuggled `target:'item', item:{type:'wall'}` op is target-class-legal, so the “no structural changes” notice rendered beside literal `add wall at x,y` preview lines. Confident guess: confirmed.
2. **Server applier stored any noun** (`server/services/ai/authoring/dressMap.js` `addPlacedItem`): only `op.item?.type` presence was checked; `type:'wall'` landed verbatim as a generic “?” placeholder prop. Confirmed.
3. **Copy drift**: the modal hint forbade “doors”, yet `door`/`secretDoor`/`stairs`/`arrowSlitWall` are SERVED prop types (real Blender sprites in `src/services/maps/itemSprites.js` `ART_TYPES`) and the system prompt advertises “chest, trap, torch, door…”. Confirmed.
4. **NEW face found live during re-verification**: the model re-smuggled as `type:'stone_wall'` — regex `\b` counts `_` as a WORD character, so `\bwall\b` never matched inside snake_case nouns and the contradiction survived the first fix pass. The `STRUCTURE_TERMS` boundaries were rewritten as `(?<![A-Za-z0-9])…(?![A-Za-z0-9])` (underscore/hyphen separate; camelCase still glues, so the sprite-backed `arrowSlitWall` correctly stays allowed).

### Fix (chosen lane: server fail-closed refusal + never-contradicting sentinel + truthful copy)

- `server/services/ai/authoring/dressMap.js`: `addPlacedItem` refuses structural-noun item TYPES through the ordinary all-or-nothing error lane — plain-English, model-guiding copy (“…names a structural layer the op set cannot build — place a real prop instead (chest, table, torch, door, statue…) or drop the op”) — so the repair retry teaches the model; id-addressed removes of legacy wall-typed rows stay allowed (cleanup is not dressing). Registered sprite types stay placeable. The system prompt now states the item.type prop law up front.
- `src/services/ai/dressCapabilities.js`: shared vocabulary — `proposalIncludesStructuralOps` now also scans `op.item.type`/`op.item.name` against `STRUCTURE_TERMS` (item nouns only; POI labels like “Ruined Gateway” don’t count), so the sentinel can never contradict a preview listing structural nouns, even if a structural row ever slipped through. New exported `structuralItemType(type)` = structural-noun AND no registered prop sprite (`itemSpriteHref` from `itemSprites.js` — rule-data ground truth for the served vocabulary).
- `src/components/maps-manager/AiDressButton.jsx`: hint copy now matches the real served vocabulary — “…(tables, chairs, chests, prop doors…). It cannot add, move or remove real walls, paint or fog — the structural map layers.” (doors/stairs props ARE served; wall/paint/fog layers are not).
- 5e vs 2024 sibling: N/A — the AI dress lane is ruleset-agnostic (no rules-module twin).

### Files changed

- `src/services/ai/dressCapabilities.js` + `src/services/ai/dressCapabilities.test.js`
- `server/services/ai/authoring/dressMap.js` + NEW `server/services/ai/authoring/dressMap.structural-items.test.js`
- `src/components/maps-manager/AiDressButton.jsx` + `AiDressButton.test.jsx` (hint pins + wall-as-item smuggle face)

### Verification

- **Live repro before fix** (Playwright, test-campaign, sandbox map `xa-dress-1`, Qwen dress ask “Build a stone wall around the center…”): preview listed 16 `add wall at x,y` + `add chest at 5,5` with `.ai-dress-notice` claiming “The model proposed no structural changes (dress supports items only)” — byte-for-byte the filed face.
- **Live re-verify after fix** — both Expected branches proven:
  - (b) UI on the running :80 pair (old server code, new client): second live ask smuggled `type:'stone_wall'` ×8 — the sentinel did NOT render (`notice: null` while the preview listed stone_wall rows; probe also caught the pre-boundary-fix miss, which drove the snake_case law above).
  - (a) server refusal proven on a throwaway :8123 instance running the NEW code (the owned :80/:5173 pair was left untouched): the same wall ask returned `ok:true` with an honest furniture preview (8 `statue` + `chest`, ZERO wall rows) and the audit row read **`attempts: 2`** — attempt 1 was refused fail-closed, the repair turn carried the structural sentence, attempt 2 complied. A wall-typed proposal can no longer reach a preview from the real funnel.
  - Adjacent sanity: benign item-only ask (`add table/chair`) previewed normally with the sentinel absent.
- **Tests**: new/updated files pass; full `npm run test:run` 3256 files / 35168 tests green; `npm run lint` zero warnings; `no-timers-guard` OK.
- **Cleanup**: `xa-dress-1` deleted via the Maps-manager row Delete lane (ghost 404 proven); change-data `{}` (aiConfig restored as-found) + log `[]` via the admin clear lanes (disk files absent); 4 owner map fixtures byte-exact (94fcd0bf/860eda23/7561e4bf/8e40779e); :8123 throwaway killed; screenshot artifacts deleted; `git status` = only the intended fix files.
