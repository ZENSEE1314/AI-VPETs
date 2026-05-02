// Top-down tile world: render map, move player, interact with buildings & NPCs.
window.World = (function () {
  const TILE = 32;
  const COLS = 20, ROWS = 15;

  // Tile codes
  const G = 0; // grass
  const P = 1; // path
  const W = 2; // water (block)
  const T = 3; // tree (block)
  const F = 4; // farm tile (decor)
  const S = 5; // sand
  const B = 6; // building floor (block)

  // Two zones: town and wilds. Same dims for simplicity.
  const TOWN = [
    "TTTTTTTTTTTTTTTTTTTT",
    "TGGGGGGGGGGGGGGGGGGT",
    "TGGGBGGGGGGGGGGBGGGT",
    "TGGGGGGGGGGGGGGGGGGT",
    "TGGGGGGGGGGGGGGGGGGT",
    "TGFFFFFGGGPPPGGGGGGT",
    "TGFFFFFGGGGPGGGBGGGT",
    "TGFBFFFGGGGPGGGGGGGT",
    "TGFFFFFGGGGPGGGGGGGT",
    "TGGGGGGGGGGPGGGGGGGT",
    "TGGGGGGGGGGPGGGGGGGT",
    "TGGGGGGGGGGPGGGGGGGT",
    "TGGGGGGGGGGPGGGGGGGT",
    "TGGGGGGGGGGBGGGGGGGT",
    "TTTTTTTTTTTTTTTTTTTT",
  ];

  const WILDS = [
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
    const m = { tiles: [], cols: COLS, rows: ROWS };
    for (let y = 0; y < ROWS; y++) {
      const row = [];
      for (let x = 0; x < COLS; x++) {
        const ch = rows[y][x];
        row.push(ch === "G" ? G : ch === "P" ? P : ch === "W" ? W : ch === "T" ? T : ch === "F" ? F : ch === "S" ? S : ch === "B" ? B : G);
      }
      m.tiles.push(row);
    }
    return m;
  }

  // Buildings & POIs in town. Each has a tile (x,y) you stand next to and interact.
  // Interaction tile is the 'door' — the tile in front. We mark blocked tiles on map.
  const TOWN_POIS = [
    { id: "shop",   name: "Pet Shop",   emoji: "🏠", x: 4,  y: 2,  action: "openShop" },
    { id: "market", name: "Market",     emoji: "🛒", x: 15, y: 2,  action: "openMarket" },
    { id: "farm",   name: "Farm",       emoji: "🌾", x: 3,  y: 7,  action: "openFarm" },
    { id: "forge",  name: "Forge",      emoji: "⚒️", x: 15, y: 6,  action: "openForge" },
    { id: "wilds",  name: "Wilds Gate", emoji: "🌲", x: 11, y: 13, action: "enterWilds" },
  ];

  // NPCs wander on walkable tiles in town.
  const NPCS_POS = [
    { id: "mira",  x: 6,  y: 2 },
    { id: "kobo",  x: 13, y: 5 },
    { id: "rizen", x: 14, y: 9 },
    { id: "tess",  x: 7,  y: 9 },
  ];

  let zone = "town";
  let map = decode(TOWN);
  const player = { x: 10, y: 11, facing: "down" };
  let lastInteractKey = 0;

  const ctx = (() => {
    const c = document.getElementById("game");
    return c.getContext("2d");
  })();
  ctx.imageSmoothingEnabled = false;

  function currentZone() { return zone === "town" ? "Town" : "Wilds"; }

  function isBlocked(x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true;
    const t = map.tiles[y][x];
    if (t === W || t === T || t === B) return true;
    if (zone === "town") {
      // Building tiles already B; fine.
    }
    return false;
  }

  function tryMove(dx, dy) {
    if (UI.isDialogOpen()) return;
    const nx = player.x + dx, ny = player.y + dy;
    player.facing = dx === 1 ? "right" : dx === -1 ? "left" : dy === 1 ? "down" : "up";
    if (!isBlocked(nx, ny)) {
      player.x = nx; player.y = ny;
      passTime(1);
    }
    UI.refreshHUD();
  }

  function nearbyPOI() {
    if (zone !== "town") return null;
    for (const p of TOWN_POIS) {
      if (Math.abs(player.x - p.x) + Math.abs(player.y - p.y) <= 1) return p;
    }
    return null;
  }

  function nearbyNPC() {
    if (zone !== "town") return null;
    for (const n of NPCS_POS) {
      if (Math.abs(player.x - n.x) + Math.abs(player.y - n.y) <= 1) {
        return DATA.NPCS.find(d => d.id === n.id);
      }
    }
    return null;
  }

  function interact() {
    if (UI.isDialogOpen()) return;
    const now = Date.now();
    if (now - lastInteractKey < 200) return;
    lastInteractKey = now;

    if (zone === "wilds") {
      Arena.attack();
      return;
    }

    const npc = nearbyNPC();
    if (npc) { Market.trade(npc); return; }

    const poi = nearbyPOI();
    if (!poi) { UI.toast("Nothing nearby. Move next to a building or NPC.", "bad"); return; }
    handleAction(poi);
  }

  function handleAction(poi) {
    switch (poi.action) {
      case "openShop": openPetShop(); break;
      case "openMarket": Market.open(); break;
      case "openFarm": Farm.open(); break;
      case "openForge": Forge.open(); break;
      case "enterWilds": enterWilds(); break;
    }
  }

  function openPetShop() {
    const p = State.state.pet;
    let html = "";
    if (!State.state.flags.hiredOnce) {
      html = `<p>Welcome to the Pet Shop! Pick your <b>free</b> starter companion. (One only — care for them well!)</p><div class="grid">`;
      for (const [id, sp] of Object.entries(DATA.SPECIES)) {
        html += `<div class="card"><div class="name">${sp.emoji} ${sp.name}</div>
          <div class="meta">${sp.element} · HP ${sp.base.hp} ATK ${sp.base.atk} DEF ${sp.base.def} SPD ${sp.base.spd}</div>
          <button data-hire="${id}">Hire</button></div>`;
      }
      html += `</div>`;
    } else {
      html = `<p>What would you like to do?</p>
        <div class="grid">
          <div class="card"><div class="name">😴 Rest</div><div class="meta">Sleep till morning. Full restore.</div><button data-act="sleep">Sleep</button></div>
          <div class="card"><div class="name">🧼 Bathe</div><div class="meta">Clean your pet (uses soap if any).</div><button data-act="bathe">Bathe</button></div>
          <div class="card"><div class="name">🎈 Play</div><div class="meta">Lift their mood (20 min).</div><button data-act="play">Play</button></div>
          <div class="card"><div class="name">💼 Work</div><div class="meta">Send pet to a job (1h, costs energy).</div><button data-act="work">Work</button></div>
        </div>`;
    }
    const d = UI.dialog({
      title: "🏠 Pet Shop",
      body: html,
      actions: [{ label: "Leave", onClick: UI.closeDialog }],
    });
    d.body.addEventListener("click", (e) => {
      const hire = e.target.closest("button[data-hire]");
      if (hire) {
        const id = hire.dataset.hire;
        UI.closeDialog();
        promptName(id);
        return;
      }
      const act = e.target.closest("button[data-act]");
      if (!act) return;
      UI.closeDialog();
      switch (act.dataset.act) {
        case "sleep": Pet.sleep(); break;
        case "bathe": Pet.bathe(); break;
        case "play":  Pet.play();  break;
        case "work":  Pet.work();  break;
      }
    });
  }

  function promptName(species) {
    const sp = DATA.SPECIES[species];
    const wrap = document.createElement("div");
    wrap.innerHTML = `<p>Name your ${sp.emoji} ${sp.name}:</p>
      <input id="pn" maxlength="14" style="width:100%;padding:8px;background:#0a0d1f;color:var(--ink);border:1px solid var(--border);border-radius:6px" value="${sp.name}">`;
    const d = UI.dialog({
      title: "Name your pet",
      body: wrap,
      actions: [
        { label: "Cancel", onClick: UI.closeDialog },
        { label: "Hire!", primary: true, onClick: () => {
          const name = (wrap.querySelector("#pn").value || sp.name).trim().slice(0, 14);
          Pet.hire(species, name);
          UI.closeDialog();
        } },
      ],
    });
    setTimeout(() => wrap.querySelector("#pn").focus(), 30);
  }

  function enterWilds() {
    if (!State.getActivePet()) return UI.toast("Hire a pet first", "bad");
    zone = "wilds";
    map = decode(WILDS);
    player.x = 10; player.y = 13;
    Arena.enter();
    UI.refreshHUD();
  }

  function leaveWilds() {
    if (zone !== "wilds") return;
    Arena.leave();
    zone = "town";
    map = decode(TOWN);
    player.x = 11; player.y = 12;
    UI.log("Returned to town.");
    UI.refreshHUD();
  }

  function passTime(mins) {
    const s = State.state;
    s.minutes += mins;
    while (s.minutes >= 24 * 60) { s.minutes -= 24 * 60; s.day += 1; }
    Pet.decay(mins);
    Farm.tickGrowth();
  }

  // ----- Rendering -----

  function drawTile(x, y, t) {
    const px = x * TILE, py = y * TILE;
    let fill = "#1a3a1a";
    if (t === G) fill = "#2c5b2c";
    else if (t === P) fill = "#a18a5e";
    else if (t === W) fill = "#1c4470";
    else if (t === T) fill = "#1a3a1a";
    else if (t === F) fill = "#5b3a1a";
    else if (t === S) fill = "#c2a878";
    else if (t === B) fill = "#5c5066";
    ctx.fillStyle = fill;
    ctx.fillRect(px, py, TILE, TILE);
    if (t === G) {
      // grass speckles
      ctx.fillStyle = "#234c23";
      ctx.fillRect(px + 4, py + 6, 2, 2);
      ctx.fillRect(px + 20, py + 18, 2, 2);
      ctx.fillRect(px + 12, py + 24, 2, 2);
    } else if (t === T) {
      ctx.fillStyle = "#0e2710";
      ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
      ctx.fillStyle = "#3f7a3f";
      ctx.beginPath();
      ctx.arc(px + 16, py + 14, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5b3a1a";
      ctx.fillRect(px + 14, py + 22, 4, 6);
    } else if (t === F) {
      ctx.fillStyle = "#7a4a20";
      for (let i = 0; i < TILE; i += 6) ctx.fillRect(px, py + i, TILE, 1);
    } else if (t === W) {
      ctx.fillStyle = "#2563a0";
      ctx.fillRect(px + 4, py + 8, 8, 2);
      ctx.fillRect(px + 18, py + 20, 8, 2);
    } else if (t === B) {
      ctx.fillStyle = "#36304a";
      ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
    }
  }

  function drawPOIs() {
    if (zone !== "town") return;
    ctx.font = "20px serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const p of TOWN_POIS) {
      ctx.fillText(p.emoji, p.x * TILE + TILE / 2, p.y * TILE + TILE / 2);
      // label below
      ctx.fillStyle = "#dde";
      ctx.font = "9px monospace";
      ctx.fillText(p.name, p.x * TILE + TILE / 2, p.y * TILE + TILE - 3);
      ctx.font = "20px serif";
    }
  }

  function drawNPCs() {
    if (zone !== "town") return;
    ctx.font = "18px serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const n of NPCS_POS) {
      const data = DATA.NPCS.find(d => d.id === n.id);
      if (!data) continue;
      ctx.fillText(data.emoji, n.x * TILE + TILE / 2, n.y * TILE + TILE / 2);
    }
  }

  function drawPlayer() {
    const px = player.x * TILE, py = player.y * TILE;
    const costume = State.state.costume ? DATA.COSTUMES[State.state.costume] : null;
    if (costume) {
      // shadow
      ctx.fillStyle = "rgba(0,0,0,.3)";
      ctx.beginPath(); ctx.ellipse(px + TILE / 2, py + TILE - 3, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.font = "24px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(costume.emoji, px + TILE / 2, py + TILE / 2);
    } else {
      ctx.fillStyle = "#ffd76a";
      ctx.fillRect(px + 8, py + 10, 16, 18);
      ctx.fillStyle = "#ffe1b3";
      ctx.fillRect(px + 10, py + 4, 12, 10);
      ctx.fillStyle = "#000";
      let fx = px + 16, fy = py + 9;
      if (player.facing === "left") fx = px + 12;
      if (player.facing === "right") fx = px + 20;
      if (player.facing === "up") fy = py + 6;
      if (player.facing === "down") fy = py + 12;
      ctx.fillRect(fx - 1, fy - 1, 2, 2);
    }
    if (State.state.pet && zone === "town") {
      const sp = DATA.SPECIES[State.state.pet.species];
      if (sp) {
        ctx.font = "14px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(sp.emoji.slice(-2), px + TILE / 2 + 8, py + TILE - 4);
      }
    }
  }

  function drawHints() {
    const poi = nearbyPOI();
    const npc = nearbyNPC();
    let hint = null;
    if (zone === "wilds") hint = "Wilds — E/Space attack, C catch, walk off bottom edge to leave.";
    else if (npc) hint = `Press E to talk to ${npc.name}`;
    else if (poi) hint = `Press E: ${poi.name}`;
    if (!hint) return;
    ctx.fillStyle = "rgba(0,0,0,.6)";
    ctx.fillRect(0, 0, COLS * TILE, 18);
    ctx.fillStyle = "#fff";
    ctx.font = "11px monospace";
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(hint, 6, 4);
  }

  function render() {
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) drawTile(x, y, map.tiles[y][x]);
    drawPOIs();
    drawNPCs();
    if (zone === "wilds") Arena.render(ctx);
    drawPlayer();
    drawHints();

    // Day/night tint
    const m = State.state.minutes;
    let dark = 0;
    if (m < 6 * 60 || m > 20 * 60) dark = 0.45;
    else if (m < 7 * 60 || m > 19 * 60) dark = 0.2;
    if (dark > 0) {
      ctx.fillStyle = `rgba(20,30,80,${dark})`;
      ctx.fillRect(0, 0, COLS * TILE, ROWS * TILE);
    }
  }

  function checkZoneEdge() {
    if (zone === "wilds" && player.y >= ROWS - 1) leaveWilds();
  }

  function input(e) {
    const k = e.key.toLowerCase();
    if (UI.isDialogOpen() && k === "escape") { UI.closeDialog(); return; }
    if (UI.isDialogOpen()) return;
    if (k === "arrowup" || k === "w") { tryMove(0, -1); checkZoneEdge(); }
    else if (k === "arrowdown" || k === "s") { tryMove(0, 1); checkZoneEdge(); }
    else if (k === "arrowleft" || k === "a") { tryMove(-1, 0); checkZoneEdge(); }
    else if (k === "arrowright" || k === "d") { tryMove(1, 0); checkZoneEdge(); }
    else if (k === "e" || k === " ") interact();
    else if (k === "c") { if (zone === "wilds") Arena.tryCatch(); }
    else if (k === "i") UI.openBag();
    else if (k === "r") UI.openRoster();
    else if (k === "x") UI.openDex();
    else if (k === "p") UI.openPetMenu();
    else if (e.key === "F2") { State.state.admin = !State.state.admin; UI.toast("Admin: " + State.state.admin, "good"); UI.refreshHUD(); }
  }

  return { render, input, tryMove, interact, currentZone, passTime, enterWilds, leaveWilds, player };
})();
