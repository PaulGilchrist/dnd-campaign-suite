# Initiative HP Tracking Plan

## Summary
Add HP tracking to the initiative component with full GM controls for NPCs, player HP sync between character sheet and initiative tracker, and limited visibility for players (exact HP for players, bloodied/dead only for NPCs).

## Architecture

### Data Flow
- **Player HP**: Stored in `character-change-data` (key: `{characterName}` → `{currentHitPoints, hitPoints, ...}`). The CharHitPoints component already uses `storage.getProperty(name, 'currentHitPoints')`. The initiative tracker will ALSO read changes for player creatures from SSE events (same key pattern: `change-{campaignName}-{characterName}` → `{currentHitPoints: N, ...}`).
- **NPC HP**: Stored directly on the creature object in `combatSummary` (fields: `maxHp`, `currentHp`). NPCs have no character sheet, so HP lives on the creature card.
- **Sync**: Both systems converge via the `Subscriber`/`SSE` pattern already in use. When a player edits HP on their character sheet (`CharHitPoints`), it writes to `character-change-data`, which the initiative subscriber picks up and applies to the creature card. When edited in the initiative tracker, it writes back via `storage.setProperty(name, 'currentHitPoints', value, campaignName)`.

### Fields on Creature Cards
```
Player creatures:
  - maxHp: from character.hitPoints (computed max)
  - currentHp: from storage.getProperty(name, 'currentHitPoints') || maxHp

NPC creatures:
  - maxHp: from monster.hit_points when named, or default 10
  - currentHp: maxHp initially, mutable
```

## Changes

### 1. `src/components/initiative/initiative.jsx`

**Imports**: Add `HiddenInput` import for inline HP editing.

**`setupCreatures`**:
- For player creatures: add `maxHp: character.hitPoints || 0`, load current from `storage.getProperty(characterName, 'currentHitPoints', campaignName)`, set `currentHp` to stored value or `maxHp`.
- For NPC creatures: add `maxHp: 10`, `currentHp: 10`.

**`handleEvent`** (SSE handler):
- Add handling for character change data events. When the key is a character name (not `combatSummary` or `activeCreatureId`), check if the data contains `currentHitPoints`. If so, find the matching player creature and update its `currentHp`. Persist updated `combatSummary`.
- Also handle `hitPoints` changes (e.g., level up changes max HP).

**`handleClear`**: No structural change, but creatures created via `setupCreatures` will now include HP fields.

**New: `handlePlayerHpChange(creatureId, newValue)`**:
- Find the creature in `combatSummary`.
- Update `creature.currentHp = newValue`.
- Write back to `storage.setProperty(creature.name, 'currentHitPoints', newValue, campaignName)` so the character sheet picks it up.
- Update `combatSummary` and broadcast via `storage.set('combatSummary', ...)`.

**New: `handleNpcHpChange(creatureId, newValue)`**:
- Only allowed if `isLocalhost`.
- Update `creature.currentHp = newValue`.
- Persist and broadcast.

**New: `handleNpcMaxHpChange(creatureId, newValue)`** (GM only):
- Update `creature.maxHp = newValue`.
- If `currentHp > maxHp`, also set `currentHp = newValue`.
- Persist and broadcast.

**Creature card rendering** (inside `.map`):
Between the name section and initiative section, add a HP display section:

For **all creatures**:
- Show a small visual HP bar (green → yellow → red based on percentage).
- For **player creatures**: Show `Current HP / Max HP` as an inline editable number. Both GM and players can edit (it syncs bidirectionally).
- For **NPC creatures**:
  - GM view: Show editable current/max HP numbers (inline edit like target selector).
  - Player view: Show only status badges: "BLOODIED" (currentHp ≤ maxHp/2 and > 0) in orange, "DEAD" (currentHp ≤ 0) in red. No numbers.
- When `currentHp <= 0`, add a `creature-unconscious` class to the card for visual distinction (grayed out overlay).

**`handleNameChange`**: When an NPC is renamed to a monster, look up `hit_points` from monster data and set both `maxHp` and `currentHp`. Also look up NPC stat blocks for HP.

### 2. `src/components/initiative/initiative.css`

Add styles for:
- `.creature-hp` — HP display row in creature card
- `.hp-bar-container` — thin bar background (~8px height)
- `.hp-bar-fill` — fill portion, width based on percentage. Green (>50%), Yellow (25-50%), Red (<25%)
- `.hp-bar-text` — HP numbers overlaid or beside the bar
- `.hp-inline-input` — small inline number input for editing
- `.status-badge.bloodied` — orange badge
- `.status-badge.dead` — red badge
- `.creature-card.creature-unconscious` — greyscale filter + opacity reduction
- `.creature-hp-gm-controls` — GM-only HP controls for NPCs (small +/- buttons)

### 3. `src/services/encounterToInitiative.js`

When expanding monsters to creatures, add HP fields:
```
creatureList.push({
  ...,
  maxHp: monster.hit_points || 10,
  currentHp: monster.hit_points || 10,
});
```

### 4. `src/components/initiative/initiative.test.jsx`

Add tests for:
- HP fields present on created creatures
- Player HP display in cards
- NPC bloodied/dead status badges
- GM-only HP editing for NPCs
- HP sync from character change events
