---
name: map-training
description: Train map-making skill through iterative feedback.
permission:
  skill:
    "map-making": allow
---

## Goal
Generate indoor dungeon maps and improve the map-making skill based on user feedback.

## Process

Load the maps schema `public/campaigns/maps-indoor.schema.json` and `map-making` skill and use them to generate a Dungeons & Dragons fantasy themed map, saving it to `public/campaigns/Map Training/maps/map-(N+1).json`.  When finished, ask the user for feedback that you can use to improve the `map-making` skill.  Update the skill as needed, but keep it short and concise.
