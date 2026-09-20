const NS = "http://www.w3.org/2000/svg";
const score = document.querySelector("#score");
const generateButton = document.querySelector("#generateButton");
const playButton = document.querySelector("#playButton");
const playLabel = document.querySelector("#playLabel");
const tempo = document.querySelector("#tempo");
const tempoValue = document.querySelector("#tempoValue");
const progressBar = document.querySelector("#progressBar");
const exerciseNumber = document.querySelector("#exerciseNumber");

const melodyPool = [60, 62, 64, 65, 67, 69, 71, 72, 74];
const roots = [
  { name: "C", midi: 0 }, { name: "C♯", midi: 1 }, { name: "D", midi: 2 },
  { name: "D♯", midi: 3 }, { name: "E", midi: 4 }, { name: "F", midi: 5 },
  { name: "F♯", midi: 6 }, { name: "G", midi: 7 }, { name: "G♯", midi: 8 },
  { name: "A", midi: 9 }, { name: "A♯", midi: 10 }, { name: "B", midi: 11 },
];
const chordQualities = [
  { suffix: "7", intervals: [0, 4, 7, 10] },
  { suffix: "M7", intervals: [0, 4, 7, 11] },
  { suffix: "m7", intervals: [0, 3, 7, 10] },
];
let phrase = [];
let runNumber = 1;
let timers = [];
let audioContext;

function randomItem(items) { return items[Math.floor(Math.random() * items.length)]; }

function createPhrase() {
  let previous = randomItem(melodyPool);
  let currentChord;
  return Array.from({ length: 32 }, (_, index) => {
    const nearby = melodyPool.filter(note => Math.abs(note - previous) <= 5);
    const melody = index % 8 === 0 ? randomItem(melodyPool.slice(0, 6)) : randomItem(nearby);
    previous = melody;
    if (index % 2 === 0) {
      const root = randomItem(roots);
      const quality = randomItem(chordQualities);
      currentChord = {
        name: `${root.name}${quality.suffix}`,
        tones: quality.intervals.map(interval => root.midi + interval),
      };
    }
    const candidates = [];
    for (let midi = melody - 12; midi <= melody + 12; midi += 1) {
      if (currentChord.tones.some(tone => (midi - tone + 120) % 12 === 0)) candidates.push(midi);
    }
    const lower = candidates.filter(note => note < melody);
    const harmony = randomItem(lower.length ? lower : candidates);
    return { melody, harmony, chord: currentChord.name };
  });
}

function svgElement(tag, attrs = {}, text = "") {
  const element = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  if (text) element.textContent = text;
  return element;
}

function noteY(midi) {
  const diatonic = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };
  const octave = Math.floor(midi / 12) - 5;
  const pc = midi % 12;
  const naturalPc = [0, 2, 4, 5, 7, 9, 11].filter(value => value <= pc).at(-1) ?? 0;
  const step = octave * 7 + diatonic[naturalPc];
  return 188 - step * 7;
}

function drawNote(x, midi, color, stemUp = true) {
  const y = noteY(midi);
  const pc = midi % 12;
  if (y > 181) {
    for (let ledgerY = 188; ledgerY <= y + 2; ledgerY += 14) {
      score.append(svgElement("line", { x1: x - 11, y1: ledgerY, x2: x + 11, y2: ledgerY, stroke: color, "stroke-width": .85 }));
    }
  }
  if ([1, 3, 6, 8, 10].includes(pc)) {
    score.append(svgElement("text", { x: x - 15, y: y + 5, fill: color, "font-size": 16, "font-family": "serif" }, "♯"));
  }
  score.append(svgElement("ellipse", { cx: x, cy: y, rx: 7.5, ry: 5.2, fill: color, transform: `rotate(-18 ${x} ${y})` }));
  const stemX = stemUp ? x + 6 : x - 6;
  score.append(svgElement("line", { x1: stemX, y1: y, x2: stemX, y2: stemUp ? y - 35 : y + 35, stroke: color, "stroke-width": 1.6 }));
}

function renderScore() {
  score.replaceChildren();
  score.append(svgElement("rect", { width: 1160, height: 330, fill: "#fffdf8" }));
  score.append(svgElement("text", { x: 25, y: 43, fill: "#718f79", "font-size": 10, "font-weight": 700, "letter-spacing": 2 }, "MODERATO · 4/4"));
  const staffStart = 118;
  for (let line = 0; line < 5; line += 1) {
    score.append(svgElement("line", { x1: 28, y1: staffStart + line * 14, x2: 1132, y2: staffStart + line * 14, stroke: "#65706b", "stroke-width": .85 }));
  }
  score.append(svgElement("text", { x: 37, y: 168, fill: "#1e2925", "font-size": 76, "font-family": "serif" }, "𝄞"));
  score.append(svgElement("text", { x: 86, y: 141, fill: "#1e2925", "font-size": 28, "font-family": "serif", "text-anchor": "middle" }, "4"));
  score.append(svgElement("text", { x: 86, y: 170, fill: "#1e2925", "font-size": 28, "font-family": "serif", "text-anchor": "middle" }, "4"));

  phrase.forEach((note, index) => {
    const x = 122 + index * 31.4;
    const isBeat = index % 2 === 0;
    if (isBeat) score.append(svgElement("line", { x1: x, y1: 99, x2: x, y2: 189, stroke: "#d7d2c7", "stroke-width": .55, "stroke-dasharray": "2 4" }));
    if (index % 2 === 0) {
      const chordCenterX = x + 15.7;
      score.append(svgElement("text", { x: chordCenterX, y: 80, fill: "#1e2925", "font-size": 12, "font-weight": 600, "text-anchor": "middle", "font-family": "Noto Sans JP, sans-serif" }, note.chord));
    }
    drawNote(x, note.melody, "#1e2925", true);
    drawNote(x, note.harmony, "#718f79", false);
    if ((index + 1) % 8 === 0) {
      const barX = x + 16;
      score.append(svgElement("line", { x1: barX, y1: staffStart, x2: barX, y2: staffStart + 56, stroke: "#1e2925", "stroke-width": index === 31 ? 3 : 1.4 }));
      score.append(svgElement("text", { x: barX - 8, y: 228, fill: "#9b9e98", "font-size": 9, "text-anchor": "end" }, String((index + 1) / 8)));
    }
  });
  score.append(svgElement("text", { x: 28, y: 292, fill: "#68716c", "font-size": 11 }, "右手：メロディー　　左手：グリーンのコード構成音"));
  score.append(svgElement("line", { x1: 28, y1: 307, x2: 1132, y2: 307, stroke: "#d7d2c7" }));
}

function stopPlayback() {
  timers.forEach(clearTimeout);
  timers = [];
  playLabel.textContent = "お手本を聴く";
  playButton.querySelector("span").textContent = "▶";
  progressBar.style.width = "0";
}

function playTone(midi, start, duration, gainValue) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(gainValue, start + .015);
  gain.gain.exponentialRampToValueAtTime(.001, start + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

function togglePlayback() {
  if (timers.length) return stopPlayback();
  audioContext ||= new AudioContext();
  const eighth = 30 / Number(tempo.value);
  const now = audioContext.currentTime + .05;
  phrase.forEach((note, index) => {
    playTone(note.melody, now + index * eighth, eighth * .82, .08);
    playTone(note.harmony, now + index * eighth, eighth * .82, .045);
    timers.push(setTimeout(() => { progressBar.style.width = `${((index + 1) / phrase.length) * 100}%`; }, index * eighth * 1000));
  });
  timers.push(setTimeout(stopPlayback, phrase.length * eighth * 1000 + 100));
  playLabel.textContent = "停止する";
  playButton.querySelector("span").textContent = "■";
}

function regenerate() {
  stopPlayback();
  phrase = createPhrase();
  exerciseNumber.textContent = String(runNumber).padStart(2, "0");
  runNumber += 1;
  renderScore();
}

generateButton.addEventListener("click", regenerate);
playButton.addEventListener("click", togglePlayback);
tempo.addEventListener("input", () => { tempoValue.textContent = `${tempo.value} BPM`; });
document.addEventListener("keydown", event => {
  if (event.target.matches("input")) return;
  if (event.code === "Space") { event.preventDefault(); togglePlayback(); }
  if (event.key.toLowerCase() === "r") regenerate();
});

regenerate();
