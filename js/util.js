window.U = {
  clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },
  rand(min, max) { return min + Math.random() * (max - min); },
  randi(min, max) { return Math.floor(this.rand(min, max + 1)); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  chance(p) { return Math.random() < p; },
  fmtTime(mins) {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  },
};
