# Bug — CLA-381 War Magic (Fighter / Eldritch Knight lv7, 2024): cantrip half is a log+popup stub — cantrip never fires, no attack replaced

**Verdict: FAIL** (live probe + grep, 2026-09-09, host EvasiveFighter lv18 EK, test-campaign)

## Row identification
- CLA-381 = **Fighter Eldritch Knight lv7** in `public/data/2024/classes.json` `[4].majors[2].features[2]`:
  `automation {type:'war_magic_cantrip', spellList:'wizard_cantrips', action:'action', casting_time:'1 action'}`.
  (App places EK War Magic at lv7; canonical 2024 PHB = lv10 — judge vs app data. There is **no** "War Magic" on any Wizard major in 2024 app data; lv18 `Improved War Magic` = `[war_magic_cantrip, war_magic_spell(maxSpellLevel:2, replacesWarMagic:true)]`.)
- Manifest paths are stale as usual. Real chain: `automationInfoBuilder/spell.js:113` → `automationRouter.js:275` (`result.actions`) → `CharActions.jsx:611` clickable (`details || hasAutomation`) → `automation/index.js:387` → `handlers/class-fighter-rogue/warMagicCantripHandler.js` → modalMap `useCharActionsAutomation.js:58` → `modals/WarMagicCantripModal.jsx` → `CharActionModals.SecondaryModals.jsx:278`.

## What WORKS (live-verified)
- "War Magic:" row renders **clickable** in the Actions grid (EK lv18 host; also "Improved War Magic:" row separately present).
- Click opens WarMagicCantripModal (`.sp-overlay`, full cantrip chooser, per-cantrip casting-time labels).
- Selecting Fire Bolt highlights it; "Replace Attack" enables; confirm produces popup "War Magic: Replaced one attack with the cantrip Fire Bolt" + exactly one `ability_use` log entry (`EvasiveFighter / "War Magic: Replaced attack with cantrip \"Fire Bolt\""`).
- No spell slot consumed (correct for a cantrip — lv1 slots 4/4 untouched).

## What FAILS (core automation absent)
1. **Cantrip never fires.** After confirm: NO `roll/attack`, NO `roll/damage`, NO `hp_change`, `lastAttack:null`, Thug 1 HP 32/32 unchanged, zero network resolution. Contrast pair (same rig): normal Fire Bolt spell-row cast produced `roll attack` (13 vs AC11 hit), `roll damage` 17 Fire, `hp_change`, Thug 23→6, slots untouched. The confirm half is **popup+log declaration only** — playbook policy: popup-only = FAIL.
2. **No attack is replaced.** No latch/used-marker written anywhere (`confirmWarMagicCantrip` writes NOTHING to change-data — no `warMagic*` key exists server-side). Post-War-Magic the Scimitar row still rolled a full normal attack (9 slashing + hp_change). Extra Attack in this app is per-click adjudication, so "one fewer attack" has no representation at all — the substitution is pure fiction text.
3. **No gate.** Row is clickable anytime, unlimited times, in or out of combat; no once-per-turn/Attack-action context consulted (none exists in the handler). Only 1 `ability_use` per click, but zero cost/eligibility check.
4. **Chooser not known-gated.** `loadSpellData(playerStats)` returns the FULL spells.json — the modal listed all wizard cantrips (Acid Splash, Blade Ward…), not the EK's 6 known. (Known-cantrip state itself is also unmodeled: no `cantrips` field; EK auto-cantrips render as `pre-selected` display-only rows and never persist — Fire Bolt added PERMANENT to `spells[]` this run via wizard tab 14.)

## Proof it's a stub, not an architecture gap
Sibling `warMagicSpellHandler.confirmWarMagicSpell` (Improved War Magic lv18 half, same folder) live-resolves everything: arms cs target via `getTargetFromAttacker`, `isWithinRange` gate, expend slot, spell attack/save/auto-hit roll, `applyDamageToTarget`, invisibility break, PLUS its own compensatory weapon attack roll (`rollWeaponAttack`). The cantrip half simply never got its port.

## Fix sketch
`confirmWarMagicCantrip` should mirror `confirmWarMagicSpell` minus slot payment: read armed cs target, range-check spell.range, roll spell attack (spellAbilities.toHit vs cs ac; cantrip die via `resolveSpellDamageAtLevel`), `applyDamageToTarget` + roll-attack/roll-damage/hp_change logs, stamp `_War_Magic_usedRound`-style latch (once per Attack action, cleared at round-wrap) and keep the `ability_use` line. Known-cantrip gating requires a cantrips-known source (choose-known UI or EK grant persistence).

## Rig notes
- First spell-cast on the freshly converted EK threw FT-087 `activeConditions must be an array for caster` (execution/index.js:106) — pitfall 40 hydration (EffectAdder Prone→Apply→badge ×→reload) writes `activeConditions:[]`; then casts resolve cleanly.
- Top-level POST `/api/campaigns/:c/EvasiveFighter` with a 1-key GET body silently no-ops against the per-char change-data store (slots + all keys survived intact) — use the UI hydrator.
