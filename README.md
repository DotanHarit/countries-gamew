# 🌍 World Countries Game

A two-player, browser-based game where players take turns naming countries of the world **out loud** using Hebrew voice recognition. Each correct, not-yet-named country lights up on an interactive world map. The player who names more countries wins.

## How to play

1. Open the game (see **Running** below) in **Google Chrome**.
2. Enter both player names and press **התחל משחק** (Start Game).
3. On your turn, press/allow the microphone and say a country's name in Hebrew (e.g. *"צרפת"*).
   - A correct, new country is colored in your player color and your score goes up.
   - Already-named countries and unrecognized words keep your turn — the 5-second countdown just resets.
   - If your 5 seconds run out, the turn passes to the other player.
4. The game ends when **both** players time out on consecutive turns. The end screen shows the winner, scores, and each player's list of countries.

Player 1 is **green**, Player 2 is **orange**.

## Running

The Web Speech API requires the page to be served over **HTTP/HTTPS** (or `localhost`) — opening the file directly via `file://` (or `content://` on Android) blocks microphone access.

Serve the folder with any static server, for example:

```bash
python3 -m http.server 8000
# then open http://localhost:8000 in Chrome
```

Or deploy `index.html` to any static host (GitHub Pages, Netlify, etc.).

## Requirements & constraints

- **Chrome only** — Hebrew (`he-IL`) speech recognition is not supported in Firefox or Safari.
- **Microphone permission** required.
- **Internet connection** required on first load — the app loads D3.js and the world GeoJSON from CDNs.

## Tech

- Vanilla HTML/CSS/JavaScript — single file (`index.html`), no build step.
- [D3.js v7](https://d3js.org/) for the `geoNaturalEarth1` world map.
- Web Speech API for Hebrew voice recognition.
- World GeoJSON from [holtzy/D3-graph-gallery](https://github.com/holtzy/D3-graph-gallery) (177 countries/territories).

See [`countries-game-spec.md`](countries-game-spec.md) for the full system design.
