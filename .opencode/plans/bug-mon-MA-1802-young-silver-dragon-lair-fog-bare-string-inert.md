# MA-1802 — Young Silver Dragon lair_actions[0] (fog cloud) — BARE STRING INERT

**Status: FAIL(b) / DATA — bare legacy string never becomes clickable.**
MA-1747/MA-1753/MA-1760/MA-1766 exact bare-string twin. `typeof la === 'string'` short-circuits the static branch at MonsterCardBody.jsx:358 BEFORE `isLairRowClickable` is ever called — the row cannot reach the name gate (monsterLairActions.js:26), cannot reach the refusal seam, cannot become a chip.

## Disk quote (public/data/monsters.json, Young Silver Dragon) — DISK WINS

`lair_actions[0]` (this row — MA-1802) = **BARE STRING** (no dict, no `name`, no `advisory`, no `save_dc`, no `zone`):

```
"The dragon creates fog as if it had cast the fog cloud spell. The fog lasts until initiative count 20 on the next round."
```

Distinguished from sibling (byte-identity, headless `===` this session = **true**):
- `lair_actions[1]` = MA-1803 — byte-identical fog prose inside a **nameless dict** (`description` ONLY — no `name`/`advisory`/`save_dc`/`zone`). Dies one gate later (name gate :26) but same inert static lane, byte-identical rendered output.
- Young Silver duplicate = same fog spell in BOTH slots (data-generation dup defect; canonical MM young silver ships fog + cold-wind variants — disk ships the fog prose twice, cold-wind variant dropped).
- Manifest agrees: MA-1802 `stableKey young-silver-dragon|lair_actions|0`, `actionType "other"`, `name:null` — matches disk (bare string has no name). Manifest NOT edited.

## Kill chain (code fingerprints)

- `src/components/encounter/MonsterCardBody.jsx:358` — `if (typeof la === 'string' || !isLairRowClickable(la))` → bare string hits the FIRST disjunct; static branch :361 plain `<span dangerouslySetInnerHTML>`; clickable chip lane (:377-391) unreachable.
- `src/services/encounters/monsterLairActions.js:25-26` — `!row.name` name gate never even invoked for this row (string died at the render gate).
- Headless (node import, this session): `isLairRowClickable(row0)` = **false**, `lairRowAffordance(row0)` = **null** as-authored.

## Live probe (test-campaign — header verified `test-campaign`; servers :5173/:80 up)

Board IN initiative round 1: **Young Silver Dragon 1** (168/168, init 20, Large Dragon Metallic LG, CR 9), **Bandit 1** (hp 733), **Bandit 2** (hp 794, `Incapacitated` + `Paralyzed` badges + "Adv vs"). Only these three render `img.avatar-image` (NPC rows); party PCs render as initials. `.mc-overlay` open via INNER `img.avatar-image` ("Young Silver Dragon 1").

Lair row #1 affordance inventory (`div.mc-section > div.mc-action`, DOM-probed this session):

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

Byte-identical rendered output to lair row #2 (MA-1803). Contrast: SAME overlay renders 14 live `.mc-dice-link` chips (Rend `+10`, Cold Breath `11d8`/`DC 17 Constitution`, Paralyzing Breath `DC 17 Constitution`, initiative `+4 (14)`, ability +skill chips) — the absence is the gate, not a card-wide render failure.

Click probe row #1 → **zero effect**: no popup, no `mc-prerequisite-refusal` (count 0), no save/attack prompt (0), overlay still open unchanged, row unchanged (chips 0 / buttons 0 after click).

Log GET `/api/campaigns/test-campaign/log` (own :80 GET) before = **41**; after both row probes = **41, ZERO delta**, zero `lair_action_refused` (no affordance → `handleLairRow` never invoked — cannot reach refusal seam). Zero console errors.
Screenshot: `.opencode/plans/ma1802-1803-lair-rows-inert.png`.

## Fix note — ADULT-SILVER ADVISORY TEMPLATE on disk (byte-proven)

Canonical fixed twin: **adult-silver-dragon `lair_actions[0]` "Fog Cloud"** — `description` byte-identical to this row (headless `===` true). Shape:
`{name:"Fog Cloud", advisory:"fog_cloud", description:"<same fog prose>"}`
Headless this session: `isLairRowClickable` **true**, `lairRowAffordance` **`'advisory'`** (monsterLairActions.js:27 `row.advisory` truthy → clickable; :41 advisory branch → advisory record). Recommended fix = promote this bare string to that exact adult dict. **NOTE vs bronze lane:** adult SILVER fog carries NO `zone` block (unlike adult bronze `zone:{effect_key:"lair_fog_cloud"}`) — the silver fix arms the spell-named `advisory` log seam, NOT the area picker; there is no `effect_key` to register for silver fog.

## Fog/duration clause grep-zero advisory (§70 — MA-1766 registered-unspawned precedent)

`fog_cloud` / `lair_fog_cloud` grep across `src/`: `targetEffectDefinitions.js:1218` (`lair_fog_cloud` badge/definition prose only — no obscurement engine applies lightly-obscured) + `monsterUtilitySpellCast.js:82` (`fog_cloud_refused` refusal seam for UTILITY spellcasting, not lair). Initiative-count-20 fog expiry: grep-zero consumer outside registry + lair-lane prose — GM-enforced residual even post-fix. For SILVER the promoted row is advisory-only so it spawns no te at all (bronze's `lair_fog_cloud` zone-te is itself registered-unspawned; silver doesn't even reference it). DO NOT edit `docs/monster-actions-manifest.json`.

## Systemic note

Extends the inert young-dragon lair-row streak (black → blue → brass → bronze pairs earlier this run; this Young Silver pair is the next lane of the same systemic young-dragon lair_actions data-generation defect). Young chromatic/metallic dragons ship lair_actions as duplicated prose (bare string + nameless dict copy) while their adult twins are already structured. `MonsterCardBody.jsx:357 / monsterLairActions.js:25` lane — both young-silver rows inert.

## State left

Board left IN initiative round 1 (Young Silver Dragon 1 init 20, Bandit 1 hp 733, Bandit 2 hp 794 Incapacitated+Paralyzed) for MA-1803. Overlay left open. No disk data edits; manifest untouched; no git writes.
