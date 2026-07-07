# Recommendation #4: Add Explicit SSE Pipeline Observer

## Problem

Currently, SSE broadcasting is a **side effect** of `setRuntimeValue` — when any runtime value changes, it POSTs to the server, which calls `publish()` to broadcast to all clients. The pipeline's observers in `observers.js` only log to the campaign log (client-side). There's no explicit, testable contract for what SSE events the pipeline produces.

Since different users can initiate different pipeline steps, milestone data needs to be broadcast via SSE so all clients stay in sync.

## Solution

Add a new SSE route for pipeline events, pipeline observers that POST milestones to that route, and client-side SSE handling for pipeline events.

## Architecture

```
Pipeline step completes
  → Observer fires (client-side)
  → POST /api/campaigns/:campaign/pipeline-event { key, data }
  → Server stores in characterChangeData
  → Server calls publish(`pipeline-${campaign}-${key}`, data)
  → All clients receive SSE event
  → App.jsx handleRuntimeEvent processes pipeline events
```

## Files to Create/Modify

### New Server Route: `server/routes/pipeline-events.js`

```js
// POST /api/campaigns/:campaign/pipeline-event
// Accepts { key, data } from client, broadcasts via SSE
// GET /api/campaigns/:campaign/pipeline-events - Get stored pipeline events
```

Key details:
- Accepts `{ key, data }` where key is the milestone name (e.g., `damage:rolled`)
- Stores in `characterChangeData` under key `pipeline-${campaign}-${key}`
- Calls `publish()` with key `pipeline-${campaign}-${key}`
- Returns `{ message: 'Pipeline event recorded' }`

### New Observer Module: `src/services/combat/steps/sseObservers.js`

```js
// Pipeline observers that broadcast milestones via SSE
// Each observer POSTs to /api/campaigns/:campaign/pipeline-event
// Observers fire on ALL pipeline events (step completions + pauses)
```

Observer events to broadcast:
1. `housekeeping:do` → `pipeline:started`
2. `maneuvers:check` → `maneuvers:check`
3. `maneuvers:handled` → `maneuvers:handled`
4. `cunning:checked` → `cunning:checked`
5. `bi:checked` → `bi:checked`
6. `damage:rolled` → `damage:rolled`
7. `context:built` → `context:built`
8. `sneak:applied` → `sneak:applied`
9. `twf:applied` → `twf:applied`
10. `effects:applied` → `effects:applied`
11. `superiority:applied` → `superiority:applied`
12. `automation:applied` → `automation:applied`
13. `weapon_hit:applied` → `weapon_hit:applied`
14. `n20:applied` → `n20:applied`
15. `celestial:applied` → `celestial:applied`
16. `riders:applied` → `riders:applied`
17. `overchannel:self-damage` → `overchannel:self-damage`
18. `dmg_type:modified` → `dmg_type:modified`
19. `damage:ready` → `damage:ready`
20. `damage:applied` → `damage:applied`
21. `pipeline:paused` → `modal:shown` (when step returns `{ modal }`)
22. `pipeline:resumed` → `modal:dismissed` (when modal handler calls proceedWithDamage)

### New Pipeline Observer Integration

In `src/services/combat/steps/index.js`, `buildPipelineForAction()` will register both existing log observers AND new SSE observers:

```js
export function buildPipelineForAction(action, playerStats) {
  const pipeline = createPipeline();

  // Register log observers (existing)
  for (const obs of createObservers()) {
    pipeline.observe(obs.event, obs.handler);
  }

  // Register SSE observers (new)
  for (const obs of createSseObservers()) {
    pipeline.observe(obs.event, obs.handler);
  }

  // ... existing step registration
}
```

### Client-Side Pipeline Event Handling

In `src/App.jsx`, `handleRuntimeEvent` will handle pipeline events:

```js
// After existing character/change-data handling:
if (event.key.startsWith('pipeline-')) {
  const prefix = `pipeline-${campaignName}-`;
  if (!event.key.startsWith(prefix)) return;
  // Pipeline events are broadcast to all clients for sync
  // They don't modify runtime state directly — they're for logging/coordination
  // Could trigger UI updates (e.g., show "X rolled Y damage" notification)
  return;
}
```

### Tests

- `server/routes/pipeline-events.test.js` — Test POST/GET endpoints, SSE broadcast
- `src/services/combat/steps/sseObservers.test.js` — Test that observers POST milestones correctly
- `src/services/combat/steps/index.test.js` — Verify both observer types are registered

## Risk Mitigation

- **Additive only**: No existing code changes, only new observers added
- **Observer isolation**: SSE observers run alongside log observers, don't interfere
- **Error handling**: POST failures are caught silently — pipeline continues even if SSE broadcast fails
- **Campaign filtering**: SSE key prefix `pipeline-{campaign}` ensures only relevant clients receive events

## Implementation Order

1. Create `server/routes/pipeline-events.js` (server route)
2. Create `src/services/combat/steps/sseObservers.js` (SSE observers)
3. Update `src/services/combat/steps/index.js` to register SSE observers
4. Update `server.js` to mount the new route
5. Update `src/App.jsx` to handle pipeline SSE events
6. Add tests
7. Run lint + test suite
