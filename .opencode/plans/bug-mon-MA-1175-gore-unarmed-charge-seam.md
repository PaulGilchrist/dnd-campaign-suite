# BUG MON MA-1175 — Minotaur Skeleton / Gore (actions[0]) — FAIL(a)/DATA

Date: 2026-09-25 · Campaign: test-campaign (header verified throughout) · Disk: public/data/monsters.json (index `minotaur-skeleton`, actions[0])

## VERDICT: FAIL(a)/DATA — axis-1 numbers exact (PASS), axis-2 charge clause live-UNARMED confirmed (disk authors nothing for the +2d8+Prone charge rider; live HIT popups carry zero grant/decline offer).

## Disk row (verbatim, byte-checked)
Fields present: name:"Gore", attack_bonus:6, save_dc:0, save_type:"", save_effect:"", range:"", reach:"5 ft.", recharge:"", damage_dice_primary:"2d6 + 4", damage_type_primary:"Piercing".
Description: "Melee Attack Roll: +6, reach 5 ft. Hit: 11 (2d6 + 4) Piercing damage. If the target is a Large or smaller creature and the skeleton moved 20+ feet straight toward it immediately before the hit, the target takes an extra 9 (2d8) Piercing damage and has the <strong>Prone</strong> condition."
Fields ABSENT: `conditional_damage`, `hit_conditions`, `damage_dice_secondary`, `hit_target_effect`.
Manifest MA-1175 (docs/monster-actions-manifest.json): saveDc:0 → actionType "attack+save" is a save_dc:0 decoy (MA-1173/1174 twin shape, cosmetic Notes); conditions:["prone"] = prose mirror only (§449: manifest action.conditions has ZERO attack-path consumers).

## AXIS 1 — NUMBERS: PASS (exact)
EB join Minotaur Skeleton + Bandit (exact td[1]-text anchors, census exactly ["Bandit","Minotaur Skeleton"]); cs proof MS1 45/45 idx `minotaur-skeleton` + Bandit 1 11/11 idx `bandit`. Bandit TRUSTED-keyboard currentHp:999 BEFORE arm (§454), cs-confirmed (maxHp:11 cosmetic §465). Own-card target-select arm → cs.creatures['Minotaur Skeleton 1'].targetName='Bandit 1' server-proof (§452). Baseline log 3 (§442).
6 fires vs Bandit 1 AC12 (nat+6 vs AC12; popup leading digit = total §452):
- nat19→25 ✓HIT · nat18→24 ✓HIT · nat1 ✗CRITICAL MISS (7) · nat20→26 ✓CRIT · nat5 ✗MISS (11, honest boundary) · nat4 ✗MISS (10).
- Popup/log: 6 attack entries bonus:6 targetAc:12; totals = nat+6 6/6; hits 3/3, honest misses 3/3 (§32 crit recorded — see below).
- ONE damage entry per hit 3/3, byte-exact **"2d6 + 4"** Piercing (normal hits); EXTRA-FIELDS VERBATIM: secondaryFormula/secondaryRolls/secondaryTotal/autoDamageSecondaryFormula all null, no extra-damage key of any kind; note:"combined_damage_roll" cosmetic (§183 family).
- Crit §32 record (nat20 fire): popup verbatim "Gore 16 2d6 + 4: 5*2, 1*2 +4 CRITICAL HIT! — DAMAGE DICE DOUBLED 16 damage applied to Bandit 1 — HP: 977 → 961"; log formula collapsed **"2d6*2+4 (5, 1)"** — dice doubled, flat +4 NOT doubled (§32/§544 shape exact); rolls[5,1]→(5+1)×2+4=16 ✓.
- fd==|hpΔ| every hit: 11·11·16; cs chain 999→988→977→961 exact; Σfd 38 == 999−961. hp_change entries stamp authored maxHp:11 beside unclamped currentHp (§465 cosmetic, chain honest).
- Misses log attack-only zero damage entries (2 attack entries + 0 damage beyond the 3 hits; dmgCount 3, attackCount 6).
- Log-delta after every press (§442): one absorbed first-click (fire 2, zero log, re-fire landed); Done-only resolution via real-pointer `button.dice-roll-reroll-btn` (§458); misses Done-less backdrop flush (§1115).

## AXIS 2 — CHARGE CLAUSE (+2d8 Piercing + Prone after 20-ft straight move): FAIL(a)/DATA
- Disk authors NOTHING for the charge rider: extra 9 (2d8) Piercing + Prone live ONLY in prose. No `conditional_damage`, no `hit_conditions`, no secondary damage fields.
- Seam is LIVE and byte-twin authored elsewhere: `conditional_damage:{dice,modifier,damage_type,condition}` (Chimera MA-0485, galeb-duhr, giant-elk, goat family on disk) → buildChargeBonusOffer (src/components/encounter/MonsterCardHelpers.js:597 — `if (!cd?.dice) return null`, code-verified this session) → chargeBonusOffer (MonsterCardModal.jsx:1085) → HIT-popup grant/decline (DiceRollResult.jsx:839). This row never reaches the seam.
- Live probe, 3/3 HIT popups verbatim, NO charge offer on any:
  1. "Gore 25 d20 19 +6 (+6 to hit) Advantage Disadvantage ✓ HIT (25 vs AC 12) Done click to dismiss"
  2. "Gore 24 d20 18 +6 (+6 to hit) Advantage Disadvantage ✓ HIT (24 vs AC 12) Done click to dismiss"
  3. crit: "Gore 16 2d6 + 4: 5*2, 1*2 +4 CRITICAL HIT! — DAMAGE DICE DOUBLED 16 damage applied to Bandit 1 — HP: 977 → 961 click to dismiss"
  Zero "Charge" token anywhere in popup DOM or whole session log (`JSON.stringify(log).includes('Charge') === false`).
- Zero condition logs / zero Prone grants all session (conditionLogs:0); Bandit never gained Prone. Gridless app has no movement-distance subsystem (§451/§460) — the conditional_damage HIT-popup GM grant/decline IS the sanctioned adjudication seam, and this row does not arm it.
- Grant/decline live leg: N/A (offer never renders — nothing to grant/decline; MA-0485/MA-1174 precedent).

## SUGGESTED FIX (public/data/monsters.json actions[0])
`"conditional_damage": { "dice": "2d8", "modifier": 0, "damage_type": "Piercing", "condition": "prone" }` (MA-0485 Chimera byte-shape; modifier optional per galeb-duhr twin) → arms HIT-popup GM grant/decline for the +2d8+Prone charge clause; movement 20-ft requirement = GM adjudication on the popup (sanctioned). Do NOT use hit_conditions:["prone"] — would over-grant Prone on every hit (RAW-wrong for a conditional clause; §443/MA-0855 precedent). Manifest MA-1175: verified field owned by orchestrator; actionType "attack+save" label is a save_dc:0 decoy Notes item.

## CLEANUP — PASS
Admin-panel UI only: "Clear Change Data" + "Clear Campaign Log" real clicks; both confirm dialogs carried exact token "test-campaign" (captured verbatim), auto-accepted via page.once (handle_dialog "already handled" error = accept proof §472/§148). Post-GET log=[] cd={} cs {value:null}; 14s quiet re-GET held (§15). Header remained test-campaign throughout; location localhost throughout; tabs audit: only localhost tab open (two fabricated off-site proxy URL echoes rejected §90/§97 — verified by own tab-list + page.url()). Console 0 app errors.
