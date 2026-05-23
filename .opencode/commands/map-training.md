---
name: map-training
description: Train map-making skill through iterative feedback.
permission:
  skill:
    "*": deny
    "map-making": allow
---

## Goal
Generate indoor dungeon map to improve the map-making skill based on user's feedback.

## Process

1. Read the `.opencode/skills/map-making/SKILL.md` skill to understand map making best practices, and read the schema mentioned in the skill following it to the letter.
2. Count the files in `public/campaigns/Map Training/maps/` to determine the new map name as map-(N+1).json.
4. Dispatch concise, independent subagent tasks that each produce only their assigned output array, passing the accumulated result forward between calls.
6. Save the final map JSON to `public/campaigns/Map Training/maps/map-(N+1).json`.
7. Improve the `map-making` skill based on lessons learned and feedback from the user.
