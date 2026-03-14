/* =============================================
   Timer App – Main Logic
   ============================================= */

/* ── Audio context (lazy-initialised on first user gesture) ── */
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

/**
 * Play a notification sound.
 * @param {number} variant  0 = bell ding, 1 = warm chime (triple),
 *                          2 = deep gong, 3 = ascending sweep, 4 = two-tone alert
 */
function playSound(variant = 0) {
  const ctx = getAudioCtx();

  const sounds = [
    // 0 – clean bell ding (simple timer default)
    (ctx) => {
      const t = ctx.currentTime;
      [880, 1108].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.4, t + i * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.7);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + i * 0.12);
        osc.stop(t + i * 0.12 + 0.8);
      });
    },
    // 1 – warm chime (short period)
    (ctx) => {
      const t = ctx.currentTime;
      const freqs = [523, 659, 784];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t + i * 0.18);
        gain.gain.linearRampToValueAtTime(0.35, t + i * 0.18 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.18 + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + i * 0.18);
        osc.stop(t + i * 0.18 + 0.6);
      });
    },
    // 2 – deep gong (medium period)
    (ctx) => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(110, t + 1.2);
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.7);
    },
    // 3 – ascending sweep (long period)
    (ctx) => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(330, t);
      osc.frequency.linearRampToValueAtTime(880, t + 0.4);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.9);
    },
    // 4 – two-tone alert (extra period)
    (ctx) => {
      const t = ctx.currentTime;
      [[440, 0], [660, 0.22]].forEach(([freq, delay]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.linearRampToValueAtTime(0.2, t + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + delay);
        osc.stop(t + delay + 0.45);
      });
    },
  ];

  const fn = sounds[variant % sounds.length];
  fn(ctx);
}

/* ── Flash overlay ── */
function flashNotify(color) {
  const el = document.getElementById("notify-flash");
  el.style.background = color || "rgba(233,69,96,0.18)";
  el.classList.add("flash");
  setTimeout(() => el.classList.remove("flash"), 300);
}

/* ── Helpers ── */
function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/* ═══════════════════════════════════════════════
   MODE SWITCH
═══════════════════════════════════════════════ */
function switchMode(mode) {
  document.getElementById("view-simple").classList.toggle("active", mode === "simple");
  document.getElementById("view-simple").classList.toggle("view", mode !== "simple");
  document.getElementById("view-multi").classList.toggle("active", mode === "multi");
  document.getElementById("view-multi").classList.toggle("view", mode !== "multi");

  document.getElementById("tab-simple").classList.toggle("active", mode === "simple");
  document.getElementById("tab-simple").setAttribute("aria-selected", mode === "simple");
  document.getElementById("tab-multi").classList.toggle("active", mode === "multi");
  document.getElementById("tab-multi").setAttribute("aria-selected", mode === "multi");
}

/* ═══════════════════════════════════════════════
   SIMPLE TIMER
═══════════════════════════════════════════════ */
const simple = {
  intervalId: null,
  remaining: 0,
  total: 0,
  running: false,
  paused: false,
  loopCount: 0,
};

const RING_CIRCUMFERENCE = 2 * Math.PI * 88; // ≈ 553

function simpleGetDuration() {
  const m = parseInt(document.getElementById("simple-minutes").value, 10) || 0;
  const s = parseInt(document.getElementById("simple-seconds").value, 10) || 0;
  return clamp(m, 0, 99) * 60 + clamp(s, 0, 59);
}

function simpleUpdateUI() {
  document.getElementById("simple-display").textContent = formatTime(simple.remaining);

  // Ring progress
  const fraction = simple.total > 0 ? simple.remaining / simple.total : 1;
  const offset = RING_CIRCUMFERENCE * (1 - fraction);
  document.getElementById("simple-ring").style.strokeDashoffset = offset;

  // Buttons
  const running = simple.running;
  const paused = simple.paused;
  document.getElementById("simple-start-btn").disabled = running && !paused;
  document.getElementById("simple-start-btn").textContent = paused ? "▶ Resume" : "▶ Start";
  document.getElementById("simple-pause-btn").disabled = !running || paused;
}

function simpleSetStatus(msg) {
  document.getElementById("simple-status").textContent = msg;
}

function simpleSetLabel(label) {
  document.getElementById("simple-state-label").textContent = label;
}

function simpleTick() {
  simple.remaining--;
  simpleUpdateUI();

  if (simple.remaining > 0) return;

  // Time's up
  const loop = document.getElementById("simple-loop").checked;
  const sound = document.getElementById("simple-sound").checked;

  if (sound) playSound(0);
  flashNotify();
  simple.loopCount++;
  simpleSetLabel("🔔 Done!");
  simpleSetStatus(
    loop
      ? `Lap ${simple.loopCount} complete – looping…`
      : `⏱ Timer finished! (${simple.loopCount} lap${simple.loopCount > 1 ? "s" : ""})`
  );

  if (loop) {
    simple.remaining = simple.total;
  } else {
    simpleStop();
  }
}

function simpleStart() {
  // Resume from pause
  if (simple.paused) {
    simple.paused = false;
    simple.running = true;
    simpleSetLabel("▶ Running");
    simple.intervalId = setInterval(simpleTick, 1000);
    simpleUpdateUI();
    return;
  }

  // Fresh start
  const total = simpleGetDuration();
  if (total <= 0) {
    simpleSetStatus("⚠ Please set a duration greater than 0.");
    return;
  }

  simple.total = total;
  simple.remaining = total;
  simple.running = true;
  simple.paused = false;
  simple.loopCount = 0;

  simpleSetStatus("");
  simpleSetLabel("▶ Running");
  simpleUpdateUI();

  // Kick off immediately then tick every second
  simple.intervalId = setInterval(simpleTick, 1000);
}

function simplePause() {
  if (!simple.running || simple.paused) return;
  clearInterval(simple.intervalId);
  simple.paused = true;
  simple.running = false;
  simpleSetLabel("⏸ Paused");
  simpleSetStatus("Timer paused.");
  simpleUpdateUI();
}

function simpleStop() {
  clearInterval(simple.intervalId);
  simple.running = false;
  simple.paused = false;
  simpleUpdateUI();
  document.getElementById("simple-start-btn").textContent = "▶ Start";
  document.getElementById("simple-start-btn").disabled = false;
}

function simpleReset() {
  simpleStop();
  simple.remaining = simpleGetDuration();
  simple.total = simple.remaining;
  simple.loopCount = 0;
  simpleSetLabel("Ready");
  simpleSetStatus("");
  simpleUpdateUI();
}

/* ═══════════════════════════════════════════════
   MULTI-PERIOD TIMER
═══════════════════════════════════════════════ */

// Colour palette for periods
const PERIOD_COLORS = ["#e94560", "#f39c12", "#2ecc71", "#3498db", "#9b59b6", "#1abc9c"];
// Sound variant assigned to each period by index (cycles: warm chime, deep gong, ascending sweep, two-tone alert, bell ding)
const PERIOD_SOUNDS = [1, 2, 3, 4, 0];

function periodDuration(p) {
  return clamp(p.minutes, 0, 99) * 60 + clamp(p.seconds, 0, 59);
}

let periods = []; // { id, name, minutes, seconds, colorIndex }
let nextPeriodId = 0;

const multi = {
  intervalId: null,
  running: false,
  paused: false,
  currentIndex: 0,
  remaining: 0,
  currentTotal: 0,
  cycleCount: 0,
};

function generatePeriodId() {
  return nextPeriodId++;
}

function addPeriod(name, minutes, seconds) {
  const colorIndex = periods.length % PERIOD_COLORS.length;
  const id = generatePeriodId();
  periods.push({
    id,
    name: name || `Period ${periods.length + 1}`,
    minutes: minutes ?? 0,
    seconds: seconds ?? 30,
    colorIndex,
  });
  renderPeriodList();
  renderBadges();
}

function removePeriod(id) {
  if (periods.length <= 1) return; // keep at least one
  periods = periods.filter((p) => p.id !== id);
  renderPeriodList();
  renderBadges();
}

function getPeriodData(id) {
  const rows = document.querySelectorAll(`.period-item[data-id="${id}"]`);
  if (!rows.length) return null;
  const row = rows[0];
  return {
    name: row.querySelector(".period-name-input").value,
    minutes: parseInt(row.querySelector('[data-field="minutes"]').value, 10) || 0,
    seconds: parseInt(row.querySelector('[data-field="seconds"]').value, 10) || 0,
  };
}

function collectPeriods() {
  return periods.map((p) => {
    const data = getPeriodData(p.id);
    return {
      ...p,
      name: data ? data.name : p.name,
      minutes: data ? data.minutes : p.minutes,
      seconds: data ? data.seconds : p.seconds,
    };
  });
}

function renderPeriodList() {
  const list = document.getElementById("periods-list");
  list.innerHTML = "";
  periods.forEach((p) => {
    const item = document.createElement("div");
    item.className = "period-item";
    item.dataset.id = p.id;
    item.innerHTML = `
      <span class="period-color-dot" style="background:${PERIOD_COLORS[p.colorIndex]}"></span>
      <input
        class="period-name-input"
        type="text"
        value="${p.name}"
        placeholder="Period name"
        aria-label="Period name"
        maxlength="24"
      />
      <div class="period-time-inputs">
        <input
          type="number"
          data-field="minutes"
          min="0"
          max="99"
          value="${p.minutes}"
          aria-label="Minutes"
        />
        <span>m</span>
        <input
          type="number"
          data-field="seconds"
          min="0"
          max="59"
          value="${p.seconds}"
          aria-label="Seconds"
        />
        <span>s</span>
      </div>
      <button
        class="btn-remove-period"
        onclick="removePeriod(${p.id})"
        aria-label="Remove period"
        title="Remove"
        ${periods.length <= 1 ? "disabled" : ""}
      >✕</button>
    `;
    list.appendChild(item);
  });
}

function renderBadges() {
  const wrap = document.getElementById("multi-badges");
  wrap.innerHTML = "";
  periods.forEach((p, i) => {
    const badge = document.createElement("span");
    badge.className = "period-badge";
    badge.dataset.index = i;
    badge.textContent = p.name;
    badge.style.background = PERIOD_COLORS[p.colorIndex] + "33";
    badge.style.color = PERIOD_COLORS[p.colorIndex];
    wrap.appendChild(badge);
  });
}

function updateBadges(activeIndex) {
  document.querySelectorAll(".period-badge").forEach((b, i) => {
    b.classList.toggle("active", i === activeIndex);
  });
}

function multiUpdateDisplay() {
  document.getElementById("multi-display").textContent = formatTime(multi.remaining);

  // Progress bar
  const fraction = multi.currentTotal > 0 ? multi.remaining / multi.currentTotal : 1;
  document.getElementById("multi-progress-bar").style.width = `${fraction * 100}%`;

  // Buttons
  const { running, paused } = multi;
  document.getElementById("multi-start-btn").disabled = running && !paused;
  document.getElementById("multi-start-btn").textContent = paused ? "▶ Resume" : "▶ Start";
  document.getElementById("multi-pause-btn").disabled = !running || paused;
}

function multiSetStatus(msg) {
  document.getElementById("multi-status").textContent = msg;
}

function multiHighlightPeriod(index, snapshot) {
  // Remove active class from all items
  document.querySelectorAll(".period-item").forEach((el) => {
    el.classList.remove("active-period");
  });
  if (index >= 0 && index < snapshot.length) {
    const item = document.querySelector(`.period-item[data-id="${snapshot[index].id}"]`);
    if (item) item.classList.add("active-period");
    document.getElementById("multi-current-label").textContent =
      `Period ${index + 1} of ${snapshot.length}: ${snapshot[index].name}`;
    document.getElementById("multi-progress-bar").style.background =
      `linear-gradient(90deg, ${PERIOD_COLORS[snapshot[index].colorIndex]}, ${PERIOD_COLORS[(snapshot[index].colorIndex + 1) % PERIOD_COLORS.length]})`;
  }
  updateBadges(index);
}

let multiSnapshot = []; // frozen copy of periods at start

function multiTick() {
  multi.remaining--;
  multiUpdateDisplay();

  if (multi.remaining > 0) return;

  const snapshot = multiSnapshot;
  const sound = document.getElementById("multi-sound").checked;
  const loop = document.getElementById("multi-loop").checked;
  const current = snapshot[multi.currentIndex];

  // Play sound for this period
  if (sound) {
    const variant = PERIOD_SOUNDS[multi.currentIndex % PERIOD_SOUNDS.length];
    playSound(variant);
  }
  flashNotify(PERIOD_COLORS[current.colorIndex] + "44");

  const nextIndex = multi.currentIndex + 1;

  if (nextIndex >= snapshot.length) {
    // All periods done
    multi.cycleCount++;
    if (loop) {
      multiSetStatus(`Cycle ${multi.cycleCount} complete – looping…`);
      multi.currentIndex = 0;
      multiLoadPeriod(snapshot, 0);
    } else {
      multiSetStatus(`✅ All periods complete! (${multi.cycleCount} cycle${multi.cycleCount > 1 ? "s" : ""})`);
      multiStop();
    }
  } else {
    multi.currentIndex = nextIndex;
    multiLoadPeriod(snapshot, nextIndex);
  }
}

/* ── Parallel mode ── */

function initParallelCountdowns() {
  multiSnapshot.forEach((p) => {
    const row = document.querySelector(`.period-item[data-id="${p.id}"]`);
    if (!row) return;
    const existing = row.querySelector(".period-countdown");
    if (existing) existing.remove();
    const cd = document.createElement("span");
    cd.className = "period-countdown";
    cd.textContent = formatTime(p.remaining);
    const removeBtn = row.querySelector(".btn-remove-period");
    row.insertBefore(cd, removeBtn);
  });
}

function updateParallelCountdownSpans() {
  multiSnapshot.forEach((p) => {
    const row = document.querySelector(`.period-item[data-id="${p.id}"]`);
    if (!row) return;
    const cd = row.querySelector(".period-countdown");
    if (cd) {
      cd.textContent = formatTime(p.remaining);
      cd.classList.toggle("done", p.done);
    }
  });
}

function updateBadgesParallel() {
  document.querySelectorAll(".period-badge").forEach((b, i) => {
    if (i < multiSnapshot.length) {
      b.classList.toggle("active", !multiSnapshot[i].done);
    }
  });
}

function multiUpdateParallelDisplay() {
  const { maxRemaining, maxTotal } = multiSnapshot.reduce(
    (acc, p) => ({
      maxRemaining: Math.max(acc.maxRemaining, p.remaining),
      maxTotal: Math.max(acc.maxTotal, p.total),
    }),
    { maxRemaining: 0, maxTotal: 0 }
  );
  document.getElementById("multi-display").textContent = formatTime(maxRemaining);
  const fraction = maxTotal > 0 ? maxRemaining / maxTotal : 0;
  document.getElementById("multi-progress-bar").style.width = `${fraction * 100}%`;
  const { running, paused } = multi;
  document.getElementById("multi-start-btn").disabled = running && !paused;
  document.getElementById("multi-start-btn").textContent = paused ? "▶ Resume" : "▶ Start";
  document.getElementById("multi-pause-btn").disabled = !running || paused;
}

function multiParallelTick() {
  const sound = document.getElementById("multi-sound").checked;
  const loop = document.getElementById("multi-loop").checked;

  multiSnapshot.forEach((p, i) => {
    if (p.done) return;
    p.remaining--;
    if (p.remaining <= 0) {
      p.remaining = 0;
      p.done = true;
      if (sound) playSound(PERIOD_SOUNDS[i % PERIOD_SOUNDS.length]);
      flashNotify(PERIOD_COLORS[p.colorIndex] + "44");
    }
  });

  updateParallelCountdownSpans();
  multiUpdateParallelDisplay();

  if (multiSnapshot.every((p) => p.done)) {
    multi.cycleCount++;
    if (loop) {
      multiSetStatus(`Cycle ${multi.cycleCount} complete – looping…`);
      multiSnapshot.forEach((p) => {
        p.remaining = p.total;
        p.done = false;
      });
      updateParallelCountdownSpans();
      renderBadges();
      updateBadgesParallel();
    } else {
      multiSetStatus(`✅ All periods complete! (${multi.cycleCount} cycle${multi.cycleCount > 1 ? "s" : ""})`);
      multiStop();
    }
  } else {
    updateBadgesParallel();
  }
}

function multiLoadPeriod(snapshot, index) {
  const p = snapshot[index];
  const totalSecs = periodDuration(p);
  multi.remaining = totalSecs;
  multi.currentTotal = totalSecs;
  multiHighlightPeriod(index, snapshot);
  multiUpdateDisplay();
}

function multiStart() {
  const isParallel = document.getElementById("multi-parallel").checked;

  // Resume from pause
  if (multi.paused) {
    multi.paused = false;
    multi.running = true;
    multi.intervalId = setInterval(isParallel ? multiParallelTick : multiTick, 1000);
    if (isParallel) {
      multiUpdateParallelDisplay();
    } else {
      multiUpdateDisplay();
    }
    return;
  }

  // Snapshot current period data, keeping only periods with a positive duration
  multiSnapshot = collectPeriods().filter((p) => p.minutes * 60 + p.seconds > 0);
  if (multiSnapshot.length === 0) {
    multiSetStatus("⚠ Please set at least one period with a duration > 0.");
    return;
  }

  multi.running = true;
  multi.paused = false;
  multi.cycleCount = 0;
  multiSetStatus("");

  renderBadges(); // re-render with current names

  if (isParallel) {
    // Initialise per-period remaining
    multiSnapshot.forEach((p) => {
      const total = periodDuration(p);
      p.remaining = total;
      p.total = total;
      p.done = false;
    });
    multi.currentIndex = -1;
    document.getElementById("multi-current-label").textContent = "Running in parallel";
    document.getElementById("multi-progress-bar").style.background =
      "linear-gradient(90deg, var(--accent), var(--purple))";
    initParallelCountdowns();
    multiUpdateParallelDisplay();
    updateBadgesParallel();
    multi.intervalId = setInterval(multiParallelTick, 1000);
  } else {
    multi.currentIndex = 0;
    multiLoadPeriod(multiSnapshot, 0);
    multi.intervalId = setInterval(multiTick, 1000);
  }
}

function multiPause() {
  if (!multi.running || multi.paused) return;
  clearInterval(multi.intervalId);
  multi.paused = true;
  multi.running = false;
  multiSetStatus("Timer paused.");
  const isParallel = document.getElementById("multi-parallel").checked;
  if (isParallel) {
    multiUpdateParallelDisplay();
  } else {
    multiUpdateDisplay();
  }
}

function multiStop() {
  clearInterval(multi.intervalId);
  multi.running = false;
  multi.paused = false;
  document.querySelectorAll(".period-countdown").forEach((el) => el.remove());
  multiUpdateDisplay();
  document.getElementById("multi-start-btn").textContent = "▶ Start";
  document.getElementById("multi-start-btn").disabled = false;
  document.getElementById("multi-pause-btn").disabled = true;
  document.querySelectorAll(".period-item").forEach((el) => el.classList.remove("active-period"));
  updateBadges(-1);
}

function multiReset() {
  multiStop();
  multi.currentIndex = 0;
  multi.remaining = 0;
  multi.currentTotal = 0;
  multi.cycleCount = 0;
  document.getElementById("multi-display").textContent = "00:00";
  document.getElementById("multi-current-label").textContent = "—";
  document.getElementById("multi-progress-bar").style.width = "100%";
  document.getElementById("multi-progress-bar").style.background =
    "linear-gradient(90deg, var(--accent), var(--purple))";
  multiSetStatus("");
}

/* ── Bootstrap ── */
(function init() {
  // Initialise simple ring
  const ring = document.getElementById("simple-ring");
  ring.style.strokeDasharray = RING_CIRCUMFERENCE;
  ring.style.strokeDashoffset = 0;

  // Seed multi-period with three defaults
  addPeriod("Short", 0, 15);
  addPeriod("Medium", 0, 30);
  addPeriod("Long", 1, 0);

  // Ensure simple view is shown
  switchMode("simple");

  // Reflect initial simple duration
  simple.remaining = simpleGetDuration();
  simple.total = simple.remaining;
  simpleUpdateUI();
})();
