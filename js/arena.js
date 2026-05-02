// Real-time top-down action arena (MapleStory-flavored multi-monster fights).
// Player walks freely; pressing E/Space swings a melee attack that hits ALL
// monsters within range. Monsters chase and bump-attack the player.
window.Arena = (function () {
  const COLS = 20, ROWS = 15, TILE = 32;
  const SPAWN_INTERVAL = 4000;       // spawn cooldown ms
  const MAX_MONSTERS = 6;
  const ATTACK_COOLDOWN = 300;       // ms
  const ATTACK_RANGE = 1.6;          // tiles
  const MONSTER_MOVE_INTERVAL = 380; // ms per tile

  let active = false;
  let monsters = [];
  let lootDrops = [];
  let lastSpawn = 0;
  let lastAttack = 0;
  let attackFx = 0;
  let arenaMap = null;

  const ARENA_MAP = [
    "TTTTTTTTTTTTTTTTTTTT",
    "TGGGGTTGGGGTTGGGGGGT",
    "TGGGGGGGGGGGGGGGGGGT",
    "TGGTTGGGGGGTTGGGGGGT",
    "TGGTGGGGGTTTGGGTTTGT",
    "TGGGGGGGGGGGGGGTTGGT",
    "TGGTTGGGGGGGGGGGGGGT",
    "TGGGGGGGGTTGGGGGGGGT",
    "TGGGGTTGGGGGGGGGGGGT",
    "TGGGGGGGGGGGGGGTTGGT",
    "TGGGGGGGGGGGGGGGGGGT",
    "TGGTTGGGGTTGGGGGGGGT",
    "TGGGGGGGGGGGGGGGGGGT",
    "TGGGGGGGGGGGGGGGGGGT",
    "TTTTTTTTTTTTTTTTTTTT",
  ];

  function decode(rows) {
    const out = [];
    for (let y = 0; y < ROWS; y++) {
      const row = [];
      for (let x = 0; x < COLS; x++) {
        const ch = rows[y][x];
        // 0 walkable grass, 1 blocked tree/wall
        row.push(ch === "T" ? 1 : 0);
      }
      out.push(row);
    }
    return out;
  }

  function isBlocked(x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true;
    return arenaMap[y][x] === 1;
  }

  function enter() {
    active = true;
    monsters = [];
    lootDrops = [];
    arenaMap = decode(ARENA_MAP);
    lastSpawn = performance.now() - SPAWN_INTERVAL;
    UI.log("Entered the Wilds. Spam E/Space to attack. Walk off the bottom edge to leave.");
  }

  function leave() {
    active = false;
    monsters = [];
    lootDrops = [];
  }

  function isActive() { return active; }

  function spawn() {
    if (monsters.length >= MAX_MONSTERS) return;
    const p = State.getActivePet();
    const lvl = p ? p.level : 1;
    const pool = DATA.MONSTERS.filter(m => Math.abs(m.level - lvl) <= 3);
    const tpl = U.pick(pool.length ? pool : DATA.MONSTERS.slice(0, 3));
    const scale = 1 + Math.max(0, lvl - tpl.level) * 0.12;
    let sx, sy, tries = 0;
    do {
      sx = U.randi(1, COLS - 2);
      sy = U.randi(1, ROWS - 2);
      tries++;
    } while ((isBlocked(sx, sy) || nearPlayer(sx, sy, 3)) && tries < 30);
    monsters.push({
      tpl,
      id: tpl.id,
      name: tpl.name,
      emoji: tpl.emoji,
      element: tpl.element,
      level: tpl.level,
      maxHp: Math.round(tpl.hp * scale),
      hp: Math.round(tpl.hp * scale),
      atk: Math.round(tpl.atk * scale),
      def: Math.round(tpl.def * scale),
      exp: tpl.exp,
      gold: tpl.gold,
      drops: tpl.drops,
      x: sx, y: sy,
      lastMove: 0,
      lastHit: 0,
      flash: 0,
    });
    State.state.dex.seen[tpl.id] = true;
  }

  function nearPlayer(x, y, r) {
    const px = World.player.x, py = World.player.y;
    return Math.abs(x - px) + Math.abs(y - py) <= r;
  }

  function dist(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  function attack() {
    const now = performance.now();
    if (now - lastAttack < ATTACK_COOLDOWN) return;
    lastAttack = now;
    attackFx = now + 180;
    const p = State.getActivePet();
    if (!p) return;
    if (p.hp <= 0) return;
    const player = World.player;
    const sp = DATA.SPECIES[p.species] || { element: "none" };
    let hits = 0;
    for (const m of monsters) {
      if (m.hp <= 0) continue;
      if (dist(m, player) <= ATTACK_RANGE) {
        const mul = (DATA.ELEMENT[sp.element]?.[m.element]) ?? 1.0;
        const crit = U.chance(0.10);
        const dmg = Math.max(1, Math.round((Pet.atk(p) * mul - m.def * 0.5) * (crit ? 1.6 : 1.0) * U.rand(0.85, 1.15)));
        m.hp -= dmg;
        m.flash = now + 120;
        m.lastHit = now;
        hits++;
        if (m.hp <= 0) onKill(m);
      }
    }
    if (hits > 0) {
      p.energy = U.clamp(p.energy - 0.5, 0, 100);
    }
  }

  function onKill(m) {
    Pet.gainExp(m.exp);
    State.addGold(m.gold);
    UI.log(`Defeated ${m.emoji} ${m.name}! +${m.exp} EXP, +🪙${m.gold}`, "good");
    for (const [drop, chance] of Object.entries(m.drops || {})) {
      if (U.chance(chance)) {
        State.addItem(drop, 1);
        UI.toast(`Picked up ${DATA.ITEMS[drop].emoji} ${DATA.ITEMS[drop].name}`, "good");
      }
    }
  }

  function tryCatch() {
    const player = World.player;
    const p = State.getActivePet();
    if (!p) return;
    // Find weakest monster in range.
    const candidates = monsters.filter(m => m.hp > 0 && dist(m, player) <= ATTACK_RANGE + 0.5);
    if (!candidates.length) return UI.toast("No monster in range", "bad");
    const target = candidates.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];

    const useSuper = State.hasItem("superball");
    const useNormal = State.hasItem("ball");
    if (!useSuper && !useNormal) return UI.toast("No catch ball in bag", "bad");
    const ballId = useSuper ? "superball" : "ball";
    State.removeItem(ballId, 1);

    const hpFrac = target.hp / target.maxHp;
    const baseRate = ballId === "superball" ? 0.5 : 0.25;
    const rate = U.clamp(baseRate + (1 - hpFrac) * 0.7 - target.level * 0.03, 0.05, 0.95);
    if (U.chance(rate)) {
      // Caught!
      target.hp = 0;
      monsters = monsters.filter(x => x !== target);
      // Adopt as pet (species id == monster id; ensure species exists).
      ensureSpeciesFromMonster(target);
      Pet.adopt(target.id, target.name, target.level);
      UI.log(`Caught ${target.emoji} ${target.name}! Added to roster.`, "good");
      State.state.dex.caught[target.id] = true;
    } else {
      UI.toast(`${target.name} broke free!`, "bad");
      target.flash = performance.now() + 300;
    }
  }

  function ensureSpeciesFromMonster(m) {
    if (DATA.SPECIES[m.id]) return;
    DATA.SPECIES[m.id] = {
      name: m.name,
      emoji: m.emoji,
      color: "#ccccff",
      element: m.element,
      base: { hp: m.maxHp, atk: Math.max(3, m.atk - 1), def: Math.max(2, m.def - 1), spd: 5 },
    };
  }

  function tickMonsters(now) {
    const player = World.player;
    const p = State.getActivePet();
    for (const m of monsters) {
      if (m.hp <= 0) continue;
      if (now - m.lastMove < MONSTER_MOVE_INTERVAL) continue;
      m.lastMove = now;
      // Step toward player.
      const dx = Math.sign(player.x - m.x);
      const dy = Math.sign(player.y - m.y);
      // Try preferred axis first
      const opts = Math.abs(player.x - m.x) > Math.abs(player.y - m.y)
        ? [[dx, 0], [0, dy], [dx, dy]]
        : [[0, dy], [dx, 0], [dx, dy]];
      for (const [mx, my] of opts) {
        if (mx === 0 && my === 0) continue;
        const nx = m.x + mx, ny = m.y + my;
        if (isBlocked(nx, ny)) continue;
        if (monsters.some(o => o !== m && o.hp > 0 && o.x === nx && o.y === ny)) continue;
        if (nx === player.x && ny === player.y) {
          // Bump attack
          if (p) {
            const sp = DATA.SPECIES[p.species] || { element: "none" };
            const wmul = (DATA.ELEMENT[m.element]?.[sp.element]) ?? 1.0;
            const dmg = Math.max(1, Math.round((m.atk * wmul - Pet.def(p) * 0.5) * U.rand(0.85, 1.15)));
            p.hp = U.clamp(p.hp - dmg, 0, p.maxHp);
            UI.toast(`${m.name} hit you for ${dmg}`, "bad");
            if (p.hp <= 0) {
              p.hp = 1;
              const lost = Math.min(20, State.state.gold);
              State.addGold(-lost);
              UI.log(`${p.name} fainted! Carried home, lost 🪙${lost}.`, "bad");
              World.leaveWilds();
              leave();
              UI.refreshHUD();
              return;
            }
          }
          break;
        }
        m.x = nx; m.y = ny;
        break;
      }
    }
  }

  function tick(dtMs) {
    if (!active) return;
    const now = performance.now();
    if (now - lastSpawn > SPAWN_INTERVAL) {
      spawn();
      lastSpawn = now;
    }
    tickMonsters(now);
    // Advance world clock slowly while fighting.
    if (Math.random() < dtMs / 6000) World.passTime(1);
  }

  function render(ctx) {
    if (!active) return;
    // Re-draw arena ground (overrides world's town tiles already replaced)
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      // tiles drawn by world.js — we just overlay monsters/loot.
    }
    const now = performance.now();
    // Loot
    ctx.font = "16px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const m of monsters) {
      if (m.hp <= 0) continue;
      const px = m.x * TILE, py = m.y * TILE;
      // shadow
      ctx.fillStyle = "rgba(0,0,0,.3)";
      ctx.beginPath(); ctx.ellipse(px + TILE / 2, py + TILE - 4, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
      // body flash
      if (m.flash > now) {
        ctx.fillStyle = "rgba(255,80,80,.4)";
        ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
      }
      ctx.font = "20px serif"; ctx.fillStyle = "#fff";
      ctx.fillText(m.emoji, px + TILE / 2, py + TILE / 2 + 2);
      // HP bar
      const w = TILE - 8, h = 3;
      ctx.fillStyle = "#000"; ctx.fillRect(px + 4, py + 2, w, h);
      ctx.fillStyle = m.hp / m.maxHp > 0.5 ? "#7cffb1" : m.hp / m.maxHp > 0.25 ? "#ffd76a" : "#ff7a8a";
      ctx.fillRect(px + 4, py + 2, w * (m.hp / m.maxHp), h);
      // tiny level
      ctx.font = "8px monospace"; ctx.fillStyle = "#fff";
      ctx.fillText("Lv" + m.level, px + TILE / 2, py + TILE - 2);
    }
    // Player attack swing FX
    if (attackFx > now) {
      const player = World.player;
      ctx.strokeStyle = "rgba(255,230,120,.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x * TILE + TILE / 2, player.y * TILE + TILE / 2, ATTACK_RANGE * TILE, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Banner
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(0, ROWS * TILE - 18, COLS * TILE, 18);
    ctx.fillStyle = "#fff"; ctx.font = "11px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("E/Space attack · C catch · ↓ off bottom edge to leave Wilds", 6, ROWS * TILE - 14);
  }

  return { enter, leave, isActive, attack, tryCatch, tick, render, spawn };
})();
