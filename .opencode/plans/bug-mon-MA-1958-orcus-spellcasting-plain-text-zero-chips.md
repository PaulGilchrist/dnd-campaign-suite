# BUG MA-1958 — Orcus "Spellcasting": plain-text spell names render ZERO chips; DC 23 Wisdom never adjudicable (MA-0421 family)

**Verdict: FAIL(b)/DATA** — the row has NO affordance at all: zero spell chips, zero save shell, zero buttons. Six native word-level clicks produce byte-zero log/change-data delta with a silent console. This is the §89/§118/§122 plain-text fingerprint (MA-0524/0532/MA-0421 archmage/MA-1327 Planetar family), confirmed live.

## Row
- id MA-1958 · `orcus|actions|5` · actionType spellcasting
- actionName: "Spellcasting" · row carries `save_dc: 23`, `save_type: "Wisdom"` (numeric pair present)
- description (disk, verbatim, **no `<strong>`/`<em>` anywhere**):
  `"Orcus casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 23): At Will: Detect Magic. 3/Day: Dispel Magic. 1/Day: Time Stop."`

## Live evidence (test-campaign, dev :5173, 2026-10-12)
- Fresh EB exact-"Orcus" join into empty cs → `Orcus 1` cs idx0, AC17, 405/405, init 10, monsterIndex "orcus". Card opened via `.creature-card:has(img[alt="Orcus 1"])` (first click absorbed ×1, retry landed; no popups at any stage).
- **Chip census on the Spellcasting row (`rows[8]` of 13)**:
  - `span.mc-dice-link-spell` → **0**
  - `.mc-dice-link` (any flavor) → **0**
  - `button` → **0**
  - rendered rowHTML: `<strong>Spellcasting.</strong> <span>Orcus casts one of the following spells … 3/Day: Dispel Magic. 1/Day: Time Stop.</span>` — spell names AND tier headers are plain text inside one span; the only `<strong>` is the renderer's own row-name label.
  - "DC 23" / "Wisdom" appear **nowhere** in the row (row text ends at the prose).
- **Same-card XOR oracle**: sibling row `rows[9]` "Wand Spellcasting" (MA-1959, untouched) renders a live **"DC 18 Wisdom"** save shell — proving the fork is the exact row-NAME test, and that Orcus's row-level `save_dc:23`/`save_type:"Wisdom"` are consumed by NOTHING on a row literally named "Spellcasting".
- **Control probe** (row is inert — no target arming needed): 6 real `page.mouse.click` presses at Range-rect word centers — `Detect Magic`, `Dispel Magic`, `Time Stop`, `At Will:`, `3/Day:`, `1/Day:` → **popups: 0**, `GET /log` byte-diff vs baseline: **zero delta**, `GET /change-data` byte-diff: **zero delta**, `monsterSpellUses` key never stamped, console errors 0 (only pre-existing meta/class_level_scaling warnings). No §161 fake-chip junk either — plain text yields nothing at all.

## Root cause (file:line)
- `src/components/encounter/MonsterCardHelpers.js:398-409` — `extractSpellNamesFromSpellcasting` requires `/<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g`; Orcus's description contains no such markup → `[]`.
- `src/components/encounter/MonsterAction.jsx:422` — `isSpellcastingRow = /^spellcasting$/i.test(action.name)`; `:374-376` `SpellOrSaveLinks` returns `<SpellCastLinks>` **unconditionally** for Spellcasting-named rows; `SpellCastLinks :84` `if (names.length === 0) return null`.
- Consequence: the generic save shell branch at `:399` (`Number(action.save_dc) > 0 → ActionSaveRoll`) is **XOR-unreachable** on "Spellcasting" rows — the authored row-level `save_dc:23`/`save_type:"Wisdom"` never reach `buildSaveDc`/`buildSaveRollContext` (§89/§118/§122 re-confirmed live; MA-0576 playbook note that the numeric pair is required is HALF satisfied here — the pair exists, only the markup half is missing).

## Proposed DATA fix (MA-0421 archmage/lich template; MA-1327 Planetar twin)
`public/data/monsters.json` → Orcus `actions[5].description`, wrap tier headers + every spell name (keep prose; do NOT emphasis any other words — §161 decoy rule):

```
"Orcus casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 23):<br><strong>At Will:</strong> <em>Detect Magic</em>.<br><strong>3/Day:</strong> <em>Dispel Magic</em>.<br><strong>1/Day:</strong> <em>Time Stop</em>."
```

Post-fix expectations (byte-verified against extractors):
- `extractSpellNamesFromSpellcasting` → `["Detect Magic","Dispel Magic","Time Stop"]` → 3 gated chips `.mc-dice-link-spell` (MA-1879 lane).
- `extractSpellcastingSpellUses` → `<strong>3/Day:</strong>` matches `/^(\d+)\s*\/\s*Day(?:\s*Each)?:?$/i` → `{Dispel Magic:3, Time Stop:1}`; "At Will:" ends `:` → free tier. Gates: At Will unlimited; Dispel Magic 4th press refuses; Time Stop 2nd press refuses (`monsterSpellUses` + honest refusal popup).
- All three names resolve in `public/data/spells.json` AND `public/data/2024/spells.json` (verified 2026-10-12) — chips cast for real; Dispel Magic's save leg is the only save-bearing spell here (Time Stop/Detect Magic untargeted → advisory residuals, MA-0299/§144 burn-watch applies post-fix).
- Row-level `save_dc:23` + `save_type:"Wisdom"` stay as-is — with chips live they feed the per-spell save DC (MA-0576 pair requirement satisfied; markup was the sole gap).

## Residuals (documented, non-blocking for the fix)
- No Material/verbal component modeling in the engine; "(spell save DC 23)" prose is display-only even post-fix.
- At-Will Detect Magic / no-target Dispel Magic (on an effect) and Time Stop lack target semantics → post-fix presses will be advisory casts; per §144 verify uses are not silently burned without adjudication.

## Cleanup
test-campaign only. Card closed → Admin "Clear Change Data" + "Clear Campaign Log" → cd `{}` / log `[]` verified quiet 15s. No manifest edits, no git writes.
