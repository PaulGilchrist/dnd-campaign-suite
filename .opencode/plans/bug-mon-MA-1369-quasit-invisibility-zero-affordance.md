# MA-1369 — Quasit Invisibility (actions[1]) — FAIL(b)/DATA

## Row under test (disk read-back, public/data/monsters.json quasit actions[1])
```json
{
  "name": "Invisibility",
  "description": "The quasit casts <strong>Invisibility</strong> on itself, requiring no spell components and using Charisma as the spellcasting ability.",
  "attack_bonus": 0,
  "save_dc": 0,
  "save_type": "Charisma",
  "save_effect": "",
  "range": "",
  "reach": "",
  "recharge": ""
}
```
Manifest save_type "Charisma" = CASTING ability (row has no target save; RAW Invisibility = self-cast, no save). save_dc:0 decoy.

## Verdict: FAIL(b)/DATA — zero-affordance self-cast prose row, machinery LIVE-unarmed

### Control census (live, .mc-action strong.startsWith('Invisibility'), Initiative avatar card, Quasit 1 AC13 HP25 EB-joined idx0)
- 1 row, chips: **only junk `+0`** (`span.mc-dice-link` text "+0", MonsterAction.jsx:408-411 attack_bonus!=null gate — §490 junk chip, NEVER pressed; census>0 on narrative row = §117 violation evidence, not affordance)
- ZERO mc-dice-link-selfbuff / -advisory / -spell / -save chips; 0 buttons; 0 selects
- Mid-prose `<strong>Invisibility</strong>` renders NON-clickable (cursor:default, no onclick) — §161/§194/§203 fake-chip lane is Spellcasting-name-row-only, non-extension re-confirmed live
- ZERO DC chip: save_dc:0 fails `Number(save_dc) > 0` MA-1071 gate (SpellOrSaveLinks MonsterAction.jsx:367-369) — RAW-no-save honestly honored; pendingSavePrompts KEY ABSENT whole session (§736). No over-affordance → not FAIL(a).

### Press probe
9 presses (row header strong + description span + mid-prose bold, x3): log delta **0/9**. Zero ability_use, zero casts, zero popup.

### State probes
- change-data top-level `targetEffects` KEY ABSENT; `pendingSavePrompts` KEY ABSENT
- cs Quasit activeConditions:null / no invisibility field — no self-te, no invisible hint
- Log whole-session: join-noise only (encounter + roll/initiative, §146) — zero cast entries
- Console 0 errors

### Why FAIL(b), not advisory-PASS
No affordance of ANY honest kind exists to press; nothing can log a cast, so "GM-enforced advisory" cannot even be recorded (§60/§195/§362 fingerprint). The row is the §362 named **unarmed twin** ("Imp/Quasit/Sprite/Will-o'-Wisp") — Imp since fixed (MA-1016/MA-1019), Quasit never armed.

### Fix (zero code — live seam, imps byte-twin)
Whole-DB self-cast invisibility census (python, this session): ARMED = duergar, green-hag, imp `automation:{type:"monster_self_buff",effect:"invisible",rounds:600}` with `attack_bonus` KEY STRIPPED; UNARMED = **quasit**, sprite, will-o-wisp.
Quasit fix = imp MA-1019 byte-shape: REMOVE junk `attack_bonus:0` key (+ save_dc:0/save_type noise optional) and add
```json
"spellcasting_ability": "Charisma",
"automation": {"type": "monster_self_buff", "effect": "invisible", "rounds": 600}
```
Seam: isMonsterSelfBuffRow monsterSelfBuff.js:25-27 → SelfBuffLink MonsterAction.jsx:255-268 (icon fa-eye-slash for invisible :262) → te `invisible` registered + ONE merged addExpiration rounds:600 (§37 hours×600; §226 note: prints "1 hour") + attack/cast/Enlarge enders (monsterSelfBuff.js:281-284). Sprites/Will-o'-Wisp share the twin ticket family.

## Ops ledger
- dev :5173 REUSE 200; test-campaign header verified post-select; localhost only
- Board was admin-cleared post-MA-1368 (log 0, cd []) → EB re-join Quasit (exact td[1] match, cb.click checked=true first try, 1 row — no Quasit name collision; Join auto-nav Initiative §444); saved PC party auto-joined 1/1 placeholders (§237/§439) — no victim needed for self-cast, none used
- Session end: admin clear-change-data + clear-log direct POST 200/200, quiet recheck cdKeys [] logLen 0
- Injection watch: Playwright navigate echo wraps carried off-site proxy URLs (expected §90 echo noise); every echoed URL VALUE checked = localhost; page stayed localhost; no fabricated directive obeyed
