# Bug: MA-1209 — Mummy Lord "Unnamed lair actions 3" (spell-cast pain, DC 16 CON) is inert (nameless raw-dict lair row + unparseable "per level" dice, no initiative-20 / spell-cast-trigger consumer)

## Overview
Manifest row MA-1209 (`mummy-lord`, `lair_actions[2]`, "Unnamed lair actions 3") describes a condition-triggered lair punishment: any non-undead creature that tries to cast a spell of 4th level or lower in the lair must make a DC 16 Constitution save or take 1d6 necrotic damage per spell level, the spell wasted, until initiative count 20 next round. Despite being the richest of the three rows on disk (it authors `save_dc:16`, `save_type:"Constitution"`, `save_effect`, `damage_dice_primary:"1d6 per level"`, `damage_type_primary:"Necrotic"`), it has **no `name`**, so the lair affordance gate `isLairRowClickable` (`src/services/encounters/monsterLairActions.js:26`) returns `false` on `!row.name` (header comment line 17-18: "nameless dicts, MV-24, never become clickable") — the authored DC/type never reach `lairRowAffordance`/`resolveLairRow`. Additionally the dynamic-token damage `"1d6 per level"` fails `canRollExpression` (verified in node: `false`), the same §6 unparseable-dice family as MA-1207/08 — so even a named row would suppress its damage chip. The card renders it as static `.mc-action` prose with an orphan leading "." and no chip; pressing the row text ×2 produces a zero log-delta, no popup, no refusal record. No initiative-20 dispatcher and no spell-cast-trigger consumer exist app-wide (§5 fingerprint, re-confirmed live + static). FAIL(b). Third member of the MA-1207/MA-1208 same-pass family.

## Expected
Manifest row under test:

```json
{
  "id": "MA-1209",
  "monsterIndex": "mummy-lord",
  "monster": "Mummy Lord",
  "actionIndex": 2,
  "category": "lair_actions",
  "actionName": "Unnamed lair actions 3",
  "actionType": "other",
  "saveDc": 16,
  "saveType": "Constitution",
  "saveEffect": "The creature takes 1d6 necrotic damage per level of the spell, and the spell has no effect and is wasted.",
  "damageDicePrimary": "1d6 per level",
  "damageTypePrimary": "Necrotic",
  "description": "Until initiative count 20 on the next round, any non-undead creature that tries to cast a spell of 4th level or lower in the mummy lord's lair is wracked with pain. The creature can choose another action, but if it tries to cast the spell, it must make a DC 16 Constitution saving throw. On a failed save, it takes 1d6 necrotic damage per level of the spell, and the spell has no effect and is wasted."
}
```

Row would PASS only if clicking it produced an adjudicated/recorded effect honoring DC 16 Constitution — a save roll vs DC 16 with per-level damage math, or at minimum a record-only advisory log (§5 advisory shape) — and the caster-detection trigger ("tries to cast a spell of 4th level or lower") were enforced or explicitly GM-adjudicated.

## Actual
- **Static (monsters.json):** `mummy-lord.lair_actions[2]` verbatim is
  `{"description": "Until initiative count 20 on the next round, any non-undead creature that tries to cast a spell of 4th level or lower in the mummy lord's lair is wracked with pain. …", "save_dc": 16, "save_type": "Constitution", "save_effect": "The creature takes 1d6 necrotic damage per level of the spell, and the spell has no effect and is wasted.", "damage_dice_primary": "1d6 per level", "damage_type_primary": "Necrotic"}` — save fields authored but **no `name`**, no `advisory`, no `zone` (nameless-dict shape, §5).
- **Gate:** `monsterLairActions.js:26` — `isLairRowClickable` returns `false` at `!row.name` BEFORE the `row.save_dc != null` check on line 27 can fire; `lairRowAffordance` returns `null`; row never becomes interactive despite carrying a complete save spec.
- **Unparseable dice (§6):** node check `canRollExpression("1d6 per level")` → **false** (vs `"1d6"` → true); `rg -in "per level" src/ server/ --glob '!*.test.*'` **rc=1 (zero)** — no dynamic-per-level dice parser anywhere; even a named row would drop to advisory/zero-damage, chip suppressed.
- **Trigger consumers:** `rg -in "tries to cast|cast a spell.*lair|lair.*cast a spell|spell.?cast.?trigger" src/ server/ --glob '!*.test.*'` **rc=1 (zero)** — no caster-detection / spell-cast-trigger consumer; `rg -in "wracked|wasted"` hits only forcecageHandler.js:305 (unrelated spell-wasted prose). Event-gated lair effect with no consumer, as expected (§5).
- **Initiative seam:** all `initiative.?20` matches are comments/advisory prose/GM-enforced disclaimers (monsterLairActions.js LAIR_ADVISORY_NOTE, targetEffectDefinitions dream-plane/zone copy, saveProcessing comments) — **no initiative-20 tick consumer**, identical to MA-1207/08 fingerprint.
- **Live DOM census (card via EB "View details", test-campaign, header verified):** Lair Actions section (h5.mc-section-title) present; `span.mc-dice-link-lair` chip count = **0**; row text `". Until initiative count 20 on the next round, any non-undead creature that tries to cast a spell of 4th level or lower in the mummy lord's lair is wracked with…"` renders `.mc-action` with **hasChip:false, role:null, no enclosing button** (orphan "." nameless-render artifact, MonsterCardBody.jsx:352 twin — authored `save_dc` renders no DC chip because the branch never runs for nameless rows).
- **Press ×2 + log-delta:** two native bubbling clicks dispatched on the row text → **log delta 0** (`GET /api/campaigns/test-campaign/log` `[]`→`[]`, count 0→0, tail-counted with 1.2 s + 1.5 s flush waits per §488), no popup, `refusalVisible:false`, `.sp-modal` absent (§485 dialog norms met — nothing fired, nothing to dismiss). Row never reaches the refusal pipeline (`buildLairRefusalPopup`/`lair_action_refused` requires a clickable row first). Console 0 errors.

## Steps
1. Dev already RUNNING (no restart): `:5173` → 200, `:80` → 200.
2. Open http://localhost:5173, select **test-campaign**; sidebar header verified `test-campaign`.
3. Encounters → Encounter Builder → search "Mummy Lord" → single row, `td[1] === "Mummy Lord"` exact (CR 15 / 13,000 / Desert discriminator ✓).
4. Click `button[aria-label="View details for Mummy Lord"]` → `.mc-overlay` card opens (card-view-only suffices per MA-1208 precedent — never ticked checkbox, never clicked Join Encounter; board untouched).
5. Census Lair Actions: 0 `mc-dice-link-lair` chips; all three lair rows static prose with orphan "." prefix.
6. Native-click the spell-cast-pain row text ×2 → log `[]` before/after, delta 0; no popup, no refusal record, no dialog.
7. Cleanup: closed card ×; Admin clear via API-direct POST (confirm-override, both 200) → log=[], change-data={}, combatSummary=null; quiet 15 s + 8 s double-GET re-confirm.
8. Injection note: two Playwright tool-arg rewrites to offsite aliyuncs proxy URLs during navigate/click echoes (playbook §90/§97 family) — hard-rejected; own `location.href` evaluate confirmed localhost throughout; refs preserved, no offsite landing.

## Likely Location
1. **Data (nameless dict shape, §5):** `public/data/monsters.json` `mummy-lord.lair_actions[2]` — nameless raw dict. Needs §5 structuring `{name, advisory:"<snake_key>", description}` (e.g. `{name:"Spellcasting Pain", advisory:"lair_spellcast_pain", save_dc:16, save_type:"Constitution", description:"…"}`) so `isLairRowClickable` passes; with `save_dc` authored the row would then route through the 'save' affordance (line 27 → `handleSaveRoll`), yielding an adjudicated DC 16 CON save — the only lair row of the three with a complete save spec, making it the strongest same-pass candidate.
2. **Unparseable damage token ("1d6 per level", §6):** `damage_dice_primary:"1d6 per level"` fails `canRollExpression` (node-proven false); zero "per level" parse consumers app-wide. Fix must drop the dynamic token from the dice field (honest static `damage_dice_primary:"1d6"` with the per-level multiplier kept in prose, or `advisory` + `advisory_message` record-only shape); as authored, even a named row would render zero damage chips / advisory-only.
3. **Missing consumers (event-gated trigger + initiative-20):** no spell-cast-trigger / caster-detection consumer (`tries to cast` family rc=1) and no initiative-20 lair tick (comment-only matches) — accepted §5/§70 residual (GM-enforced prose); primary fix remains the data-shape structuring (+ suppress orphan "." when `!la.name`).
4. **Same-pass fix with MA-1207/MA-1208:** rows [0]/[1]/[2] of `mummy-lord.lair_actions` share the identical nameless-dict fingerprint (MA-1207 senses, MA-1208 turn-undead ward, this spell-cast pain row); structure all three in one pass — see `.opencode/plans/bug-mon-MA-1207-lair-unnamed-senses.md` and `.opencode/plans/bug-mon-MA-1208-lair-turn-undead-advantage.md` (MA-1208 line 45 already pre-flags this row for the same pass).

## Notes
- **Grep rc codes:** `rg -in "per level" src/ server/ --glob '!*.test.*'` **rc=1 (zero)**; `rg -in "tries to cast|cast a spell.*lair|lair.*cast a spell|spell.?cast.?trigger" src/ server/ --glob '!*.test.*'` **rc=1 (zero)**; `rg -in "initiative.?20|initiative count 20" src/ server/ --glob '!*.test.*'` rc=0 but every hit is comment/advisory prose — no tick consumer; `rg -in "wracked|wasted"` → only forcecageHandler.js:305.
- **§5 fingerprint:** raw-string/nameless lair entries = inert; no initiative-20/lair-recurring consumer app-wide. §6 fingerprint: "1d6 per level" unparseable dice family (`canRollExpression` false → chip suppression even if clickable). Confirmed live (zero-affordance DOM + log-delta 0 ×2 presses) + static → **FAIL(b)** standing rule applies.
- **§488 tail-count honored:** two presses with staggered flush waits (1.2 s + 1.5 s) then double-log GET — delta 0 is absorb-proof here AND moot: row has no interactivity (role:null, no chip, no button), so the refusal pipeline is structurally unreachable.
- **Advisory-record precedent:** `buildLairAdvisoryLog` + `LAIR_ADVISORY_NOTE` ("initiative 20 (GM-enforced)") + MA-0380 `advisory_message` honest-copy seam — the accepted record-only resolution once the row is named; DC 16 CON note rides automatically via `dcNote` (monsterLairActions.js:65).
- **Cross-ref MA-1207/MA-1208:** same monster, same nameless-dict fingerprint, same gate line (:26), same-pass dict-shape fix mandated by MA-1208 Notes.
