const form = document.getElementById("mystery-form");
const formTitle = document.getElementById("form-title");
const resetButton = document.getElementById("reset-form");
const cancelEditButton = document.getElementById("cancel-edit");
const saveButton = document.getElementById("save-button");
const formError = document.getElementById("form-error");

const listEl = document.getElementById("mystery-list");
const detailEmpty = document.getElementById("detail-empty");
const detailContent = document.getElementById("detail-content");
const detailSubtitle = document.getElementById("detail-subtitle");
const detailTitle = document.getElementById("detail-title");
const detailClues = document.getElementById("detail-clues");
const detailSuspects = document.getElementById("detail-suspects");
const detailLocations = document.getElementById("detail-locations");
const detailWeapons = document.getElementById("detail-weapons");
const editButton = document.getElementById("edit-mystery");
const deleteButton = document.getElementById("delete-mystery");
const gridEl = document.getElementById("logic-grid");

const summaryCount = document.getElementById("mystery-count");
const summaryUpdated = document.getElementById("last-updated");

const state = {
  mysteries: [],
  selectedId: null,
  detail: null,
  editingId: null,
  gridToken: 0,
  currentGrid: { locations: null, weapons: null, locWeapons: null },
  ws: null,
  wsTimer: null
};

function splitLines(value) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function fillList(ul, items) {
  ul.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    ul.appendChild(li);
  });
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function setSummary() {
  summaryCount.textContent = `${state.mysteries.length} mysteries`;
  if (state.mysteries.length === 0) {
    summaryUpdated.textContent = "Waiting for your first case";
    return;
  }
  const latest = state.mysteries[0];
  summaryUpdated.textContent = `Last updated ${formatDate(latest.createdAt)}`;
}

async function loadMysteries() {
  const res = await fetch("/api/mysteries");
  if (!res.ok) throw new Error("Failed to load mysteries.");
  state.mysteries = await res.json();
  setSummary();
  renderList();
}

async function loadDetail(id) {
  const res = await fetch(`/api/mysteries/${id}`);
  if (!res.ok) throw new Error("Failed to load mystery.");
  state.detail = await res.json();
  state.selectedId = id;
  renderDetail();
}

function renderList() {
  listEl.innerHTML = "";
  if (state.mysteries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No cases yet. Create the first one.";
    listEl.appendChild(empty);
    return;
  }

  state.mysteries.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = item.title;

    const meta = document.createElement("div");
    meta.className = "card-meta";
    meta.textContent = `${item.suspectCount} suspects · ${item.locationCount} locations · ${item.weaponCount} weapons`;

    const time = document.createElement("div");
    time.className = "card-meta";
    time.textContent = formatDate(item.createdAt);

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const viewBtn = document.createElement("button");
    viewBtn.className = "ghost";
    viewBtn.textContent = "View";
    viewBtn.addEventListener("click", () => loadDetail(item.id));

    actions.appendChild(viewBtn);

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(time);
    card.appendChild(actions);
    listEl.appendChild(card);
  });
}

function resetForm() {
  form.reset();
  state.editingId = null;
  formTitle.textContent = "New Mystery";
  saveButton.textContent = "Save Mystery";
  cancelEditButton.classList.add("hidden");
  formError.textContent = "";
}

function populateForm(detail) {
  document.getElementById("title").value = detail.title;
  document.getElementById("clues").value = detail.clues;
  document.getElementById("suspects").value = detail.suspects.join("\n");
  document.getElementById("locations").value = detail.locations.join("\n");
  document.getElementById("weapons").value = detail.weapons.join("\n");
  formTitle.textContent = "Edit Mystery";
  saveButton.textContent = "Update Mystery";
  cancelEditButton.classList.remove("hidden");
}

function renderDetail() {
  if (!state.detail) {
    detailEmpty.classList.remove("hidden");
    detailContent.classList.add("hidden");
    return;
  }

  detailEmpty.classList.add("hidden");
  detailContent.classList.remove("hidden");
  detailSubtitle.textContent = `Saved on ${formatDate(state.detail.createdAt)}`;

  detailTitle.textContent = state.detail.title;
  detailClues.textContent = state.detail.clues;
  fillList(detailSuspects, state.detail.suspects);
  fillList(detailLocations, state.detail.locations);
  fillList(detailWeapons, state.detail.weapons);
  renderGrid();
}

async function loadGridState(id, mode, rows, cols) {
  const res = await fetch(`/api/mysteries/${id}/grid?mode=${encodeURIComponent(mode)}`);
  if (!res.ok) return { rows, cols, cells: {} };
  const data = await res.json();
  if (data && data.rows === rows && data.cols === cols && data.cells) return data;
  return { rows, cols, cells: {} };
}

async function saveGridState(id, mode, gridState) {
  await fetch(`/api/mysteries/${id}/grid`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode,
      rows: gridState.rows,
      cols: gridState.cols,
      cells: gridState.cells
    })
  });
}

function cycleCell(state, row, col) {
  const key = `${row}:${col}`;
  const current = state.cells[key] || "unknown";
  const next = current === "unknown" ? "yes" : current === "yes" ? "no" : "unknown";
  state.cells[key] = next;
  return next;
}

async function renderGrid() {
  if (!state.detail) return;
  const rows = state.detail.suspects;
  const locations = state.detail.locations;
  const weapons = state.detail.weapons;

  const token = ++state.gridToken;
  const [locationsState, weaponsState, locWeaponsState] = await Promise.all([
    loadGridState(state.detail.id, "locations", rows.length, locations.length),
    loadGridState(state.detail.id, "weapons", rows.length, weapons.length),
    loadGridState(state.detail.id, "loc-weapons", locations.length, weapons.length)
  ]);
  if (token !== state.gridToken) return;
  state.currentGrid = {
    locations: { ...locationsState, mode: "locations", rows: rows.length, cols: locations.length },
    weapons: { ...weaponsState, mode: "weapons", rows: rows.length, cols: weapons.length },
    locWeapons: { ...locWeaponsState, mode: "loc-weapons", rows: locations.length, cols: weapons.length }
  };

  const table = document.createElement("table");
  table.className = "grid-table";

  const groupRow = document.createElement("tr");
  const groupBlank = document.createElement("th");
  groupBlank.textContent = "";
  groupRow.appendChild(groupBlank);

  const locGroup = document.createElement("th");
  locGroup.className = "group";
  locGroup.colSpan = Math.max(locations.length, 1);
  locGroup.textContent = "Locations";
  groupRow.appendChild(locGroup);

  const wepGroup = document.createElement("th");
  wepGroup.className = "group";
  wepGroup.colSpan = Math.max(weapons.length, 1);
  wepGroup.textContent = "Weapons";
  groupRow.appendChild(wepGroup);

  table.appendChild(groupRow);

  const headRow = document.createElement("tr");
  const blank = document.createElement("th");
  blank.textContent = "";
  headRow.appendChild(blank);

  locations.forEach((col, index) => {
    const th = document.createElement("th");
    th.textContent = col;
    if (index === locations.length - 1) th.classList.add("divider");
    headRow.appendChild(th);
  });

  weapons.forEach((col) => {
    const th = document.createElement("th");
    th.textContent = col;
    headRow.appendChild(th);
  });

  table.appendChild(headRow);

  rows.forEach((row, rowIndex) => {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.textContent = row;
    tr.appendChild(th);

    locations.forEach((_, colIndex) => {
      const td = document.createElement("td");
      td.dataset.mode = "locations";
      td.dataset.row = rowIndex;
      td.dataset.col = colIndex;
      const stateKey = `${rowIndex}:${colIndex}`;
      const value = state.currentGrid.locations.cells[stateKey] || "unknown";
      td.className = `grid-cell ${value}`;
      if (colIndex === locations.length - 1) td.classList.add("divider");
      td.textContent = value === "yes" ? "✔" : value === "no" ? "✕" : "?";
      td.addEventListener("click", () => {
        const next = cycleCell(state.currentGrid.locations, rowIndex, colIndex);
        td.className = `grid-cell ${next}` + (colIndex === locations.length - 1 ? " divider" : "");
        td.textContent = next === "yes" ? "✔" : next === "no" ? "✕" : "?";
        saveGridState(state.detail.id, "locations", state.currentGrid.locations);
      });
      tr.appendChild(td);
    });

    weapons.forEach((_, colIndex) => {
      const td = document.createElement("td");
      td.dataset.mode = "weapons";
      td.dataset.row = rowIndex;
      td.dataset.col = colIndex;
      const stateKey = `${rowIndex}:${colIndex}`;
      const value = state.currentGrid.weapons.cells[stateKey] || "unknown";
      td.className = `grid-cell ${value}`;
      td.textContent = value === "yes" ? "✔" : value === "no" ? "✕" : "?";
      td.addEventListener("click", () => {
        const next = cycleCell(state.currentGrid.weapons, rowIndex, colIndex);
        td.className = `grid-cell ${next}`;
        td.textContent = next === "yes" ? "✔" : next === "no" ? "✕" : "?";
        saveGridState(state.detail.id, "weapons", state.currentGrid.weapons);
      });
      tr.appendChild(td);
    });

    table.appendChild(tr);
  });

  if (locations.length > 0 && weapons.length > 0) {
    const spacer = document.createElement("tr");
    const spacerTh = document.createElement("th");
    spacerTh.textContent = "Locations × Weapons";
    spacerTh.className = "group";
    spacerTh.colSpan = 1 + locations.length + weapons.length;
    spacer.appendChild(spacerTh);
    table.appendChild(spacer);

    locations.forEach((location, rowIndex) => {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.textContent = location;
      tr.appendChild(th);

      locations.forEach((_, colIndex) => {
        const td = document.createElement("td");
        td.className = "blank";
        if (colIndex === locations.length - 1) td.classList.add("divider");
        tr.appendChild(td);
      });

      weapons.forEach((_, colIndex) => {
        const td = document.createElement("td");
        td.dataset.mode = "loc-weapons";
        td.dataset.row = rowIndex;
        td.dataset.col = colIndex;
        const stateKey = `${rowIndex}:${colIndex}`;
        const value = state.currentGrid.locWeapons.cells[stateKey] || "unknown";
        td.className = `grid-cell ${value}`;
        td.textContent = value === "yes" ? "✔" : value === "no" ? "✕" : "?";
        td.addEventListener("click", () => {
          const next = cycleCell(state.currentGrid.locWeapons, rowIndex, colIndex);
          td.className = `grid-cell ${next}`;
          td.textContent = next === "yes" ? "✔" : next === "no" ? "✕" : "?";
          saveGridState(state.detail.id, "loc-weapons", state.currentGrid.locWeapons);
        });
        tr.appendChild(td);
      });

      table.appendChild(tr);
    });
  }

  gridEl.innerHTML = "";
  if (rows.length === 0 || (locations.length === 0 && weapons.length === 0)) {
    gridEl.textContent = "Add suspects, locations, and weapons to use the grid.";
    return;
  }
  gridEl.appendChild(table);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.textContent = "";
  const payload = {
    title: document.getElementById("title").value.trim(),
    clues: document.getElementById("clues").value.trim(),
    suspects: splitLines(document.getElementById("suspects").value),
    locations: splitLines(document.getElementById("locations").value),
    weapons: splitLines(document.getElementById("weapons").value)
  };

  const url = state.editingId ? `/api/mysteries/${state.editingId}` : "/api/mysteries";
  const method = state.editingId ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data.errors ? data.errors.join(" ") : data.error || "Failed to save.";
    formError.textContent = msg;
    return;
  }

  const saved = await res.json();
  await loadMysteries();
  await loadDetail(saved.id);
  resetForm();
});

resetButton.addEventListener("click", () => {
  resetForm();
});

cancelEditButton.addEventListener("click", () => {
  resetForm();
});

editButton.addEventListener("click", () => {
  if (!state.detail) return;
  state.editingId = state.detail.id;
  populateForm(state.detail);
});

deleteButton.addEventListener("click", async () => {
  if (!state.detail) return;
  if (!confirm("Delete this mystery? This cannot be undone.")) return;
  const res = await fetch(`/api/mysteries/${state.detail.id}`, { method: "DELETE" });
  if (!res.ok) {
    alert("Failed to delete mystery.");
    return;
  }
  state.detail = null;
  state.selectedId = null;
  await loadMysteries();
  renderDetail();
});

function handleGridUpdate(payload) {
  if (!state.detail) return;
  if (payload.mysteryId !== state.detail.id) return;
  if (!state.currentGrid) return;
  if (payload.mode === "locations") {
    state.currentGrid.locations = {
      mode: "locations",
      rows: payload.rows,
      cols: payload.cols,
      cells: payload.cells || {}
    };
  } else if (payload.mode === "weapons") {
    state.currentGrid.weapons = {
      mode: "weapons",
      rows: payload.rows,
      cols: payload.cols,
      cells: payload.cells || {}
    };
  } else if (payload.mode === "loc-weapons") {
    state.currentGrid.locWeapons = {
      mode: "loc-weapons",
      rows: payload.rows,
      cols: payload.cols,
      cells: payload.cells || {}
    };
  } else {
    return;
  }

  const table = gridEl.querySelector("table");
  if (!table) return;
  const subset =
    payload.mode === "locations"
      ? state.currentGrid.locations
      : payload.mode === "weapons"
      ? state.currentGrid.weapons
      : state.currentGrid.locWeapons;
  const cells = table.querySelectorAll(`td.grid-cell[data-mode="${payload.mode}"]`);
  cells.forEach((cell) => {
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    const value = subset.cells[`${row}:${col}`] || "unknown";
    cell.className = `grid-cell ${value}` + (payload.mode === "locations" && col === subset.cols - 1 ? " divider" : "");
    cell.textContent = value === "yes" ? "✔" : value === "no" ? "✕" : "?";
  });
}

function connectWebSocket() {
  if (state.ws) state.ws.close();
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${protocol}://${window.location.host}`);
  state.ws = ws;

  ws.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload && payload.type === "grid:update") handleGridUpdate(payload);
    } catch (err) {
      // Ignore malformed messages.
    }
  };

  ws.onclose = () => {
    if (state.wsTimer) clearTimeout(state.wsTimer);
    state.wsTimer = setTimeout(connectWebSocket, 1500);
  };
}

async function init() {
  try {
    await loadMysteries();
  } catch (err) {
    listEl.textContent = "Failed to load case files.";
  }
  connectWebSocket();
}

init();
