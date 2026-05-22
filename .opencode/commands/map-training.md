---
name: map-training
description: Train map-making skill through iterative feedback.
permission:
  skill:
    "*": deny
    "map-making": allow
---

## Goal
Generate indoor dungeon maps to improve the map-making skill based on user's feedback.

## Process

1. Read the `map-making` skill to understand the required subagent pipeline.
2. Read the indoor map schema (`public/campaigns/maps-indoor.schema.json`) to understand the data structure.
3. Check existing maps in `public/campaigns/Map Training/maps/` to determine the next map number.
4. Extract the pipeline passes from the skill, then dispatch each pass sequentially to a subagent, passing the output of each pass as input to the next.
5. Save the final map JSON to `public/campaigns/Map Training/maps/map-(N+1).json`.
6. Improve the `map-making` skill based on lessons learned.

## Important
- Use ONLY the map-making skill. Never load, call, or reference any other skill.
- Do NOT read, open, parse, or reference any existing maps. Create new maps only.