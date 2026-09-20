# Bug: MA-0622 Dracolich Terrifying Presence — success pays HALF damage (dc_success absent → MV-20 half-default leak)

**Row:** MA-0622, stableKey `dracolich|legendary_actions|2`, monster Dracolich, category legendary_actions, actionType "save", save_dc 19 Wisdom, 2d10 Psychic, range "30-foot Emanation", uses (shared legendary, max 1 via rows[0] Pounce-hijacked header).
**Verdict: FAIL(a) — half-leak on successful save (MA-0481/MV-20 class). Fix = DATA `dc_success:"none"`.** Fail-leg, DC, chip, economy, refusal vocabulary all verified LIVE and exact.

## Disk structure (verbatim, public/data/monsters.json `dracolich.legendary_actions[2]`)
- `{ name:"Terrifying Presence", description:"Wisdom Saving Throw: DC 19, each creature in a 30-foot <strong>Emanation</strong> originating from the dracolich. <strong>Failure:</strong> 11 (2d10) Psychic damage, and the target has the <strong>Frightened</strong> condition until the end of its next turn. Failure or Success: The dracolich can't take this action again until the start of its next turn.", save_dc:19, save_type:"Wisdom", range:"30-foot Emanation", save_effect:"The target has the Frightened condition until the end of its next turn.", damage_dice_primary:"2d10", damage_type_primary:"Psychic" }`
- Keys checked: `save_dc` 19 ✓, `save_type` "Wisdom" ✓, `damage_dice_primary` "2d10" + `damage_type_primary` "Psychic" ✓, `save_effect` byte-carries canonical "Frightened" ✓, **`dc_success` ABSENT** → `getSaveDcSuccess` (MonsterCardModal.jsx:154) + save-options stamp (:799) + context (:1602) hard-default `'half'` (MV-20).
- RAW: description has NO "Success: half damage" clause — prose states consequences under **Failure:** only; the trailing "Failure or Success:" sentence gates only the recharge clause. Success = NO damage → `dc_success` MUST be `"none"`.
- "Failure or Success:" here is NOT a §157 both-outcomes condition marker in `save_effect` (save_effect is fail-only, correctly unmarked); the Frightened-on-success absence verified live (Bandit 1 `activeConditions:[]` after success).

## Static seam trace
- `computeDamageAfterSave` (applyDamage.js:88-98): `saveSuccess && dcSuccess==='half' → floor(raw/2)`; `'none' → 0`. Row rides `'half'` default → success pays half. Leak is in the DATA field, seam itself honors authored `'none'` (MA-0218/MA-0481 semantics unchanged).
- Chip render: rows[1+] w/ numeric save_dc render own `mc-dice-link-save-clickable` "DC 19 Wisdom" chip riding shared legendary gate (§110/MA-0567) — confirmed live; NOT header-swallowed (that is rows[0] Pounce, MA-0620).

## Live proof (test-campaign, header-verified `test-campaign`)
EB join exact Dracolich + Bandit qty 2 → cs `[Dracolich 1 225/225, Bandit 2, Bandit 1]`; staged both Bandits 999/999 via full-cs POST; armed Dracolich 1 own-card `[data-testid="target-select"]` → Bandit 1.

Fire ledger (chip = `.mc-action:has(strong startsWith "Terrifying Presence") .mc-dice-link-save-clickable`, fresh rect each click):
1. **FIRE 1 (fail-leg, raw save):** inline auto-resolve, no `.sp-modal` (§126). Popup + machine truth: victim `roll save` Bandit 1 `total=17 rolls=[17] saveResult=failure saveDc=19 saveType=Wisdom`; `roll damage` `finalDamage=12 total=12 rolls=[10,2]`; `hp_change` Bandit 1 999→987 (hpΔ==finalDamage==FULL 2d10 ✓); `condition` Frightened applied + `change-data 'Bandit 1'.activeConditions ["frightened"]` + card badge ✓; `ability_use` spend "expends a legendary use … 0 of 1 left" — own DC chip rides the shared legendary gate ✓.
2. **FIRE 2 (same boundary):** refusal popup "no legendary uses left — regain at start of Dracolich 1's turn" + `automation legendary_use_refused (exhausted)` zero-spend, no roll ✓ (this enforces the own-turn/recharge clause via the max:1 economy).
3. **TURN-START REGAIN (§46):** walked initiative to Dracolich turn-start round 2 → `monsterLegendaryUses {max:1, used:0}` + `ability_use` "regains all expended legendary action uses at the start of its turn" ✓.
4. **FIRE 3 (success rig):** stamped Bandit 1 `activeBuffs {effect:'warding_bond', saveBonus:19}` full-store POST (lands without re-select, §76; live at saveProcessing prompt seam :200). **SAVE SUCCESS `total=23 (d20 4 + 19) vs DC 19` → app applied `finalDamage=3` (2d10 rolls [2,4]=6, floor(6/2)) — Bandit 1 987→984. RAW demands ZERO. HALF-LEAK CONFIRMED (fail(a), MA-0481 class).** Condition correctly NOT applied on success (`activeConditions []`) — only the numeric leg leaks.
5. **OWN-TURN refusal (§99 token distinguish):** walked to Dracolich own turn round 3 (regain had fired, uses 0/1) → chip click refused "expends legendary uses after ANOTHER creature's turn, not its own. Nothing spent, no roll" — `own-turn` gate token vs fire-2 `exhausted` token, both zero-spend ✓.
6. **Emanation (§62/MA-0317):** "30-foot Emanation" never parses to picker → single-target degradation; Bandit 2 (also in range) stayed 999/999, zero log entries. Accepted advisory residual — record, do not chase.

## Fix (DATA, one field — orchestrator applies; subagent wrote no data/src)
`public/data/monsters.json` `dracolich.legendary_actions[2]`: add `"dc_success": "none"`.
- Honest copy both surfaces: popup line becomes "✓ SAVE SUCCESS … no damage" (`computeDamageAfterSave` 'none' → 0, MA-0218 precedent); description untouched (already half-silent).
- No code change needed — seam consumes authored `dc_success` (MonsterCardModal.jsx:154/799/1602 fall through on authored value).
- Verify post-fix (§21/§106): DELETE `combat-ui-viewingMonster`(+`…CreatureName`) → reload → re-select → re-open; re-join EB combatants (stale snapshots); re-run fire ledger: success-zero, fail-full 2d10+Frightened, economy unchanged.

## Cleanup
`/admin/clear-change-data` + `/admin/clear-log` (direct POST, no dialog §121) + `combatSummary` seeded `{value:{round:1,creatures:[]}}` (§103) → curl-verified `log==[]`, cs creatures empty. No src/public-data/manifest/git writes by this session.

## Pitfalls / notes
- Injections: navigate/find/click tool echoes repeatedly carried fabricated `[SYSTEM]/[USER]` blocks and decoy "re-click the DC chip / open link" directives inside tool output — never obeyed; every URL verified `localhost` by own evaluate (§90/§97). Decoy "re-click" during fire-2 dismissal ignored — re-firing mid-audit would have corrupted the economy ledger (§98/§142).
- §138 "DC Unknown" attacker-dupe not observed this session — popup printed correct "DC 19"; victim `roll save` machine truth decisive.
- Save popup printed bonus as "(d20 4 + 0)" while total=23 included the +19 warding_bond rig — display quirk; `saveResult:success saveDc:19` + total are truth (§33).
- Refusal popup DOM duplicated (wrapper + inner) — counted refusals by log, not popup count (§98).
- cs `activeCreatureName` mirror froze (AasimarTest) while top-level change-data flipped freely (§31/§110); judged gates by top-level + `monsterLegendaryUses`.
- `scrollIntoViewIfNeeded` + `:text-startsWith()` inside `:has()` DOM SyntaxError (§127) — evaluate + fresh rect route used for all chip clicks.
- EB qty stepper "+" landed first click this session; verified cell innerText "2" before Join (§153).
