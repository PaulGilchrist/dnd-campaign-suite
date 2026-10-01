# MA-1809 — Young White Dragon lair_actions[2] (jagged ice shards dict) — NAMELESS DICT INERT

**Status: FAIL(b) / DATA — nameless dict never becomes clickable.**
Third row of today's Young White Dragon triple (26 twins); nameless-dict twin of MA-1749/MA-1755/MA-1785/MA-1791. This row has an authored damage mechanic (`damage_dice_primary:"3d6"` / `damage_type_primary:"Piercing"`) but **NO `name`** — so it dies at the name gate `monsterLairActions.js:26` BEFORE the `damage_dice_primary` fallback branch (:29/:50) is ever reached. Unlike the fog rows (MA-1807/1808), the adult twin for THIS row is a **`'attack'` affordance** (`attack_bonus:7`), not a save — the young row drops even the `attack_bonus`/`range` the adult authors.

## Disk quote (public/data/monsters.json, Young White Dragon) — DISK WINS

`lair_actions[2]` (this row — MA-1809) = **DICT, nameless**. Keys present: `description`, `damage_dice_primary`, `damage_type_primary`. **No `name`, no `save_dc`, no `save_type`, no `attack_bonus`, no `range`, no `advisory`, no `zone`:**

```
{
  "description": "Jagged ice shards fall from the ceiling, striking up to three creatures underneath that the dragon can see within 120 feet of it. The dragon makes one ranged attack roll (+7 to hit) against each target. On a hit, the target takes 10 (3d6) piercing damage.",
  "damage_dice_primary": "3d6",
  "damage_type_primary": "Piercing"
}
```

Byte-identity check (headless `===` this session):
- `lair_actions[2].description === adult-white.lair_actions[1].description` **true** — the adult "Jagged Ice Shards" row shares byte-identical ice prose. The adult adds `name:"Jagged Ice Shards"`, `attack_bonus:7`, `range:"120 ft."` on top of the same `damage_dice_primary:"3d6"` / `damage_type_primary:"Piercing"`.
- Note the "+7 to hit" prose is present on BOTH disks, but the young dict does **not** carry `attack_bonus:7` as a machine field — only the adult does. Data-generation drops the structured attack_bonus/name/range on the young row.
- Manifest agrees: MA-1809 `stableKey young-white-dragon|lair_actions|2`, `actionType "other"`, `actionName "Unnamed lair actions 3"`, `damageDicePrimary:"3d6"`, `damageTypePrimary:"Piercing"` — mirrors disk (auto-label "Unnamed lair actions 3", no authored name, no attack_bonus). Manifest NOT edited.

## Kill chain (code fingerprints)

- `src/components/encounter/MonsterCardBody.jsx:358` — `typeof la === 'string'` is **false** (dict); falls through to `!isLairRowClickable(la)`.
- `src/services/encounters/monsterLairActions.js:26` — `if (!row || typeof row !== 'object' || !row.name) return false;` → **`!row.name` is true** (nameless) → `isLairRowClickable` returns **false**.
- `isLairRowClickable` :29 `!!(row.damage_dice_primary && canRollExpression(...))` — the damage fallback that WOULD make this row clickable — is gated behind the name check at :26 and **never evaluated**.
- `lairRowAffordance` :50 `damage` branch likewise unreachable.
- Render (MonsterCardBody.jsx:366-372): nameless-dict static branch — no `<strong>` header + plain `<span dangerouslySetInnerHTML>`. Chip lane (:377+) unreachable.
- Headless (node import, this session): `isLairRowClickable(row2)` = **false**, `lairRowAffordance(row2)` = **null** as-authored — despite `damage_dice_primary:"3d6"` being present and rollable.

## Live probe (test-campaign — header verified `test-campaign`; :5173/:80 up)

Board IN initiative round 1: **Young White Dragon 1** (123/123, ini 9), **Bandit 1** (hp 868), **Bandit 2** (hp 864). `.mc-overlay` open via INNER `img.avatar-image[alt="Young White Dragon 1"]`. Lair Actions section = exactly 3 rows.

Row #3 (MA-1809) affordance inventory:

| affordance | present |
|---|---|
| `<strong>` name header | ❌ 0 |
| `<button>` | 0 |
| `[role=button]` | 0 |
| `tabindex=0` | 0 |
| `.mc-dice-link` / `.mc-dice-link-lair` chips | 0 |
| icons (`<i>`) | 0 |
| computed cursor | `auto` (not pointer) |
| children | single plain `SPAN` |

Contrast: SAME overlay Actions section renders live chips (Rend `+7` cursor:pointer) — absence is the gate, not a render failure.

Click probe row #3 → **zero effect**: no popup, no `mc-prerequisite-refusal` (count 0), no save/attack prompt (0), overlay still open unchanged, row unchanged (chips 0 / buttons 0 after click). `handleLairRow` never invoked → cannot reach refusal seam → zero `lair_action_refused`.

Log GET `/api/campaigns/test-campaign/log` (own :80 GET) before = **32**; after all three row probes = **32, ZERO delta**, zero `lair_action_refused`. HPs untouched: YWD 123 / Bandit 1 868 / Bandit 2 864. Console 0 errors.
Screenshot: `.opencode/plans/ma1807-1809-lair-rows-inert.png`.

## Fix note — ADULT-WHITE JAGGED ICE MA PRECEDENT on disk (byte-proven)

Canonical fixed twin: **adult-white-dragon `lair_actions[1]` "Jagged Ice Shards"** — byte-identical ice prose (headless `===` true) PLUS `name:"Jagged Ice Shards"`, `attack_bonus:7`, `range:"120 ft."`. Shape:

```
{name:"Jagged Ice Shards", description:"<same ice prose>", attack_bonus:7, range:"120 ft.", damage_dice_primary:"3d6", damage_type_primary:"Piercing"}
```

Headless this session: `isLairRowClickable` **true**, `lairRowAffordance` **`'attack'`** (monsterLairActions.js:42 `row.attack_bonus != null → 'attack'` — reachable only because name passes gate :26). Recommended fix = promote this nameless dict to that exact adult dict (add `name` + `attack_bonus:7` + `range:"120 ft."`) → arms the existing attack-roll seam (+7 to hit, 3d6 piercing), the "+7 to hit" prose becomes a machine-enforced field. NOTE: this young row is the ATTACK lane (adult Jagged Ice Shards), NOT the save lane like the fog rows MA-1807/1808.

## Grep-zero advisory (§70)

Manifest grep `freezing.?fog|difficult.?terrain` / ice-shard attack: no registered consumer for the young lair ice attack beyond the manifest's own un-verified row. DO NOT edit `docs/monster-actions-manifest.json`.

## State left

Board left IN initiative round 1 (Young White Dragon 1 123/123 ini 9, Bandit 1 hp 868, Bandit 2 hp 864). Final Young White Dragon lair row of the session. No disk data edits; manifest untouched; no git writes.
