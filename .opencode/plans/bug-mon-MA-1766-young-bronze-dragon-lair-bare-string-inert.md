# MA-1766 — Young Bronze Dragon lair_actions[0] "Unnamed lair actions 1" (fog cloud) — BARE STRING INERT

**Status: FAIL(b) / DATA — bare legacy string never becomes clickable.**
MA-1747/MA-1753/MA-1760 exact bare-string twin. `typeof la === 'string'` short-circuits the static branch at MonsterCardBody.jsx:358 BEFORE `isLairRowClickable` is ever called — the row cannot even reach the name gate (monsterLairActions.js:26), cannot even reach the refusal seam.

## Disk quote (public/data/monsters.json, young-bronze-dragon)

`lair_actions[0]` (this row — MA-1766) = **BARE STRING** (no dict, no `name`, no `save_dc`, no `zone`):

```
"The dragon creates fog as though it had cast the fog cloud spell. The fog lasts until initiative count 20 on the next round."
```

Distinguished from sibling:
- `lair_actions[1]` = MA-1767 — byte-identical fog prose inside a nameless dict (`description` ONLY — no `name`/`save_dc`/`save_type`/`zone`; leaner than MA-1761 brass which carried authored DC/type). DISK WINS: raw forms re-quoted from disk this session; manifest labels "Unnamed lair actions 1/2" agree — neither row has a `name`.
- Young Bronze duplicate = same fog spell in BOTH slots (canonical MM young bronze has fog + hail/wind variants; disk ships the fog prose twice — data-generation dup defect).

## Kill chain (code fingerprints, live-confirmed today)

- `src/components/encounter/MonsterCardBody.jsx:358` — `if (typeof la === 'string' || !isLairRowClickable(la))` → bare string hits the FIRST disjunct; static branch :361 plain `<span dangerouslySetInnerHTML>`; clickable chip lane unreachable.
- `src/services/encounters/monsterLairActions.js:25-26` — `!row.name` name gate never even invoked for this row (string died at the render gate).
- Headless (node import, this session): `isLairRowClickable(row0)` = **false**, `lairRowAffordance(row0)` = **null** as-authored.

## Live probe (test-campaign, 2026-09-30 — header verified `test-campaign`)

Board IN initiative round 1 (hot from MA-1765): Young Bronze Dragon 1 (142/142, init 11), Bandit 1 (hp 841, Prone DC 15 badge + instant push marker te value 40), Bandit 2 (hp 913, same). Servers :5173/:80. `.mc-overlay` open on INNER `img.avatar-image` "Young Bronze Dragon 1".

Lair row #1 affordance inventory (rendered `div.mc-action`):

| affordance | present |
|---|---|
| `<strong>` name header | ❌ 0 |
| `<button>` | 0 |
| `[role=button]` | 0 |
| `tabindex=0` | 0 |
| `.mc-dice-link` / `.mc-dice-link-lair` chips | 0 |
| icons | 0 |
| computed cursor | `auto` (not pointer) |

Single plain `<span>` child; byte-identical rendered output to lair row #2 (MA-1767). Contrast: SAME overlay renders live chips Rend `+8`, Lightning Breath `9d10`, Repulsion Breath `DC 15 Strength` — absence is the gate, not a card-wide render failure.

Click probe row #1 → **zero effect**: no popup, no `mc-prerequisite-refusal`, no save prompt, overlay unchanged.
Log GET `/api/campaigns/test-campaign/log` (own :80 GET) before = 31; after both row probes = **31, zero delta**, zero `lair_action_refused` (row cannot reach refusal seam — no affordance → `handleLairRow` never invoked, MonsterCardModal.jsx:2364). Zero console errors.
Screenshot: `.opencode/plans/ma1766-1767-lair-rows-inert.png`.

## Fix note — ADULT-BRONZE STRUCTURED TEMPLATE on disk (byte-proven)

Canonical fixed twin: **adult-bronze-dragon `lair_actions[0]` "Fog Cloud"** — `description` byte-identical to this row (headless `===` true), shape:
`{name:"Fog Cloud", description, zone:{radius_ft:20, no_save:true, noun:"fog", effect_key:"lair_fog_cloud", advisory:"…GM-enforced…"}, duration:"until initiative count 20 next round (advisory)"}`
Headless: clickable **true**, affordance **`'zone'`** (monsterLairActions.js:40 — zone with `save_dc == null` arms the area picker zoneOnly, MA-0043 lane; te badge `lair_fog_cloud` exists in registry :1218). Recommended fix = promote this string to that exact adult dict. NO save fields needed (canonical fog = no save).

## Fog/duration clause grep-zero advisory (§70)

Grep `fog_cloud` consumers app-wide: only `targetEffectDefinitions.js:1218` (badge/definition prose — no obscurement engine applies lightly-obscured) and `monsterUtilitySpellCast.js:82` (`fog_cloud_refused` refusal seam for UTILITY spellcasting, not lair). Initiative-count-20 expiry: grep-zero consumer outside registry + lair-lane prose — GM-enforced residual even after fix. DO NOT edit `docs/monster-actions-manifest.json`.

## Systemic note

Extends the inert-lair-row streak: 8 young-chromatic rows earlier today (black trio MA-1747/48/49 → blue trio MA-1753/54/55 → brass pair MA-1760/61) + this bronze pair = **10 consecutive inert young-dragon lair rows**. Young chromatic dragons ship lair_actions as duplicated prose (bare string + nameless dict copy) while the adult twin is fixed structured. Systemic young-dragon lair_actions data-generation defect, not per-monster noise.

## State left
Board left IN initiative round 1 for MA-1767. No disk data edits; manifest untouched; no git writes.
