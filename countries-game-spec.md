# 🌍 World Countries Game — System Design Specification

## Overview

A two-player browser-based game where players take turns naming countries of the world using voice recognition. The player who names more countries wins. An interactive world map displays progress in real time.

---

## Tech Stack

- **Vanilla HTML/CSS/JavaScript** — no frameworks
- **D3.js v7** — world map rendering (via CDN)
- **Web Speech API** — Hebrew voice recognition (built into Chrome)
- **GeoJSON** — world map data from `https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson`
- **Deployment** — static file, must be served over HTTP (not `file://` or `content://`) for microphone access

---

## Game Flow

### Screen 1: Setup
- Two text inputs for player names
- "Start Game" button (disabled until both names entered)
- Note about microphone requirement

### Screen 2: Game
- Header: both player names + live country counts
- World map (SVG, fills available space)
- Bottom panel: countdown ring + microphone button + status/feedback text

### Screen 3: End
- Winner announcement (or "tie")
- Score comparison (both players)
- Full list of countries named by each player (Hebrew names)
- "New Game" button → returns to Setup

---

## Layout — Mobile-First

```
┌─────────────────────────────────┐
│ [● Player1    0] [0    Player2●] │  ← header, fixed height ~52px
├─────────────────────────────────┤
│                                 │
│         WORLD MAP (SVG)         │  ← flex: 1, fills remaining space
│                                 │
├─────────────────────────────────┤
│ [countdown] [🎤] [status text]  │  ← bottom panel, fixed height ~72px
└─────────────────────────────────┘
```

**Critical mobile fix:** Do NOT use `100vh` or `100dvh` for the app height — these are unreliable when opening HTML files from device storage (`content://` URLs in Android Chrome). Instead:
```javascript
function setVH() {
  document.getElementById('app').style.height = window.innerHeight + 'px';
}
setVH();
window.addEventListener('resize', setVH);
```

---

## World Map

- Source: GeoJSON from holtzy/D3-graph-gallery (177 countries/territories)
- Projection: `d3.geoNaturalEarth1()`
- Scale: `containerWidth / 6.3`
- Each country `<path>` has `data-n` attribute = English country name
- Default fill: `#1e3a5f`
- Player 1 countries: `#22c55e` (green)
- Player 2 countries: `#f97316` (orange)
- Ocean/background: `#0a1628`
- Country borders: `stroke: #0a1628`, `stroke-width: 0.4`

**Map draw timing:** The map must be drawn only after the game screen is visible and has been laid out. Use double `requestAnimationFrame`:
```javascript
requestAnimationFrame(() => requestAnimationFrame(() => drawMap()));
```
If `clientWidth` or `clientHeight` is still 0, retry with `setTimeout(drawMap, 80)`.

**Color update:** When a country is successfully named, update its SVG path fill directly:
```javascript
document.querySelectorAll(`[data-n="${engName}"]`)
  .forEach(el => el.setAttribute('fill', COLORS[playerIndex]));
```

---

## Voice Recognition

- API: `window.SpeechRecognition || window.webkitSpeechRecognition`
- Language: `he-IL` (Hebrew)
- Settings: `continuous: false`, `interimResults: true`, `maxAlternatives: 5`
- **Requires HTTPS or localhost** — will return `not-allowed` error on `file://` or `content://`

### Recognition flow per turn:
1. Call `recognition.start()` at the beginning of each turn
2. Show interim transcript in status text as user speaks
3. On `isFinal`: loop through all alternatives (up to 5), call `findCountry()` on each
4. Pass first spoken text + found result to `handleSpoken()`
5. `recognition.onend` fires after each utterance — mic stops automatically

### Error handling:
- `not-allowed`: show error, inform user about HTTPS requirement
- `no-speech`: silent (happens often, not a real error)
- `aborted`: silent (triggered by our own `abort()` call)
- Other errors: show message to user

---

## Country Name Matching

### Hebrew → English dictionary
A flat JS object mapping Hebrew names (and common variants) to English GeoJSON names.
Example entries:
```javascript
const H2E = {
  "ישראל": "Israel",
  "צרפת": "France",
  "ארצות הברית": "USA",
  "אמריקה": "USA",
  "ארה\"ב": "USA",
  "גרמניה": "Germany",
  "הולנד": "Netherlands",
  "נדרלנד": "Netherlands",
  // ... ~230 entries covering all 177 GeoJSON countries
  // plus common aliases and alternate spellings
};
```

### Reverse map (English → Hebrew display name)
```javascript
const E2H = {};
Object.entries(H2E).forEach(([h, e]) => { if (!E2H[e]) E2H[e] = h; });
```

### Normalization
```javascript
function norm(text) {
  return text
    .replace(/[׳']/g, "'")   // normalize Hebrew apostrophes
    .replace(/[״"]/g, '"')   // normalize Hebrew quotes
    .trim()
    .toLowerCase();
}
```

### Lookup algorithm
```javascript
function findCountry(spoken) {
  const n = norm(spoken);
  // 1. Exact match
  for (const [heb, eng] of Object.entries(H2E)) {
    if (norm(heb) === n) return eng;
  }
  // 2. Substring match (spoken contains Hebrew name, or Hebrew name contains spoken)
  for (const [heb, eng] of Object.entries(H2E)) {
    const nh = norm(heb);
    if (n.includes(nh) || nh.includes(n)) return eng;
  }
  return null;
}
```

---

## Game Logic

### State variables
```javascript
let playerNames = ['', ''];       // [player1Name, player2Name]
let currentPlayer = 0;            // 0 or 1
let guessed = [{}, {}];           // guessed[0][engName] = true for player1's countries
let passCount = [0, 0];           // consecutive timeouts per player
let countdownVal = 5;
let countdownTimer = null;
let recognition = null;
let listening = false;
let geoData = null;               // loaded GeoJSON FeatureCollection
```

### Turn logic
```javascript
function handleSpoken(spokenText, foundEnglishName) {
  clearInterval(countdownTimer);

  if (!foundEnglishName) {
    showFeedback('error', `"${spokenText}" — לא זיהיתי ארץ, נסה שוב`);
    startCountdown(); // restart countdown, same player
    return;
  }

  if (guessed[0][foundEnglishName] || guessed[1][foundEnglishName]) {
    showFeedback('duplicate', `${E2H[foundEnglishName]} כבר נאמרה! נסה ארץ אחרת`);
    startCountdown(); // restart countdown, same player
    return;
  }

  // Success
  guessed[currentPlayer][foundEnglishName] = true;
  passCount[currentPlayer] = 0;
  colorCountry(foundEnglishName, currentPlayer);
  updateHeader();
  showFeedback('success', `✅ ${E2H[foundEnglishName]}`);
  setTimeout(() => { clearFeedback(); nextTurn(); }, 1100);
}
```

### Timeout / pass logic
```javascript
const TIMEOUT_SECONDS = 5;

function onTimeout() {
  stopRecognition();
  passCount[currentPlayer]++;
  // Game ends when BOTH players time out consecutively
  if (passCount[0] >= 1 && passCount[1] >= 1) {
    setTimeout(showEndScreen, 300);
  } else {
    setTimeout(nextTurn, 200);
  }
}
```

### Retry on error (duplicate / not found)
- Countdown **resets** to 5 seconds
- Same player keeps the turn
- No penalty

---

## Countdown UI

SVG ring (52×52px):
```html
<svg width="52" height="52">
  <circle cx="26" cy="26" r="20" fill="none" stroke="#1e293b" stroke-width="4"/>
  <circle id="cdarc" cx="26" cy="26" r="20" fill="none"
    stroke="#22c55e" stroke-width="4"
    stroke-dasharray="125.7"   <!-- 2π × 20 -->
    stroke-dashoffset="0"
    stroke-linecap="round"
    transform="rotate(-90 26 26)"/>
  <text id="cdtxt" x="26" y="31" text-anchor="middle"
    fill="white" font-size="14" font-weight="bold">5</text>
</svg>
```

Update function:
```javascript
const CIRC = 2 * Math.PI * 20; // 125.66

function renderCountdown() {
  const offset = CIRC * (1 - Math.max(0, countdownVal) / TIMEOUT_SECONDS);
  document.getElementById('cdarc').style.strokeDashoffset = offset;
  document.getElementById('cdarc').style.stroke = COLORS[currentPlayer];
  document.getElementById('cdtxt').textContent = Math.max(0, countdownVal);
}
```

---

## Color Scheme

| Element | Color |
|---------|-------|
| Background | `#0d1b2e` |
| Map ocean | `#0a1628` |
| Map country default | `#1e3a5f` |
| Player 1 (green) | `#22c55e` |
| Player 2 (orange) | `#f97316` |
| Header/panel background | `#1a2744` |
| Panel border | `#1e3a5f` |
| Inactive UI | `#334155` |
| Success feedback bg | `#14532d` |
| Duplicate feedback bg | `#1e3a5f` |
| Error feedback bg | `#450a0a` |

---

## Feedback Messages

Three types, displayed in a box above the status text:

| Type | Border | Condition |
|------|--------|-----------|
| `success` | `#22c55e` | Country found and new |
| `duplicate` | `#3b82f6` | Country already named by either player |
| `error` | `#ef4444` | Speech not recognized as any country |

All feedback: disappears after 1.1s (on success) or stays until next attempt (on error/duplicate).

---

## Microphone Button

```css
#mic-btn {
  width: 52px; height: 52px; border-radius: 50%;
  background: #1e3a5f; /* idle */
}
#mic-btn.on {
  background: COLORS[currentPlayer]; /* active color */
  animation: pulse 1.3s infinite;
}
@keyframes pulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,.5); }
  50%      { box-shadow: 0 0 0 10px rgba(34,197,94,0); }
}
```

---

## File Structure

```
/
├── index.html          # entire app (single file)
└── README.md
```

Single-file app. All CSS in `<style>`, all JS in `<script>`, D3 loaded from CDN.

---

## Known Constraints

1. **Must be served over HTTP/HTTPS** for microphone access — `file://` and `content://` protocols block Web Speech API with `not-allowed` error. Deploy to GitHub Pages, Netlify, or any static host.

2. **Chrome only** — Web Speech API with `he-IL` is not supported in Firefox or Safari.

3. **GeoJSON fetch** — requires internet connection to load map data from GitHub CDN. Consider bundling the GeoJSON inline if offline play is needed (adds ~275KB to HTML).

4. **Mobile height** — use `window.innerHeight` in JS to set app height, not CSS `vh` units, which are unreliable when loading from device storage.

---

## Hebrew Country Dictionary — Key Mappings

The following are examples of non-obvious mappings that must be included:

```javascript
// Country has multiple Hebrew names
"ארצות הברית": "USA",
"אמריקה": "USA",
"ארה\"ב": "USA",

// GeoJSON uses non-standard English names
"סרביה": "Republic of Serbia",
"קונגו": "Republic of the Congo",
"הרפובליקה הדמוקרטית של קונגו": "Democratic Republic of the Congo",
"קינשסה": "Democratic Republic of the Congo",
"טנזניה": "United Republic of Tanzania",

// Common alternate spellings
"בורמה": "Myanmar",
"פרסיה": not included — use "איראן": "Iran",
"הולנד": "Netherlands",
"נדרלנד": "Netherlands",

// Disputed / partially recognized territories (included per spec)
"טייוואן": "Taiwan",
"קוסובו": "Kosovo",
"סומלילנד": "Somaliland",
"קפריסין הצפונית": "Northern Cyprus",
"הגדה המערבית": "West Bank",
"סהרה המערבית": "Western Sahara",
```

The full dictionary should cover all 177 features in the GeoJSON, with at least one Hebrew name per country, and multiple entries for countries with common aliases.
