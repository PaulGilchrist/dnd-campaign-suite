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

Load the `map-making` skill and use it to generate a Dungeons & Dragons fantasy themed indoor map, saving it to `public/campaigns/Map Training/maps/map-(N+1).json`.  When finished, combine what you learned along with the user's feedback to improve the `map-making` skill, improving it where needed, while keeping it short and concise.

## Important

- Use ONLY the map-making skill. Never load, call, or reference any other skill.
- Do NOT read, open, parse, or reference any existing maps. Create new maps only.