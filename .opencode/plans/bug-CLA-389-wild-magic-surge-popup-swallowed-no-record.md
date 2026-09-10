# Bug — CLA-389 Wild Magic Surge: post-cast d20 roll popup silently swallowed; surge result unrecorded/unlogged; Metamagic clause inert

## Overview
CLA-389 (Wild Magic Surge, Sorcerer / Wild Magic Sorcery, 2024, trigger `after_sorcerer_spell_slot`) is plumbed end-to-end and its server-side gate runs, but the player-visible half is broken. Live E2E on AberrantSorcerer (2024 Sorcerer lv13, subclass swapped to Wild Magic Sorcery via Edit wizard):
1. The 1d20 roll result NEVER appears for non-20 rolls and never appears in the campaign log. `handleWildMagicSurge` returns `{type:'popup', payload:{type:'automation_info', ...}}` for a non-20 roll and for the once-per-turn refusal, and `executeSpellCast` returns that trigger result RAW — but `useSpellCastExecutor.castAction` only inspects `result.automationPopup`, `result.modalName`, and `result.targetName`. A raw `{type:'popup'}` result matches none of the three branches and is silently discarded (§46v/46g "popup swallowed" family). The once-per-turn latch still advances server-side, so the roll is consumed with zero feedback.
2. The nat-20 branch works (surge modal with d100 roll appeared live), but the `mode:'roll'` WildMagicSurgeModal's **Done button just calls `onClose()`** — it never invokes `onSurgeSelected`, so the surge effect is never persisted to `wildMagicSurgeEffects` and produces **zero campaign-log entries** (only 2 generic `spell` + `hp_change` rows were logged for the surging cast). `onSurgeSelected` is wired only to the `controlledChaos` mode picker.
3. The Metamagic clause ("too wild to be affected by your Metamagic") has ZERO consumers app-wide: grep of `src/` for any surge-state check in the metamagic gates (`useMetamagic*.js`, `useSpellMetamagicGates.js`, metamagic flow) finds nothing gating or suppressing metamagic during/after a surge.
4. Collateral (§7 free-cast leak family): the Magic Missile distribution chain (`handleMagicMissileConfirm` → `onExecute` with `slotLevel`) never paid the slot — `spell_slots_level_1` stayed 4/4 across 4 casts (verified live + after reload). The surge trigger itself fired because `usesSpellSlot` accepts `spell.level > 0` even unpaid.

## Expected Behavior
> "Once per turn, you can roll 1d20 immediately after you cast a Sorcerer spell with a spell slot. If you roll a 20, roll on the Wild Magic Surge table. If the magical effect is a spell, it is too wild to be affected by your Metamagic."
(2024 classes.json, Sorcerer → "Wild Magic Sorcery" → "Wild Magic Surge", level 3, automation `{type:'wild_magic_surge', trigger:'after_sorcerer_spell_slot', oncePerTurn:true}`)

## Actual Behavior
- Slot-gated trigger fires after the cast (`triggerWildMagicSurge` at spellCastService/execution/index.js:631; `surgeUsedRound` stamps round 1→re-armed to null at holder turn start→round 3 live; 2nd same-round cast correctly refused server-side).
- NON-20 roll: NO popup, NO log, anything-you-can-see = nothing (live: 9 s overlay poll after 3 fresh-round casts returned `[]` while `surgeUsedRound` advanced each time).
- NAT-20 roll: surge modal appeared live ("Wild Magic Surge — Rolled: 100", d100 table row 97-100 text) — first ever cast, n=1. Done dismissed it with **no** `wildMagicSurgeEffects` record and **no** `ability_use`/surge log entry (log delta was only `spell` + `hp_change`).
- Metamagic: no suppression anywhere (grep-zero); sorcerer metamagic flow is unaware a surge ever happened.
- Slot ledger: lv1 slots 4/4 frozen across 4 paid MM casts (MM chain payment gap).

## Steps to Reproduce
1. `npm run dev`; open http://localhost:5173 → test-campaign.
2. Edit AberrantSorcerer (2024 Sorcerer lv13, subclass Wild Magic Sorcery — swapped wizard step 6 re-pick + step 7 select + ✓Save, disk-verified).
3. Initiative page: hydrate caster if needed (Add → Poisoned → Apply → badge ×, yields `activeConditions:[]`).
4. Sheet → click "Magic Missile" → "Cast Spell" → distribute 3 missiles to a live Thug → "Cast All Missiles".
5. Observe: on a non-20 surge roll nothing appears and the log gains no roll entry (yet `GET /api/campaigns/test-campaign/change-data` shows `AberrantSorcerer.surgeUsedRound` advanced). Repeat next round (walk "Next →"; reset re-arms at the caster's turn start via initiative.jsx:429). On nat 20 the surge modal shows; press Done — `wildMagicSurgeEffects` stays null and no surge log entry is written.

## Likely Location
- `src/services/rules/spells/spellCastService/execution/index.js:630-667` — returns raw `{type:'popup', payload}` trigger result (compare the `{automationPopup:{...}}` wrapper used at :71/:79/:108).
- `src/hooks/combat/useSpellCastExecutor.js:24-46` — result dispatcher handles only `automationPopup` / `modalName` / `targetName`; raw `{type:'popup'}` falls through.
- `src/components/char-sheet/modals/WildMagicSurgeModal.jsx` (`mode:'roll'` branch) — Done = `onClose()` only; never calls `onSurgeSelected` (which is the only writer of `wildMagicSurgeEffects` + the surge `ability_use` log).
- Metamagic suppression: no producer/consumer exists (`useMetamagic*.js` / metamagic gates grep-zero for any wild-magic state).

## Notes
- Handler rolls with internal `Math.random()`; no dice-control seam — nat-20 was captured live n=1 (the very first slot cast), non-20 branches proven across rounds 2-3 with zero visible output.
- Once-per-turn gate (`surgeUsedRound`, restRules-constants.js:137) is live and correct server-side — the defect is purely the presentation/persistence half plus the unimplemented Metamagic clause.
- Host left at lv13 Wild Magic Sorcery (level 18→13 deliberately chosen to avoid the lv14 Controlled Chaos branch, which `wildMagicSurgeService.js:57-60` stamps on EVERY slot cast and which `wildMagicSurgeHandler.js:38-56` lets bypass the nat-20 gate entirely — a second, controlled-chaos-scoped bug worth its own row adjudication).
- Playbook: this reproduces the §46g "modal swallow" class at the EXECUTOR boundary; fix shape = wrap trigger popups as `{automationPopup:{type:'popup',payload}}` (existing supported shape) or add a `result.type==='popup'` branch, and route roll-mode Done through `onSurgeSelected` for record+log parity with controlledChaos/tamed legs.
