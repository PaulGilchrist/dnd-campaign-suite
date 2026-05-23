---
name: map-making
description: How to build indoor D&D fantasy themed dungeon maps.
---

## Core Rules
- Follow `public/campaigns/maps-indoor.schema.json` for indoor maps or `public/campaigns/maps-outdoor.schema.json` for outdoor maps.
- Maps are saved to `public/campaigns/{campaign name}/maps`.

## Pipeline Steps

### Step 2: Theme Selection
- Choose a D&D-appropriate dungeon theme (dwarven mine, dragon lair, assassin's den, etc.)
- Pick monsters from the Monster Manual that match the theme

### Step 3: Walls
- Create rooms and corridors using `x,y` coordinate strings
- Doors replace wall cells (do not place doors on top of walls)
- Use rotation 0 for horizontal doors, 90 for vertical doors

### Step 4: Placed Items
- All items face east by default; set rotation to face in any other direction
- Bookshelves and tables are 2 squares wide — place based on their left square
- NPC names must exactly match Monster Manual names for image lookup
- Place traps, chests, webs, and other items inside rooms

### Step 5: Players
- Place player tokens at the entrance (adjacent to the entry door)
- Use grid positions inside the room, not on walls

### Step 6: Fog
- List every cell as fogged EXCEPT cells adjacent to player tokens
- Fog uses `x,y` coordinate strings matching the grid size

### Step 7: Assemble & Validate
- Required fields: `name`, `gridSize`, `walls`, `placedItems`, `players`, `zoom`, `panX`, `panY`, `fog`
- `gridSize` must be 5-100
- `walls` and `fog` are arrays of `"x,y"` strings
- `placedItems` items require: `id`, `gridX`, `gridY`, `type`, `visible`
- `players` items require: `id`, `name`, `gridX`, `gridY`
- Item types: altar, bed, bookshelf, chair, chest, crate, door, firepit, fountain, npc, pillar, secretDoor, stairs, statue, table, torch, trap, web

## Learned Best Practices

### Layout & Grid Sizing
- **Choose gridSize to fit the dungeon** — pick a grid that's tight around your rooms. For 4-5 small rooms connected by corridors, use gridSize 12-16. A 24×24 grid with only ~100 walls leaves most of the map as empty void space. The wall count should fill at least half the grid to create a dense, explorable dungeon.
- **Draw the entire dungeon boundary first** — every cell on the perimeter (outer edges) should be a wall except where the main entrance gap is. This prevents the "open space" problem and gives the dungeon clear boundaries.
- **After walls, trace connectivity** — mentally walk from the entrance through corridors to every room. If any room has no path from the entrance, add a corridor or remove a blocking wall. Every room must be reachable.

### Doors & Passages
- **Doors must REPLACE a wall cell that actually blocks passage** — before placing a door item, verify that exact coordinate exists in the walls array. Remove that wall, then place the door on the same tile. If no wall exists at that position, you're creating a "phantom door" that leads nowhere.
- **Every placed door must open into TWO distinct rooms or a room and a corridor** — verify one side is an interior floor cell and the other side is also an interior floor cell (or corridor). Doors on the map's outer edge must have the outside as one side and a room/corridor as the other.
- **Never forget the entrance passage** — if your entrance gap is on the outer boundary, ensure no interior wall directly blocks it. The cell immediately inside the entrance gap at y=gridSize-2 (for bottom entrances) must NOT be in the walls array, or players cannot enter.

### Items & NPCs
- **Never place an NPC or item on a wall cell** — cross-check every placed item's gridX, gridY against the walls array. If the coordinate appears in walls, move it. Common failure: prison cells and rooms have boundary walls that accidentally overlap with NPC positions.
- **Place items slightly away from walls** — items like tables (2 wide), bookshelves should be 1 cell back from room walls so they don't clip into wall space.

### Validation Checklist Before Saving
- [ ] Every wall coordinate follows the pattern `^\d+,\d+$`
- [ ] The outer boundary is fully walled except for entrance gap(s)
- [ ] A path exists from entrance to every room (trace corridors mentally)
- [ ] No door's gridX,gridY appears in the walls array (doors replace walls, they don't stack on them)
- [ ] Every placed item's grid position is NOT in the walls array
- [ ] Player positions are NOT in the walls array
- [ ] Every fog coordinate follows the pattern `^\d+,\d+$`
- [ ] GridSize matches 50%+ of the dungeon area being filled with rooms/corridors
