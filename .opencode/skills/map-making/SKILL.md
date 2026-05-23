---
name: map-making
description: How to build indoor D&D fantasy themed dungeon maps.
---

## Core Rules
- Always follow `public/campaigns/maps-indoor.schema.json` for indoor maps or `public/campaigns/maps-outdoor.schema.json` for outdoor maps.
- Maps are saved to `public/campaigns/{campaign name}/maps`.

## Learned Best Practices
- All items are placed facing east, and need their rotation set to face in any other direction.
- Bookshelves and Tables are 2 squares wide and place based on their left square.
- Do not place a door on top of a wall but rather have it replace a wall to convert a rectangle into an enterable room.
- List every cell as fogged, EXCEPT the cells adjacent to player tokens.
- Verify the generated JSON against the schema before saving.
- Choose different monsters appropriate to the dungeon's theme.
