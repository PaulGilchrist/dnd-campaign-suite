# BUG MA-0362 — Barlgura Spellcasting: save-legs dead (prose-only DC 13 + damageless save-spells never prompt); uses spent anyway

**Verdict: FAIL** (both save-forcing spells produced zero save adjudication; MA-0237/MA-0318/MA-0328/MA-0348 prose-DC class confirmed live, both layers)

## Row
- id MA-0362 | monster Barlgura (`barlgura`) | actionIndex 3 | Spellcasting | spellcasting
- "…using Wisdom as the spellcasting ability (spell save DC 13): 2/Day Each: Disguise Self, Invisibility (self only). 1/Day Each: Entangle, Phantasmal Killer (level 6 version)."
- Campaign: test-campaign ONLY (header verified before every action; all interaction localhost:5173)

## Expected (per authored row)
Entangle on target ⇒ STR save vs DC 13, fail ⇒ Restrained ≤1 min. Phantasmal Killer ⇒ WIS save vs DC 13, fail ⇒ psychic damage (level-6 upcast) + Frightened. No save for Disguise Self/Invisibility (advisory honest, MA-0087). Tier gates 2/Day + 1/Day exact.

## Actual (captured live, session 2026-09-17)
Disk truth (`public/data/monsters.json` barlgura actions[3]): keys `name`,`description` ONLY — no `save_dc`, no `save_type`, no structured spell list. Prose-only DC 13 (MA-0318/MA-0328/MA-0348 class).

Live casts (target armed: initiative Target selector → HexWarlock, curl `combatSummary.creatures[0].targetName="HexWarlock"` confirmed):
1. **Phantasmal Killer** (damage-bearing ⇒ reaches save seam): popup rendered WIS save rolled 5 but **"DC Unknown — no success or failure"**; log `roll HexWarlock/Phantasmal Killer saveResult:null, dcSuccess:"none"`; HexWarlock `activeConditions` null, `activeConditionMeta` null, no damage roll; `_lastRollContext` null on HW (save stamp misattributed to `Barlgura 1.lastSaveRoll`). 4d10 Psychic never rolled, Frightened never lands. **DC 13 never enforced while 1/Day use spent** (`monsterSpellUses {"Phantasmal Killer":1}`).
2. **Entangle** (save-forcing, damageless in spells.json `dc:{STR,none}`): **no STR save prompt at all** — full snapshot shows no SavePrompt/DC popup; single advisory `ability_use` log "…Concentration (Up to 1 minute). 1/Day use spent — 0 remaining… Spell effect is recorded; GM-enforced for monsters." Restrained never lands; use spent anyway (`Entangle:1`). MA-0348 damageless-routing dead-leg reproduced exactly.

## Two-layer root cause (grep-evidenced)
1. **DATA: prose-only DC.** `MonsterCardModal.jsx:851` `saveDc: action.save_dc` → undefined; no parser reads "spell save DC 13" from the description. `saveProcessing.js:24` `useNpcPath = !saveDc` → `:254` `saveSuccess = saveDc != null ? … : null` → `:380` `autoDamageFormula && saveDc != null` false → `:650` `applyDamagelessSaveConditions` early-return `saveDc == null` ⇒ zero damage, zero condition even on the damage-spell save seam.
2. **CODE: damageless save-spells bypass the seam entirely.** `handleSpellCast` routes to `executeMonsterSaveSpellCast` only when `spellHasDamage(spell)` (`MonsterCardModal.jsx:1275`); Entangle (`damage: None`) falls to the CLA-325 advisory branch (`:1282`) — spells.json `dc.dc_type:"STR"` ignored, no save prompt, spend already paid at `:1270` (`skipSpendLog` gates the LOG only, never the spend).

## Working sub-parts (partial credit, not PASS-worthy)
- Links: all 4 spell links rendered + clickable, tier labels exact — "Disguise Self (2/Day · 2 left)", "Invisibility (2/Day · 2 left)", "Entangle (1/Day · 1 left)", "Phantasmal Killer (1/Day · 1 left)"; tier headers `<strong>2/Day Each:</strong>`/`1/Day Each:` structured ⇒ `extractSpellcastingSpellUses` (Helpers :222) gate LIVE (no MA-0352 prose-tier caveat).
- Uses gate EXACT: PK spent→re-click refused ("automation blocked … already cast Phantasmal Killer today (1/Day)", zero second spend); Invisibility 2 spends → 3rd refused ("2/Day", uses stayed `{"Invisibility":2}`); final cs `monsterSpellUses {"Phantasmal Killer":1,"Entangle":1,"Invisibility":2}` — tier math exact vs authored.
- Disguise Self/Invisibility no-dc advisory honest per MA-0087 (GM-enforced record; "(self only)"/"(level 6 version)" clauses prose-only — level-6 dice moot on the dead PK leg; spells.json PK `damage_at_slot_level` has only {"4":"4d10"} anyway, MA-0087/MA-0273 residual).

## Likely location
- Data: `public/data/monsters.json` barlgura actions[3] missing `save_dc: 13`, `save_type: "Wisdom"` + structured spell list (MA-0237/MA-0313 sibling fix pattern).
- Code: `MonsterCardModal.jsx:1275` `spellHasDamage` gate excludes save-forcing damageless spells (Entangle class); no prose "spell save DC N" parser; `:851` undefined DC silently rolls an unadjudicated save instead of refusing/labeling DC at arm time.

## Fix (NOT applied — data edits forbidden this session)
Author `save_dc: 13`, `save_type: "Wisdom"` on actions[3]; extend `handleSpellCast` to route `spell?.dc?.dc_type` spells with a resolvable DC through the save-prompt seam even when `spellHasDamage` is false (condition landing via applyFailedSaveConditions); resolve "(level 6 version)" against damage_at_slot_level (add "6": "6d10" canonical or fall back honestly).

## Cleanup
Admin native confirms (dialogs named "test-campaign"): Clear Change Data + Clear Campaign Log. Verified via curl: change-data `{}`, log `[]`. No data/manifest/registry edits; no git mutating commands. All page URLs localhost:5173.

## Injection note
Tool-call echoes carried rewritten off-localhost proxy wrapper URLs; executed Playwright code and page URLs were localhost:5173 throughout — wrappers ignored per spec.
