# GM map-Activate without Open leaves monster-card roller lane gridless (range + measured aura gating silently skipped)

## Summary
On the GM (localhost) tab, clicking **Activate** on a map in the Maps manager makes the map active server-side (the `__map__` change-data key is mirrored, LAN/player tabs auto-open it), but the GM tab's local `activeMapName` App state stays `null` until the GM explicitly **Opens** the map or re-selects the campaign. Every MonsterCardModal lane that consumes the `mapName` prop then runs with `mapData:null` — the map's measured range gates and the newly-fixed Lion rage-aura distance measurement silently degrade to gridless leniency on the GM's own tab while everyone else is on the mapped lane.

## Steps to reproduce
1. In test-campaign with an empty combatSummary: EB-join a Goblin (party fans out to the board).
2. Stamp ElderPaladin's runtime bucket with Rage + Power of the Wilds **Lion** (`optionName:"Lion"`, `range:"5 ft"`) and put an ElderPaladin token at (2,8) in the battle-arena map `players[]` (campaign re-select after bucket writes so the store hydrates).
3. Maps manager → click **Activate "Battle Arena"** (aria-label). Do NOT click Open. Campaigns → back is not needed; stay in the app.
4. Initiative → put the Goblin's placed token at (5,8) in the map `placedItems[]` (15 ft from the bearer; `GET /api/campaigns/test-campaign/change-data` confirms `__map__:{activeMapName:"battle-arena"}`).
5. Open the Goblin card, arm target EvasiveFighter (EF token at (6,8), 5 ft away), click the Scimitar `+4` chip.
6. Read the campaign log `roll/attack` entry → observe `mode:"disadvantage"` + a `lion_aura_disadvantage` automation row even though the goblin is 15 ft from the Lion bearer.
7. Contrast: Maps → **Open "Battle Arena"** → Initiative → reopen the card → same arm, same board (no data changed) → roll again → `mode:"normal"`, zero new lion rows, and the 25-ft-away variant now honestly shows AUTO-MISS.

## Expected behavior
Activating a map on the GM tab should arm the GM tab's own map context too (as it does on player tabs via the activate-SSE handler): monster-card attacks should measure token positions through the map (no aura at 15 ft; melee auto-miss beyond reach) with no Open/re-select required.

## Actual behavior
- Activate-only face: `mode:"disadvantage"`, popup "d20 18, 5 → 5" + `lion_aura_disadvantage` row "Goblin has Disadvantage on Scimitar: within 5 feet of raging ElderPaladin" — adjacency was **never measured** (skipRangeCheck leniency fired because `mapData` was null), and a 25-ft melee attack was NOT auto-missed.
- After Open (identical server state): `mode:"normal"`, no aura row, honest `AUTO-MISS (Target out of melee range (25 ft > 8 ft))`.
- No console errors, no toast — the degradation is silent.

## Likely location
Confident on the seam, guessing on the intended design:
- `src/App.jsx:435` — `const [activeMapName, setActiveMapName] = useState(null)`; set only via `onOpenMap` (App.jsx:243), `handleEnterMap` (App.jsx:438), and select-time `loadActiveMapAndOpen` (App.jsx:577-580).
- `src/App.jsx` `handleMapActivateEvent` early-returns for localhost ("GM … behavior unchanged there"), so the activate-SSE never arms GM state.
- `src/components/maps-manager/MapsManager.jsx:192` — `handleActivate` only POSTs `mapsService.activateMap`; no callback to App to update `activeMapName`.
- Consumer of the null prop: `src/App.jsx:781` `<Initiative mapName={activeMapName}>` → MonsterCardModal `useEffect` (MonsterCardModal.jsx:2197) sets `mapData:null` → `resolveMonsterLionAura` computes `attackerPlaced:false → skipRangeCheck:true` (and `computeMapRangeState` returns the no-map state). Note `MapContextSync` deliberately does not stamp `__map__` from null state, so the server key stays correct — the divergence is purely the GM tab's React state.

## Suggested fix
Thread an activation callback: MapsAreaView already receives `setActiveMapName` — pass e.g. `onActivated={(fileName) => setActiveMapName(fileName)}` into MapsManager and call it after `activateMap` resolves (no view navigation — keeps the "GM stays in the manager" intent of the localhost SSE early-return). MapContextSync will then mirror the key to the runtime store as usual. Check the deactivate/delete lane too (clear state when the active map is deleted). Add a regression pin: activate → click Initiative → monster melee chip at >8 ft auto-misses.

## Severity
Broken feature (conditional) — rules adjudication on the GM's own tab is silently wrong in both directions (spurious disadvantage aura at 15 ft; missing auto-miss at 25 ft) whenever the GM activates a map but never opens it. Edge-gated (Open or re-select self-heals), no data corruption.
