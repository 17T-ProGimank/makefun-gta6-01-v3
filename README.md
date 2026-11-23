# SOLMARA — Open-World Crime Game

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/17T-ProGimank/makefun-gta6-01-v3/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/17T-ProGimank/makefun-gta6-01-v3/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game built for the [gta6-01 bounty on make.fun](https://make.fun/bounty/gta6-01). Sun-soaked coastal island, golden hour, one driver, one debt, one rival crew to bring down.

**Referral:** https://make.fun/r/m4psg5rh (code `m4psg5rh`)

## The story

Dante Reyes owes the Vultures. Mara Voss, fixer at the Ember Garage, has the jobs to pay it off — and to end Silas Rook. Fifteen chained missions across two arcs: pay the debt, build a crew, then finish Rook for good.

## Features

- **15 missions** in two story arcs — "Pay the Debt" (1–12) and "Rook's Return" (13–15), ending in a 3-stage finale at the port compound
- **Crew of 3** — Mara Voss (fixer), Jax Calloway (wheelman), Lena Marlowe (ghost driver), each with real bonuses
- **Garage** — store up to 4 cars, repair, repaint, and upgrade them (3 levels, top-speed + grip)
- **Respect ranks** — NOBODY → STREET HUSTLER → WHEELMAN → MADE → SHOT CALLER → KING OF SOLMARA
- **3-slot save** — money, missions, crew, garage, respect, weapons, seagulls and race bests persist
- **4 radio stations** — SOL FM, EMBER ROCK, BAY BASS, SOLMARA NIGHTS, with DJ idents
- **Street races** — repeatable 3-checkpoint race at the port pad; gold / silver / bronze payouts, best time saved
- **12 Golden Seagulls** — statues hidden across all five districts; collect them all for a $2,000 bonus
- **Spike strips** — at 4+ stars the SMPD deploys strips ahead of you; pop a tire and you crawl at half speed
- **Bribes** — on foot near a police car at 1–2 stars, pay $500 to lose one star
- **3 weapons** — pistol (default), SMG (port warehouse crate), shotgun (beach lifeguard hut crate)
- **Safehouse** near the beach (heal zone), 4 downtown shops, wanted 0–5 stars with SMPD cruisers, roadblocks and the AIR-1 helicopter
- **Golden-hour city** — bay and beach, downtown towers, port, residential blocks, north hills; traffic and pedestrians, minimap, procedural WebAudio

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Shift | Run |
| Space | Jump |
| E | Enter / exit car · lockpick · race start (context) |
| F / click | Shoot |
| 1 / 2 / 3 | Switch weapon (pistol / SMG / shotgun) |
| B | Bribe (near police, wanted ≤ 2) |
| G | Garage (near Ember Garage) |
| C | Crew |
| R | Radio |
| Esc | Pause |

## Screenshots

Staged in-game with `?shot=` poses (see `shots.json`):

1. `01-cover.jpg` — street race at the port start pad (`?shot=cover`)
2. `02-mission.jpg` — finale "End of the Vultures" at the port compound (`?shot=mission`)
3. `03-activity.jpg` — Golden Seagull pickup on the beach (`?shot=activity`)
4. `04-city.jpg` — wide aerial of downtown and the bay at golden hour (`?shot=city`)

## Play

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

Open http://localhost:8080 — no build step, no network at runtime; three.js is vendored under `game/vendor/`.

## Tech

Three.js (r158, vendored) + plain ES modules, no build tools. All art is procedural geometry, all sound is synthesised WebAudio. Entry point: `game/src/main.js`.
