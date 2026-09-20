# BUG MA-0592 — Demilich "Grave-Dust Flight": no legendary header → ungated multi-fire, own-turn cooldown clause never consulted, fly-move trigger unmodellable

**Verdict: FAIL — DATA (§46/§99 missing numeric header; §61/MA-0406 ungated repeat-fire; §70 movement-trigger advisory ceiling).** Same fingerprint class as MA-0591 (Energy Drain, same missing header). NOT FAIL(a+b) — the Blinded save-shell core rider IS live. test-campaign only.

## Expected (manifest MA-0592 + RAW)
Demilich legendary_actions[1] "Grave-Dust Flight": 1 legendary use (RAW demilich = **3**/round shared pool). Demilich flies up to its Fly Speed (30 ft. hover); each creature within 5 feet **as it moves** targeted once: "Constitution Saving Throw: DC 19. <strong>Failure:</strong> The target has the <strong>Blinded</strong> condition until the end of the demilich's next turn. Failure or Success: The demilich can't take this action again until the start of its next turn."

## Disk — public/data/monsters.json demilich.legendary_actions[1] (exact keys)
- `{description, name, save_dc:19, save_effect, save_type:"Constitution"}` — **no `uses`, no numeric dice, no `range`, no trigger field, no movement/radius structure, no `delegates_to`.**
- Own-turn clause is prose-only inside description: "can't take this action again until the start of its next turn." (straight apostrophe 0x27 — `hasLegendaryCooldownClause` regex matches verbatim: True, verified live via python re).
- No "Legendary Action Uses: N" header dict anywhere in the array (rows = [Energy Drain, Grave-Dust Flight, Necrosis]; only Necrosis carries child `uses:1`). §53 canonical word "Blinded" byte-present in save_effect.

## Code grep — clause consumer is header-branch-only
- `hasLegendaryCooldownClause` (monsterLegendaryUses.js:134) consulted ONLY by `legendaryCooldownRefusal`(:298)/`stampLegendaryCooldown`(:307), called ONLY inside `expendLegendaryUse`(:312+) — the gated row-click path.
- `expendLegendaryUse` reached ONLY via `handleLegendaryRow` (MonsterCardModal.jsx:488/:1755), passed as `legendaryGate` ONLY in the header branch (MonsterCardBody.jsx:55, guarded `legendaryHeader ? ...`); headerless demilich falls to ungated fallback (:56-57) → plain chips, `handleSaveRoll` direct, **clause never consulted**.
- Fly/move trigger grep-zero: `rg "flies up to|as it moves|within 5 feet.*moves|grave.?dust" src/` → zero consumers; all `fly_speed*` hits are PC stance handlers (combatStanceHandler/clearExpirationEffects), not monster movement triggers (§70 advisory family).

## Live evidence (test-campaign, Demilich 1 + Bandit 1 staged 999/999, target armed Bandit 1)
- Card: **no legendary header/counter renders** (`legendaryHeaderPresent:false`; `legendaryHeaderAction`→null, rows[0].uses==null). Fallback renders own save chip on rows[1+] per §110: Grave-Dust Flight chip `mc-dice-link-save-clickable "DC 19 Constitution"`.
- **Click 1** (activeCreature=AasimarTest, round 1 — Demilich never acted, §148 no active-turn gate): inline auto-resolve (no .sp-modal, §126); popup attacker-dupe "DC Unknown" (§138 cosmetic). Victim truth: Bandit 1 `roll save` "Grave-Dust Flight" rolls [12], bonus 0, saveDc 19, saveType Constitution, **saveResult failure**; `lastAttack={attackName:"Grave-Dust Flight", saveResult:"failure", saveDc:19, saveConditions:["blinded"]}`; **`condition applied` Blinded** (characterName Bandit 1, sourceName Demilich 1, sourceAbility Grave-Dust Flight) + `condition_clauses_advisory` "Bandit 1 is Blinded until the end of the demilich's next turn (GM-enforced)" — duration anchor is advisory, application itself LIVE. Bandit 1 change-data `activeConditions:['blinded']`. No `ability_use`, no spend entry.
- **Click 2 SAME round/turn (no Next clicked between, active stays AasimarTest)**: second save fires — rolls [20] nat20 → **saveResult success**, saveDc 19. **ZERO refusal, zero `legendary_use_refused`, zero spend** — once-per-turn clause NOT enforced, legendary economy absent (same ungated re-fire fingerprint as MA-0591/MA-0406). Genuine new adjudication (new d20 + 2 new log entries), not §77 replay.
- **Success rig** (§76): stale blinded cleared via full-store POST `Bandit 1 {value:{activeConditions:[],activeBuffs:[{effect:'warding_bond',saveBonus:19}]}}` (landed without re-select, §96) → **Click 3**: rolls [14], total **33**, `wardingBondSaveBonus:19`, **saveResult success**; NO `condition applied` entry, `activeConditions:[]` — success side correct (single-target fail-only path, applyFailedSaveConditions:808).
- Initiative/turn check: all three fires occurred while cs `activeCreatureName:"AasimarTest"` — not even the monster's own turn; no counter to expend, nothing to regain; fly-speed trail clause "each creature within 5 feet as it moves" never evaluated anywhere (grep-zero above).
- Badge note: `condition applied` + activeConditions are machine truth; initiative-card UI showed no Blinded badge pre-reload (display lag; only unrelated OA/Dash effect-badges present) — machine-truth evidence used.

## Judgment — row mechanics decomposition
1. **Fly-move trigger + 5-ft movement trail multi-target**: unmodellable (§70 grid-token-move advisory ceiling) — advisory, not the FAIL driver.
2. **Blinded save-shell rider (DC 19 CON)**: LIVE on fail, inert on success — correct core approximation (single-target save-shell).
3. **Own-turn cooldown clause** ("Failure or Success: can't take this action again…"): **unenforced** — matcher exists but is header-branch-only; rides the same missing header as MA-0591.
4. **Legendary gate/economy (1 of 3 uses)**: **absent** — FAIL(data) per MA-0591/MA-0406 precedent. Live core rider ≠ rescue while gate+own-turn clause unenforced.

## Steps to reproduce
1. test-campaign → Encounters → filter "Demilich" check, filter "Bandit" check (exact td) → Join Encounter (2nd click lands).
2. Stage 999/999 both via full-combatSummary POST {value:fullCs}.
3. Initiative → arm Demilich 1 card `[data-testid="target-select"]` → Bandit 1 → open card (avatar click).
4. Confirm no legendary header renders; click Grave-Dust Flight "DC 19 Constitution" chip → fail → Blinded applied (log + change-data). Dismiss inline popup.
5. Re-click same chip same round → re-fires ungated, zero refusal.
6. warding_bond saveBonus 19 rig → re-click → success, no blinded.

## Likely fix location
DATA in `public/data/monsters.json` demilich `legendary_actions` — header+children SAME pass (§46), identical template to MA-0591 fix:
```json
[
  { "name": "Legendary Action Uses", "uses": 3 },
  { "name": "Energy Drain", ... },
  { "name": "Grave-Dust Flight", "description": "...", "save_dc": 19, "save_type": "Constitution", "save_effect": "..." },
  { "name": "Necrosis", "description": "The demilich makes one Necrotic Burst attack.", "delegates_to": "Necrotic Burst" }
]
```
Header authored → shared gate engages; rows[1+] DC chips ride it (§110/MA-0567); `hasLegendaryCooldownClause` auto-matches this row's verbatim own-turn clause via the header-branch seam (MA-0073) → spend + `grave_dust_flight_refused (once per turn)` refusal tokens. Fly-move trail stays honest advisory-unbuilt (§70) — movement-trigger/radius consumer needs a separate ticket; do not rebuild per §70.

## Notes
- Siblings: MA-0580/0581 (Death Tyrant headerless family), MA-0591 (demilich Energy Drain — same missing header, fixed same pass fixes this row).
- "Failure or Success:" always-on clause marker is picker-only (§157) — moot here: the marker guards the COOLDOWN clause (handled by MA-0073 seam once header lands), not a condition grant; condition grant is fail-only and lands correctly.
- dc_success default "half" moot — zero-damage row.
- Popup "DC Unknown" attacker-dupe cosmetic (§138); victim `roll save` decisive.
- Registry untouched (orchestrator-owned); no src/public-data writes. Cleanup verified: log [], change-data [], cs empty, NPCs removed, tab closed.
