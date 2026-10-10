# CLA-389 Wild Magic Surge — FAIL (inert at UI post-cast seam)

**Verdict: FAIL — inert-or-wrong.** Post-cast surge machinery is code-complete and probe-live, but NEVER fires on any real sheet spell cast. 3 UI casts (1 cantrip control + 2 spell-slot casts incl. the DC/AoE save lane) produced zero surge trigger: no d20-gate popup/log, no `wildMagicSurge` modal, no runtime footprint.

## Data (ground truth, own reads)
- `public/data/2024/classes.json` → Sorcerer `majors[3]` "Wild Magic Sorcery", `features[0]`:
  > "Once per turn, you can roll 1d20 immediately after you cast a Sorcerer spell with a spell slot. If you roll a 20, roll on the Wild Magic Surge table. If the magical effect is a spell, it is too wild to be affected by your Metamagic."
  automation: `{ "type": "wild_magic_surge", "trigger": "after_sorcerer_spell_slot", "oncePerTurn": true }` (lv3).
- Brief said **d8** table — dataset truth is **d20 nat-20 gate**; runtime surge table = `playerStats.wildMagicSurgeTable`, **25 rows**, resolved rolls are **d100** (handler `Math.floor(Math.random()*100)+1`). No d8 anywhere in the lane.
- 2024 **Tides of Chaos does not exist** in this dataset — replaced by "Feats of Chaos" (`feats_of_chaos`, separate feature/row); not part of CLA-389 row → 2024 Tides lane N/A.
- Manifest paths stale: actual dispatch `src/services/automation/index.js:471` (`wild_magic_surge: handleWildMagicSurge`) → `handlers/class-sorcerer/wildMagicSurgeHandler.js`; post-cast seam `src/services/rules/spells/spellCastService/execution/index.js:533` via `runPostCastTriggers` (:505) ← `executeSpellCast` (:638→:727); service gate `features/wildMagicSurgeService.js:79`.

## Trigger model (code + live probe)
Auto-roll model (no GM flag): every Sorcerer spell-slot cast reaches `triggerWildMagicSurge` → `handleWildMagicSurge` auto-rolls d20; nat≠20 → popup+`ability_use` log "Rolled X (not a 20)"; nat=20 → `wildMagicSurge` modal, d100 vs 25-row table. **Second bug (pre-existing, re-confirmed in code):** at lv14+ the Controlled Chaos branch (`wildMagicSurgeHandler.js:57-74`) short-circuits BEFORE the nat-20 gate → every slot cast opens the controlledChaos chooser, bypassing nat-20.

## Live ledger (direct service probe — machinery NOT inert at service level)
Host `AberrantSorcerer` lv20 2024, swapped Aberrant→**Wild Magic Sorcery** via Edit wizard step-6 re-pick Sorcerer → step-7 dropdown options `[Aberrant, Clockwork, Draconic, Wild Magic Sorcery]` (option evidence) → Save; disk `subclass: Wild Magic Sorcery`. Fiber probe of live `playerStats`: passives contain `wild_magic_surge`, `auto_effect:wild_magic_double_roll`; tableLen 25.
- `triggerWildMagicSurge(spell lv1)` → `{type:'modal', modalName:'wildMagicSurge', mode:'controlledChaos', roll1:19, roll2:73}`.
- `onDoubleRollSelected(73)` → ledger verbatim: `wildMagicSurgeEffects=[{"roll":73,"effect":"Teleport up to 60 ft to a visible unoccupied space.","duration":null,...}]`, log `ability_use | AberrantSorcerer triggered Wild Magic Surge (rolled 73): Teleport up to 60 ft to a visible unoccupied space....`, `surgeUsedRound={round:1,...}`, `wildMagicDoubleRoll` consumed → false. All GET-verified.

## The dead seam (why UI casts never surge)
UI casts #1–3 (Light cantrip control — correctly silent; Expeditious Retreat lv1; Burning Hands lv1 DC-13-AoE): slot spend occurred (lv1 4→3→2) and `spell` log entries wrote, but **zero** surge footprint (`surgeUsedRound`, `wildMagicDoubleRoll`, `wildMagicSurgeEffects` all ABSENT pre-probe; no "Rolled X (not a 20)" popup/log). So `triggerWildMagicSurge` never executes on the sheet cast lanes:
1. `useActionSpellMetamagic.js:126-133` and `:229-236` — `showCastPopup` / pending-action consumers have an **empty branch** `if (popup.type==='modal' && setModalState) { /* handled by useSpellCastExecutor pattern */ }` — modal-type surge payloads returned by `executeSpellCast` are **discarded**; the claimed "useSpellCastExecutor pattern" handling does not cover this lane.
2. Self/utility casts (Expeditious Retreat) resolve via a lane that never calls `executeSpellCast` (no save/attack executor run); no-save + no-target AoE skip returns before `runPostCastTriggers` (`execution/index.js:715-717` early `return savePathResult`).
No console errors from `[spellCast] Wild Magic Surge trigger failed` — the trigger is simply never invoked on these lanes.

## Fix pointers
- Wire the empty modal branch: route `popup.type==='modal'` payloads (modalName `wildMagicSurge`) into sheet modal state in `useActionSpellMetamagic.js` / all cast-lane consumers.
- Ensure utility/self-cast lanes invoke `runPostCastTriggers` post-slot-payment.
- Fix Controlled Chaos ordering: roll d20 gate first; double-roll applies only when a surge-table roll occurs (RAW).

## Cleanup proof
Wizard reverse-swap step-7 → Aberrant Sorcery → Save; md5 byte-exact restore + admin clear + GET-verify recorded in session (see ledger below). No joins were made; tab closed; deselected.
