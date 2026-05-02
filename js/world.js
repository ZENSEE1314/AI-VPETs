// Top-down tile world: render map, move player, interact with buildings & NPCs.
window.World = (function () {
  const TILE = 48;
  const COLS = 20, ROWS = 15;
  let frame = 0; // animation tick (incremented per render)

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
    if (t === G) {
      // soft grass with darker bottom and lighter highlight
      const grad = ctx.createLinearGradient(0, py, 0, py + TILE);
      grad.addColorStop(0, "#4ea456"); grad.addColorStop(1, "#286a32");
      ctx.fillStyle = grad; ctx.fillRect(px, py, TILE, TILE);
      // outline
      ctx.strokeStyle = "rgba(0,0,0,.18)"; ctx.lineWidth = 1;
      ctx.strokeRect(px + .5, py + .5, TILE - 1, TILE - 1);
      // grass tufts (deterministic positions per tile)
      ctx.fillStyle = "#1d5024";
      const seed = (x * 31 + y * 17) % 7;
      ctx.fillRect(px + 6 + seed, py + 12, 2, 5);
      ctx.fillRect(px + 26 - seed, py + 30, 2, 5);
      ctx.fillRect(px + 38, py + 18 + seed, 2, 4);
    } else if (t === P) {
      // cobble path
      const grad = ctx.createLinearGradient(0, py, 0, py + TILE);
      grad.addColorStop(0, "#d8b88a"); grad.addColorStop(1, "#a78858");
      ctx.fillStyle = grad; ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = "rgba(60,30,10,.35)"; ctx.lineWidth = 1;
      ctx.strokeRect(px + .5, py + .5, TILE - 1, TILE - 1);
      // little stones
      ctx.fillStyle = "rgba(110,80,40,.5)";
      ctx.fillRect(px + 8, py + 12, 6, 4);
      ctx.fillRect(px + 28, py + 22, 8, 4);
      ctx.fillRect(px + 14, py + 34, 6, 4);
    } else if (t === W) {
      const grad = ctx.createLinearGradient(0, py, 0, py + TILE);
      grad.addColorStop(0, "#3a86c8"); grad.addColorStop(1, "#1d4a82");
      ctx.fillStyle = grad; ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = "rgba(255,255,255,.35)";
      const off = Math.sin(frame * 0.05 + x + y) * 2;
      ctx.fillRect(px + 8, py + 14 + off, 14, 2);
      ctx.fillRect(px + 26, py + 30 - off, 12, 2);
    } else if (t === T) {
      // grass under
      ctx.fillStyle = "#286a32"; ctx.fillRect(px, py, TILE, TILE);
      // tree trunk
      ctx.fillStyle = "#5a3a18";
      ctx.fillRect(px + 21, py + 28, 6, 14);
      ctx.fillStyle = "#3a2510";
      ctx.fillRect(px + 21, py + 28, 6, 2);
      // canopy (3-circle puff)
      const sway = Math.sin(frame * 0.04 + x * 0.7) * 1.5;
      ctx.fillStyle = "#1d5024";
      ctx.beginPath(); ctx.arc(px + 24 + sway, py + 22, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#2f7a3a";
      ctx.beginPath(); ctx.arc(px + 18 + sway, py + 18, 11, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + 30 + sway, py + 20, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#52a85f";
      ctx.beginPath(); ctx.arc(px + 22 + sway, py + 14, 6, 0, Math.PI * 2); ctx.fill();
    } else if (t === F) {
      // tilled soil rows
      const grad = ctx.createLinearGradient(0, py, 0, py + TILE);
      grad.addColorStop(0, "#8c5a26"); grad.addColorStop(1, "#5a3514");
      ctx.fillStyle = grad; ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = "rgba(40,20,5,.4)";
      for (let i = 0; i < TILE; i += 8) ctx.fillRect(px, py + i + 2, TILE, 1);
      ctx.strokeStyle = "rgba(20,10,0,.4)";
      ctx.strokeRect(px + .5, py + .5, TILE - 1, TILE - 1);
    } else if (t === S) {
      ctx.fillStyle = "#dac28e"; ctx.fillRect(px, py, TILE, TILE);
    } else if (t === B) {
      // building floor / wall stone
      const grad = ctx.createLinearGradient(0, py, 0, py + TILE);
      grad.addColorStop(0, "#9d8fbb"); grad.addColorStop(1, "#5a4d78");
      ctx.fillStyle = grad; ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = "rgba(0,0,0,.35)";
      ctx.strokeRect(px + 2.5, py + 2.5, TILE - 5, TILE - 5);
      // little wooden door at the base
      ctx.fillStyle = "#5b3a1a";
      ctx.fillRect(px + 18, py + TILE - 16, 12, 14);
      ctx.fillStyle = "#ffd84d";
      ctx.fillRect(px + 27, py + TILE - 9, 1, 2);
      // roof line
      ctx.fillStyle = "#c84850";
      ctx.fillRect(px + 4, py + 4, TILE - 8, 6);
    }
  }

  function drawShadow(cx, cy) {
    ctx.fillStyle = "rgba(0,0,0,.32)";
    ctx.beginPath(); ctx.ellipse(cx, cy, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawNamePlate(cx, cy, text, color = "#ffd84d") {
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const w = ctx.measureText(text).width + 10;
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(cx - w / 2, cy - 8, w, 16);
    ctx.fillStyle = color;
    ctx.fillText(text, cx, cy);
  }

  function drawPOIs() {
    if (zone !== "town") return;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const p of TOWN_POIS) {
      const cx = p.x * TILE + TILE / 2, cy = p.y * TILE + TILE / 2;
      // building emoji big
      ctx.font = "36px serif";
      ctx.fillText(p.emoji, cx, cy - 4);
      // golden nameplate above the building
      drawNamePlate(cx, p.y * TILE - 2, p.name);
    }
  }

  function drawNPCs() {
    if (zone !== "town") return;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const n of NPCS_POS) {
      const data = DATA.NPCS.find(d => d.id === n.id);
      if (!data) continue;
      const cx = n.x * TILE + TILE / 2, cy = n.y * TILE + TILE / 2;
      drawShadow(cx, cy + TILE / 2 - 3);
      ctx.font = "30px serif";
      const bob = Math.sin((frame + n.x * 7) * 0.06) * 1.5;
      ctx.fillText(data.emoji, cx, cy + bob);
      // tiny name tag
      drawNamePlate(cx, n.y * TILE - 2, data.name, "#ffe9aa");
      // chat bubble dot for interactable
      if (Math.abs(player.x - n.x) + Math.abs(player.y - n.y) <= 1) {
        ctx.fillStyle = "#ffd84d";
        ctx.font = "bold 14px monospace";
        ctx.fillText("!", cx + 14, cy - TILE / 2 - 4 + Math.sin(frame * 0.2) * 2);
      }
    }
  }

  function drawPlayer() {
    const px = player.x * TILE, py = player.y * TILE;
    const cx = px + TILE / 2, cy = py + TILE / 2;
    const costume = State.state.costume ? DATA.COSTUMES[State.state.costume] : null;
    const bob = Math.sin(frame * 0.12) * 2;

    drawShadow(cx, py + TILE - 3);

    if (costume) {
      ctx.font = "36px serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(costume.emoji, cx, cy + bob);
    } else {
      // chunky chibi body — head + tunic + boots
      const flip = player.facing === "left" ? -1 : 1;
      const eyeOffX = player.facing === "left" ? -3 : player.facing === "right" ? 3 : 0;
      const eyeOffY = player.facing === "up" ? -2 : 0;

      // legs / boots
      ctx.fillStyle = "#3a2810";
      ctx.fillRect(cx - 9, cy + 14 + bob, 7, 8);
      ctx.fillRect(cx + 2, cy + 14 + bob, 7, 8);
      // tunic body
      const grad = ctx.createLinearGradient(0, cy - 4 + bob, 0, cy + 18 + bob);
      grad.addColorStop(0, "#3aa6ff"); grad.addColorStop(1, "#1a4faa");
      ctx.fillStyle = grad;
      ctx.fillRect(cx - 11, cy - 4 + bob, 22, 18);
      ctx.fillStyle = "#ffd84d";
      ctx.fillRect(cx - 11, cy + 9 + bob, 22, 2); // belt
      ctx.fillStyle = "#ffd84d";
      ctx.fillRect(cx - 1, cy - 2 + bob, 2, 11); // tunic centerline
      // arms
      ctx.fillStyle = "#ffe1b3";
      ctx.fillRect(cx - 14, cy - 1 + bob, 4, 12);
      ctx.fillRect(cx + 10, cy - 1 + bob, 4, 12);
      // head (round)
      ctx.fillStyle = "#ffe1b3";
      ctx.beginPath(); ctx.arc(cx, cy - 12 + bob, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 1; ctx.stroke();
      // hair
      ctx.fillStyle = "#7a4a18";
      ctx.beginPath(); ctx.arc(cx, cy - 16 + bob, 9, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillRect(cx - 9, cy - 16 + bob, 18, 4);
      // eyes
      ctx.fillStyle = "#1a1024";
      ctx.fillRect(cx - 4 + eyeOffX, cy - 12 + bob + eyeOffY, 2, 2);
      ctx.fillRect(cx + 2 + eyeOffX, cy - 12 + bob + eyeOffY, 2, 2);
      // mouth
      ctx.fillStyle = "#a04040";
      ctx.fillRect(cx - 1 + eyeOffX, cy - 7 + bob, 2, 1);
      // weapon when active pet has one
      const ap = State.state.pet;
      if (ap && ap.weapon) {
        ctx.strokeStyle = "#cccccc"; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx + 12 * flip, cy + 6 + bob);
        ctx.lineTo(cx + 22 * flip, cy - 6 + bob);
        ctx.stroke();
      }
      void flip;
    }
    // Active-pet companion trailing in town
    if (State.state.pet && zone === "town") {
      const sp = DATA.SPECIES[State.state.pet.species];
      if (sp) {
        ctx.font = "20px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const px2 = cx + 18, py2 = py + TILE - 6 + Math.sin(frame * 0.15 + 1) * 1.5;
        drawShadow(px2, py + TILE - 2);
        ctx.fillText(sp.emoji.slice(-2), px2, py2);
      }
    }
    // Player nameplate + level
    if (State.state.pet) {
      drawNamePlate(cx, py - 6, `Lv${State.state.pet.level} ${State.state.pet.name}`);
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
    const w = COLS * TILE;
    ctx.fillStyle = "rgba(0,0,0,.6)";
    ctx.fillRect(0, 0, w, 26);
    ctx.fillStyle = "#ffd84d";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(hint, 10, 6);
  }

  function render() {
    frame++;
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
