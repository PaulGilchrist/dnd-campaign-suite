# MA-1807 — Young White Dragon lair_actions[0] (freezing fog) — BARE STRING INERT

**Status: FAIL(b) / DATA — bare legacy string never becomes clickable.**
Exact bare-string twin of MA-1747/MA-1753/MA-1760/MA-1766/MA-1802; next lane of the systemic young-dragon lair_actions data-generation defect (26 twins today). `typeof la === 'string'` short-circuits the static branch at MonsterCardBody.jsx:358 BEFORE `isLairRowClickable` is ever called — the row cannot reach the name gate (monsterLairActions.js:26), cannot reach the refusal seam, cannot become a chip.

## Disk quote (public/data/monsters.json, Young White Dragon) — DISK WINS

`lair_actions[0]` (this row — MA-1807) = **BARE STRING** (no dict, no `name`, no `save_dc`, no `zone`, no `advisory`):

```
"Freezing fog fills a 20-foot-radius sphere centered on a point the dragon can see within 120 feet of it. The fog spreads around corners, and its area is heavily obscured. Each creature in the fog when it appears must make a DC 10 Constitution saving throw, taking 10 (3d6) cold damage on a failed save, or half as much damage on a successful one. A creature that ends its turn in the fog takes 10 (3d6) cold damage. A wind of at least 20 miles per hour disperses the fog. The fog otherwise lasts until the dragon uses this lair action again or until the dragon dies."
```

Distinguished from siblings (byte-identity, headless `===` this session):
- `lair_actions[1]` = MA-1808 — `row0 === row1.description` **true** — same fog prose inside a **nameless dict** (`description`, `save_dc:10`, `save_type:"Constitution"`, `damage_dice_primary:"3d6"`, `damage_type_primary:"Cold"` — no `name`). Dies one gate later (name gate monsterLairActions.js:26) but same inert static lane, byte-identical rendered output.
- `lair_actions[2]` = MA-1809 — jagged ice shards dict, also nameless.
- Manifest agrees: MA-1807 `stableKey young-white-dragon|lair_actions|0`, `actionType "other"`, `actionName "Unnamed lair actions 1"` — matches disk (bare string has no name). Manifest NOT edited.

## Kill chain (code fingerprints)

- `src/components/encounter/MonsterCardBody.jsx:358` — `if (typeof la === 'string' || !isLairRowClickable(la))` → bare string hits the FIRST disjunct; static branch :361 plain `<span dangerouslySetInnerHTML>`; clickable chip lane (:377-391) unreachable.
- `src/services/encounters/monsterLairActions.js:25-26` — `!row.name` name gate never even invoked for this row (string died at the render gate).
- Headless (node import, this session): `isLairRowClickable(row0)` = **false**, `lairRowAffordance(row0)` = **null** as-authored.

## Live probe (test-campaign — header verified `test-campaign`; :5173/:80 up)

Board IN initiative round 1: **Young White Dragon 1** (123/123, ini 9), **Bandit 1** (hp 868), **Bandit 2** (hp 864). `.mc-overlay` open via INNER `img.avatar-image[alt="Young White Dragon 1"]`.

Lair Actions section = exactly 3 rows (`div.mc-action` after `.mc-section-title` "Lair Actions"). Row #1 (MA-1807) affordance inventory:

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

Byte-identical rendered output to lair row #2 (MA-1808). Contrast: SAME overlay Actions section renders live chips (Rend `+7` `role=button` `tabindex=0` cursor:pointer) — the absence is the gate, not a card-wide render failure.

Click probe row #1 → **zero effect**: no popup, no `mc-prerequisite-refusal` (count 0), no save/attack prompt (0), overlay still open unchanged, row unchanged (chips 0 / buttons 0 after click).

Log GET `/api/campaigns/test-campaign/log` (own :80 GET) before = **32**; after all three row probes = **32, ZERO delta**, zero `lair_action_refused` (no affordance → `handleLairRow` never invoked — cannot reach refusal seam). HPs untouched: YWD 123 / Bandit 1 868 / Bandit 2 864. Console 0 errors.
Screenshot: `.opencode/plans/ma1807-1809-lair-rows-inert.png`.

## Fix note — ADULT-WHITE FREEZING FOG MA PRECEDENT on disk (byte-proven)

Canonical fixed twin: **adult-white-dragon `lair_actions[0]` "Freezing Fog"** — `description` byte-identical to this row (headless `===` true). Shape:

```
{name:"Freezing Fog", description:"<same fog prose>", save_dc:10, save_type:"Constitution", damage_dice_primary:"3d6", damage_type_primary:"Cold", dc_success:"half"}
```

Headless this session: `isLairRowClickable` **true**, `lairRowAffordance` **`'save'`** (monsterLairActions.js:41 `save_dc != null` branch — authored DC 10 CON enforced at the existing save seam, half-on-success math MV-20/MV-27). Recommended fix = promote this bare string to that exact adult dict.

## Fog/difficult-terrain grep-zero advisory (§70)

Manifest grep `freezing.?fog|difficult.?terrain` filtered to white dragons: **grep-zero** (only beholder/tyrannic difficult-terrain prose elsewhere; no registered fog/terrain row). `src/` grep `freezing`: only `freezing_sphere` spell handler + Freezing Burst te prose + flavor — **no lair-fog zone/obscurement consumer**; heavily-obscured and end-turn-3d6-in-fog clauses have no engine — GM-enforced residual even post-fix (advisory/damage legs arm; fog zone does not spawn). DO NOT edit `docs/monster-actions-manifest.json`.

## State left

Board left IN initiative round 1 (Young White Dragon 1 123/123 ini 9, Bandit 1 hp 868, Bandit 2 hp 864) for MA-1808. No disk data edits; manifest untouched; no git writes.
