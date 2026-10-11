# Drum Sequencer

Tablet-oriented web drum sequencer: tap hits in Compose, hear them in Playback, and read standard drum staff in Perform.

## Start

```bash
cd drum-sequencer
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`). Best on a tablet-sized viewport.

## Modes

- **Compose** — tap a cell to place or remove a hit; press-and-hold a hit to edit articulation, velocity, or timing.
- **Playback** — same grid, locked for listening; use transport to play.
- **Perform** — the tapped grid as a two-voice drum staff (cymbals up, drums down).

Sounds are synthesized in Web Audio (kick, snare, hats, crash, ride, tom). The browser may wait for a tap before audio can start.

## GitHub Pages

Pushing `main` builds the static site and deploys it to project Pages. Vite `base` is `/${repo}/` from `GITHUB_REPOSITORY` during that build, so the live URL is `https://<user>.github.io/<repo>/`.
