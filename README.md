# ⏱ Timer App

A browser-based countdown timer with sound notifications. No build tools or dependencies — just open `index.html`.

![Simple Timer](https://github.com/user-attachments/assets/44539e6c-8f43-4ac6-b882-8dc52a278478)

---

## Features

### Simple Timer
- Set a custom countdown duration (minutes + seconds)
- Animated SVG progress ring shows remaining time at a glance
- **Loop** toggle — automatically restarts after each cycle, tracking lap count
- **Sound** toggle — plays a bell-ding notification via the Web Audio API when time is up
- Start, Pause/Resume, and Reset controls

### Multi-Period Timer
- Configure multiple named periods in sequence (e.g. 15 s warm-up → 30 s work → 1 min cool-down)
- Add or remove periods freely (minimum one period kept)
- Each period has its own colour and a **distinct synthesised notification sound**
- Active period is highlighted with a colour-coded progress bar and badge
- **Loop all** toggle — cycles through all periods repeatedly
- **Sound** toggle — applies globally across all periods

![Multi-Period Timer](https://github.com/user-attachments/assets/30cd50d7-d67d-4539-b406-a79ace8580b7)

---

## Getting Started

1. Clone or download the repository.
2. Open `index.html` in any modern browser — no installation required.

```bash
git clone https://github.com/JiazhengChai/timer_app.git
cd timer_app
open index.html        # macOS
# or
xdg-open index.html    # Linux
# or double-click index.html in your file manager
```

Alternatively, serve it with any static file server:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

---

## File Structure

```
timer_app/
├── index.html   # App markup and layout
├── styles.css   # Dark-theme styles, animations, responsive layout
└── app.js       # Timer logic, Web Audio API sound generation
```

---

## Sound Variants

All sounds are generated programmatically — no audio files are needed.

| Variant | Description       | Used for             |
|---------|-------------------|----------------------|
| 0       | Bell ding         | Simple timer default |
| 1       | Warm chime        | Period 1 (Short)     |
| 2       | Deep gong         | Period 2 (Medium)    |
| 3       | Ascending sweep   | Period 3 (Long)      |
| 4       | Two-tone alert    | Period 4+            |

Variants cycle automatically for additional periods.

---

## Browser Support

Requires a browser with [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) support — all modern browsers (Chrome, Firefox, Safari, Edge) are supported.
