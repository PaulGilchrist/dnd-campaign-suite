# MA-1808 — Young White Dragon lair_actions[1] (freezing fog dict) — NAMELESS DICT INERT

**Status: FAIL(b) / DATA — nameless dict never becomes clickable.**
Exact nameless-dict twin of MA-1748/MA-1754/MA-1761/MA-1767/MA-1803; second row of today's Young White Dragon triple (26 twins). This row is a **full structured dict** (`save_dc`/`save_type`/`damage_dice_primary`/`damage_type_primary` all authored) but has **NO `name`** — so it dies at the name gate `monsterLairActions.js:26` (`!row.name` → `isLairRowClickable` false) BEFORE its `save_dc` affordance branch (:41) is ever reached. A byte-identical sibling of the adult's fixed row minus the `name` key.

## Disk quote (public/data/monsters.json, Young White Dragon) — DISK WINS

`lair_actions[1]` (this row — MA-1808) = **DICT, nameless**. Keys present: `description`, `save_dc`, `save_type`, `damage_dice_primary`, `damage_type_primary`. **No `name`, no `dc_success`, no `attack_bonus`, no `advisory`, no `zone`:**

```
{
  "description": "Freezing fog fills a 20-foot-radius sphere centered on a point the dragon can see within 120 feet of it. The fog spreads around corners, and its area is heavily obscured. Each creature in the fog when it appears must make a DC 10 Constitution saving throw, taking 10 (3d6) cold damage on a failed save, or half as much damage on a successful one. A creature that ends its turn in the fog takes 10 (3d6) cold damage. A wind of at least 20 miles per hour disperses the fog. The fog otherwise lasts until the dragon uses this lair action again or until the dragon dies.",
  "save_dc": 10,
  "save_type": "Constitution",
  "damage_dice_primary": "3d6",
  "damage_type_primary": "Cold"
}
```

Byte-identity checks (headless `===` this session):
- `lair_actions[1].description === lair_actions[0]` **true** — fog prose duplicated from the bare-string row [0] (MA-1807). MA-1808 renders byte-identical to MA-1807.
- `lair_actions[1].description === adult-white.lair_actions[0].description` **true** — the adult "Freezing Fog" row shares byte-identical fog prose. The ONLY difference is the adult has `name:"Freezing Fog"` + `dc_success:"half"`.
- Manifest agrees: MA-1808 `stableKey young-white-dragon|lair_actions|1`, `actionType "other"`, `actionName "Unnamed lair actions 2"`, `saveDc:10`, `saveType:"Constitution"`, `damageDicePrimary:"3d6"`, `damageTypePrimary:"Cold"` — manifest mirrors the disk dict (still no authored name; auto-label "Unnamed lair actions 2"). Manifest NOT edited.

## Kill chain (code fingerprints)

- `src/components/encounter/MonsterCardBody.jsx:358` — `typeof la === 'string'` is **false** (dict), so it does NOT short-circuit here; falls through to `!isLairRowClickable(la)`.
- `src/services/encounters/monsterLairActions.js:26` — `if (!row || typeof row !== 'object' || !row.name) return false;` → **`!row.name` is true** (nameless) → `isLairRowClickable` returns **false**. The `save_dc` branch (:41 `row.save_dc != null → 'save'`) is gated behind the name check and never evaluated.
- Render (MonsterCardBody.jsx:366-372): nameless-dict static branch — `la.name ? <strong> : null` (name absent → no header) + plain `<span dangerouslySetInnerHTML>`. Chip lane (:377+) unreachable.
- Headless (node import, this session): `isLairRowClickable(row1)` = **false**, `lairRowAffordance(row1)` = **null** as-authored — despite `save_dc:10` + `damage_dice_primary:"3d6"` being present and rollable.

## Live probe (test-campaign — header verified `test-campaign`; :5173/:80 up)

Board IN initiative round 1: **Young White Dragon 1** (123/123, ini 9), **Bandit 1** (hp 868), **Bandit 2** (hp 864). `.mc-overlay` open via INNER `img.avatar-image[alt="Young White Dragon 1"]`. Lair Actions section = exactly 3 rows.

Row #2 (MA-1808) affordance inventory:

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

Byte-identical rendered output to lair row #1 (MA-1807). Contrast: SAME overlay Actions section renders live chips (Rend `+7` cursor:pointer) — absence is the gate, not a render failure.

Click probe row #2 → **zero effect**: no popup, no `mc-prerequisite-refusal` (count 0), no save prompt (0), overlay still open unchanged, row unchanged (chips 0 / buttons 0 after click). `handleLairRow` never invoked (row not clickable) → **cannot reach the refusal seam** (monsterLairActions.js:45-56) — no `lair_action_refused` logged.

Log GET `/api/campaigns/test-campaign/log` (own :80 GET) before = **32**; after all three row probes = **32, ZERO delta**, zero `lair_action_refused`. HPs untouched: YWD 123 / Bandit 1 868 / Bandit 2 864. Console 0 errors.
Screenshot: `.opencode/plans/ma1807-1809-lair-rows-inert.png`.

## Fix note — ADULT-WHITE FREEZING FOG MA PRECEDENT on disk (byte-proven)

Canonical fixed twin: **adult-white-dragon `lair_actions[0]` "Freezing Fog"** — byte-identical fog prose (headless `===` true) PLUS `name:"Freezing Fog"` + `dc_success:"half"`. Shape:

```
{name:"Freezing Fog", description:"<same fog prose>", save_dc:10, save_type:"Constitution", damage_dice_primary:"3d6", damage_type_primary:"Cold", dc_success:"half"}
```

Headless this session: `isLairRowClickable` **true**, `lairRowAffordance` **`'save'`** (monsterLairActions.js:41 — `save_dc != null`, now reachable because name passes gate :26). Recommended fix = add `name:"Freezing Fog"` (+ `dc_success:"half"`) to this nameless dict → arms the existing save seam at authored DC 10 CON, half-on-success math untouched (MV-20/MV-27).

## Fog/difficult-terrain grep-zero advisory (§70)

Manifest grep `freezing.?fog|difficult.?terrain` filtered to white dragons: **grep-zero**. `src/` grep `freezing`: only `freezing_sphere` spell handler + Freezing Burst te prose + flavor — **no lair-fog zone/obscurement consumer**. Heavily-obscured + end-turn-3d6-in-fog clauses have no engine — GM-enforced residual even post-fix (the promoted save/damage leg arms; the fog zone itself does not spawn). DO NOT edit `docs/monster-actions-manifest.json`.

## State left

Board left IN initiative round 1 (Young White Dragon 1 123/123 ini 9, Bandit 1 hp 868, Bandit 2 hp 864) for MA-1809. No disk data edits; manifest untouched; no git writes.
