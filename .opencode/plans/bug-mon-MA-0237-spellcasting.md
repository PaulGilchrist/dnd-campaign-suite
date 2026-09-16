# BUG MA-0237 — Ancient Red Dragon Spellcasting: save DC 23 NOT enforced (FAIL)

Row: `ancient-red-dragon | actions | Spellcasting` (MA-0237). Verified live 2026-09-15 on test-campaign, EB join "Ancient Red Dragon 1" (hp507 ac22), victim AberrantSorcerer armed via initiative target-select (cs creatures entry targetName=AberrantSorcerer).

## FAIL core: DC 23 unenforced on save-leg (Fireball)
- monsters.json row authors **only `name`+`description`** — NO numeric `save_dc`/`save_type` (sibling Ancient Gold Spellcasting authors `save_dc:24, save_type:"Charisma"`).
- `buildAbilitySaveRollContext` passes `saveDc: action.save_dc` → **undefined** (MonsterCardModal.jsx:815). No prose "spell save DC 23" parser exists (MonsterCardHelpers exports no DC-from-text helper; only `monsterSpellAttackBonus` parses text, :272).
- Live: Fireball click → save prompt renders **"DC Unknown — no success or failure"**; log save roll `saveDc` absent, `saveResult:null`; damage never adjudicated/rolled (no 12d6 roll entry, zero hp_change from Fireball). SP-109/MA-0091 family — DC truth never forwarded.
- Consequence: lv6 dice (app spells.json Fireball lv6 = **12d6**, not 12d8 as brief quoted) could not even be rolled/proven — adjudication dead at DC.

## PASS legs (exact, everything else on row works)
- Spell attack +15: Scorching Ray ×2 → `ability_use` "level 3 ranged spell attack +15 vs AberrantSorcerer, formula 2d6"; roll log `bonus:15`, HIT; damage rolls 2d6 Fire landed (7, 11 → hp_change −7/−11). MA-0033 prose fallback wired ✓.
- 1/Day gate: Fireball spend `ability_use` "1/Day use spent — 0 remaining"; re-click → `automation blocked` "already cast Fireball today (1/Day)" zero-spend, change-data `monsterSpellUses:{Fireball:1}` unchanged; link renders SPENT "Fireball (1/Day · 0 left)". Scrying spend `{Scrying:1}` ✓.
- At-Will free: Scorching Ray 2nd cast + Detect Magic + Command all fired with NO uses-key writes (uses map holds only Fireball/Scrying). Command/Detect Magic = advisory record ("GM-enforced for monsters", CLA-325 — accepted).

## Fix shape (DATA-only)
Add `"save_dc": 23, "save_type": "Charisma"` to ancient-red-dragon Spellcasting action (mirror Ancient Gold sibling). All downstream (prompt DC, saveResult adjudication, half-on-success, spellCastLevelFromSpellcasting lv6 12d6 via MA-0087/0112 save-leg wiring) already consumes authored save_dc. Anchor edit on monster-unique text; JSON.parse + git diff after (MA-0209 pitfall).

## Residual notes
- Fireball 1/Day charge burned by the failing probe; monster uses reset is admin-clear/GM-side (MA-0005 residual).
- Brief's "Fireball lv6 = 12d8" contradicts app spells.json (12d6) — app data is truth (playbook §2).
