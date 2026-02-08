const form = document.getElementById("mystery-form");
const formTitle = document.getElementById("form-title");
const resetButton = document.getElementById("reset-form");
const cancelEditButton = document.getElementById("cancel-edit");
const saveButton = document.getElementById("save-button");
const formError = document.getElementById("form-error");
const draftStatus = document.getElementById("draft-status");
const solutionSuspect = document.getElementById("solution-suspect");
const solutionLocation = document.getElementById("solution-location");
const solutionWeapon = document.getElementById("solution-weapon");

const listEl = document.getElementById("mystery-list");
const detailEmpty = document.getElementById("detail-empty");
const detailContent = document.getElementById("detail-content");
const detailSubtitle = document.getElementById("detail-subtitle");
const detailTitle = document.getElementById("detail-title");
const detailClues = document.getElementById("detail-clues");
const detailTags = document.getElementById("detail-tags");
const checklistEl = document.getElementById("clue-checklist");
const detailSuspects = document.getElementById("detail-suspects");
const detailLocations = document.getElementById("detail-locations");
const detailWeapons = document.getElementById("detail-weapons");
const detailSolution = document.getElementById("detail-solution");
const editButton = document.getElementById("edit-mystery");
const cloneButton = document.getElementById("clone-mystery");
const deleteButton = document.getElementById("delete-mystery");
const gridEl = document.getElementById("logic-grid");
const gridToolbar = document.querySelector(".grid-toolbar");
const gridShell = document.querySelector(".grid-shell");
const fullscreenButton = document.getElementById("grid-fullscreen");

const summaryCount = document.getElementById("mystery-count");
const summaryUpdated = document.getElementById("last-updated");

const state = {
  mysteries: [],
  selectedId: null,
  detail: null,
  editingId: null,
  gridToken: 0,
  currentGrid: {
    weaponsSuspects: null,
    weaponsLocations: null,
    locationsSuspects: null
  },
  ws: null,
  wsTimer: null,
  activeTool: "unknown",
  isDragging: false,
  dragValue: "unknown",
  pendingSaves: new Set(),
  saveTimer: null,
  draftTimer: null,
  checklistTimer: null,
  checklistItems: []
};

const DRAFT_KEY = "mystery-draft-v1";
const SERVER_DRAFT_DEBOUNCE = 500;
const CHECKLIST_DEBOUNCE = 400;

function splitLines(value) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function splitClues(value) {
  return value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function buildSelectOptions(select, items, currentValue) {
  select.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "Select...";
  select.appendChild(empty);

  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    select.appendChild(option);
  });

  if (currentValue && items.includes(currentValue)) {
    select.value = currentValue;
  } else if (items.length > 0) {
    select.value = items[0];
  } else {
    select.value = "";
  }
}

function syncSolutionSelectors(detail) {
  const suspects = splitLines(document.getElementById("suspects").value);
  const locations = splitLines(document.getElementById("locations").value);
  const weapons = splitLines(document.getElementById("weapons").value);
  buildSelectOptions(solutionSuspect, suspects, detail?.solutionSuspect || solutionSuspect.value);
  buildSelectOptions(solutionLocation, locations, detail?.solutionLocation || solutionLocation.value);
  buildSelectOptions(solutionWeapon, weapons, detail?.solutionWeapon || solutionWeapon.value);
}

function makeToken(text, type) {
  const wrap = document.createElement("div");
  const token = document.createElement("div");
  token.className = `token ${type}`;
  token.textContent = text
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
  token.title = text;

  const label = document.createElement("span");
  label.className = "token-label";
  label.textContent = text.length > 12 ? `${text.slice(0, 12)}…` : text;

  wrap.appendChild(token);
  wrap.appendChild(label);
  return wrap;
}

function setDraftStatus(message, isSaved) {
  if (!draftStatus) return;
  draftStatus.textContent = message || "";
  draftStatus.classList.toggle("saved", Boolean(isSaved));
}

async function loadServerDraft(id) {
  const res = await fetch(`/api/mysteries/${id}/draft`);
  if (!res.ok) return null;
  return res.json();
}

async function saveServerDraft(id, data) {
  const res = await fetch(`/api/mysteries/${id}/draft`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) return null;
  return res.json();
}

function getDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function saveDraft(data) {
  localStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({ ...data, savedAt: new Date().toISOString() })
  );
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
  setDraftStatus("");
}

function collectDraftData() {
  return {
    title: document.getElementById("title").value.trim(),
    clues: document.getElementById("clues").value.trim(),
    suspects: document.getElementById("suspects").value,
    locations: document.getElementById("locations").value,
    weapons: document.getElementById("weapons").value,
    tags: document.getElementById("tags").value,
    solutionSuspect: solutionSuspect.value,
    solutionLocation: solutionLocation.value,
    solutionWeapon: solutionWeapon.value
  };
}

function applyDraft(draft) {
  if (!draft) return;
  document.getElementById("title").value = draft.title || "";
  document.getElementById("clues").value = draft.clues || "";
  document.getElementById("suspects").value = draft.suspects || "";
  document.getElementById("locations").value = draft.locations || "";
  document.getElementById("weapons").value = draft.weapons || "";
  document.getElementById("tags").value = draft.tags || "";
  syncSolutionSelectors({
    solutionSuspect: draft.solutionSuspect || "",
    solutionLocation: draft.solutionLocation || "",
    solutionWeapon: draft.solutionWeapon || ""
  });
  if (draft.savedAt) {
    setDraftStatus(`Draft saved ${formatDate(draft.savedAt)}`, true);
  } else {
    setDraftStatus("Draft restored", true);
  }
}

function applyServerDraft(payload) {
  if (!payload || !payload.data) return;
  applyDraft(payload.data);
  if (payload.updatedAt) {
    setDraftStatus(`Draft saved ${formatDate(payload.updatedAt)}`, true);
  } else {
    setDraftStatus("Draft restored", true);
  }
}

function scheduleDraftSave() {
  if (state.draftTimer) clearTimeout(state.draftTimer);
  if (state.editingId) {
    state.draftTimer = setTimeout(async () => {
      const data = collectDraftData();
      setDraftStatus("Syncing draft...");
      const saved = await saveServerDraft(state.editingId, data);
      if (saved && saved.updatedAt) {
        setDraftStatus(`Draft saved ${formatDate(saved.updatedAt)}`, true);
      } else {
        setDraftStatus("Draft saved", true);
      }
    }, SERVER_DRAFT_DEBOUNCE);
    return;
  }
  if (state.draftTimer) clearTimeout(state.draftTimer);
  state.draftTimer = setTimeout(() => {
    const data = collectDraftData();
    const hasContent =
      data.title ||
      data.clues ||
      data.suspects.trim() ||
      data.locations.trim() ||
      data.weapons.trim();
    if (!hasContent) {
      clearDraft();
      return;
    }
    saveDraft(data);
    setDraftStatus("Draft saved", true);
  }, 400);
}

async function loadChecklist(id) {
  const res = await fetch(`/api/mysteries/${id}/checklist`);
  if (!res.ok) return { items: [], updatedAt: null };
  return res.json();
}

async function saveChecklist(id, items) {
  const res = await fetch(`/api/mysteries/${id}/checklist`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items })
  });
  if (!res.ok) return null;
  return res.json();
}

function reconcileChecklist(clueLines, savedItems) {
  const map = new Map();
  savedItems.forEach((item) => {
    if (item && typeof item.text === "string") {
      map.set(item.text, { done: Boolean(item.done), note: item.note || "" });
    }
  });
  return clueLines.map((text) => ({
    text,
    done: map.get(text)?.done || false,
    note: map.get(text)?.note || ""
  }));
}

function renderChecklist() {
  if (!checklistEl) return;
  checklistEl.innerHTML = "";
  if (state.checklistItems.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No clues listed yet.";
    checklistEl.appendChild(empty);
    return;
  }

  state.checklistItems.forEach((item, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "checklist-item";

    const row = document.createElement("div");
    row.className = "checklist-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.done;
    checkbox.addEventListener("change", () => {
      state.checklistItems[index].done = checkbox.checked;
      scheduleChecklistSave();
    });

    const text = document.createElement("div");
    text.className = "checklist-text";
    text.textContent = item.text;

    row.appendChild(checkbox);
    row.appendChild(text);

    const note = document.createElement("input");
    note.className = "checklist-note";
    note.type = "text";
    note.placeholder = "Add note...";
    note.value = item.note || "";
    note.addEventListener("input", () => {
      state.checklistItems[index].note = note.value;
      scheduleChecklistSave();
    });

    wrapper.appendChild(row);
    wrapper.appendChild(note);
    checklistEl.appendChild(wrapper);
  });
}

function scheduleChecklistSave() {
  if (!state.detail) return;
  if (state.checklistTimer) clearTimeout(state.checklistTimer);
  state.checklistTimer = setTimeout(() => {
    saveChecklist(state.detail.id, state.checklistItems);
  }, CHECKLIST_DEBOUNCE);
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
  const checklistPayload = await loadChecklist(id);
  const clueLines = splitClues(state.detail.clues);
  state.checklistItems = reconcileChecklist(clueLines, checklistPayload.items || []);
  renderChecklist();
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

    const tags = document.createElement("div");
    tags.className = "tag-row";
    if (Array.isArray(item.tags)) {
      item.tags.forEach((tag) => {
        const chip = document.createElement("div");
        chip.className = "tag-chip";
        chip.textContent = tag;
        tags.appendChild(chip);
      });
    }

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const viewBtn = document.createElement("button");
    viewBtn.className = "ghost";
    viewBtn.textContent = "View";
    viewBtn.addEventListener("click", () => loadDetail(item.id));

    const cloneBtn = document.createElement("button");
    cloneBtn.className = "ghost";
    cloneBtn.textContent = "Clone";
    cloneBtn.addEventListener("click", () => cloneMystery(item.id));

    actions.appendChild(viewBtn);
    actions.appendChild(cloneBtn);

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(time);
    if (tags.childElementCount > 0) card.appendChild(tags);
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
  syncSolutionSelectors(null);
  clearDraft();
}

function populateForm(detail) {
  document.getElementById("title").value = detail.title;
  document.getElementById("clues").value = detail.clues;
  document.getElementById("suspects").value = detail.suspects.join("\n");
  document.getElementById("locations").value = detail.locations.join("\n");
  document.getElementById("weapons").value = detail.weapons.join("\n");
  document.getElementById("tags").value = (detail.tags || []).join(", ");
  syncSolutionSelectors(detail);
  formTitle.textContent = "Edit Mystery";
  saveButton.textContent = "Update Mystery";
  cancelEditButton.classList.remove("hidden");
  setDraftStatus("");
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
  detailTags.innerHTML = "";
  if (Array.isArray(state.detail.tags)) {
    state.detail.tags.forEach((tag) => {
      const chip = document.createElement("div");
      chip.className = "tag-chip";
      chip.textContent = tag;
      detailTags.appendChild(chip);
    });
  }
  fillList(detailSuspects, state.detail.suspects);
  fillList(detailLocations, state.detail.locations);
  fillList(detailWeapons, state.detail.weapons);
  detailSolution.innerHTML = "";
  ["solutionSuspect", "solutionLocation", "solutionWeapon"].forEach((key) => {
    const value = state.detail[key];
    if (!value) return;
    const chip = document.createElement("div");
    chip.className = "solution-chip";
    chip.textContent = value;
    detailSolution.appendChild(chip);
  });
  renderChecklist();
  renderGrid();
}

async function loadGridState(id, mode, rows, cols) {
  const res = await fetch(`/api/mysteries/${id}/grid?mode=${encodeURIComponent(mode)}`);
  if (!res.ok) return { rows, cols, cells: {} };
  const data = await res.json();
  if (data && data.rows === rows && data.cols === cols && data.cells) return data;
  return { rows, cols, cells: {} };
}

async function cloneMystery(id) {
  const res = await fetch(`/api/mysteries/${id}`);
  if (!res.ok) {
    alert("Failed to load mystery to clone.");
    return;
  }
  const data = await res.json();
  const payload = {
    title: `Copy of ${data.title}`,
    clues: data.clues,
    suspects: data.suspects,
    locations: data.locations,
    weapons: data.weapons,
    tags: data.tags || [],
    solutionSuspect: data.solutionSuspect,
    solutionLocation: data.solutionLocation,
    solutionWeapon: data.solutionWeapon
  };
  const createRes = await fetch("/api/mysteries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!createRes.ok) {
    alert("Failed to clone mystery.");
    return;
  }
  const created = await createRes.json();
  await loadMysteries();
  await loadDetail(created.id);
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

function toolToValue(tool) {
  if (tool === "erase") return "unknown";
  return tool;
}

function updateToolbarActive() {
  if (!gridToolbar) return;
  gridToolbar.querySelectorAll(".tool-button").forEach((button) => {
    const isActive = button.dataset.tool === state.activeTool;
    button.classList.toggle("active", isActive);
  });
}

function setFullscreen(enabled) {
  if (!gridShell) return;
  gridShell.classList.toggle("fullscreen", enabled);
  if (fullscreenButton) {
    fullscreenButton.textContent = enabled ? "Exit Fullscreen" : "Fullscreen";
  }
  document.body.style.overflow = enabled ? "hidden" : "";
}

function scheduleGridSave() {
  if (state.saveTimer) clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    state.pendingSaves.forEach((mode) => {
      const gridState =
        mode === "weapons-suspects"
          ? state.currentGrid.weaponsSuspects
          : mode === "weapons-locations"
          ? state.currentGrid.weaponsLocations
          : state.currentGrid.locationsSuspects;
      saveGridState(state.detail.id, mode, gridState);
    });
    state.pendingSaves.clear();
  }, 200);
}

function applyToolToCell(cell, rowIndex, colIndex, mode) {
  if (!state.detail || !state.currentGrid) return;
  const gridState =
    mode === "weapons-suspects"
      ? state.currentGrid.weaponsSuspects
      : mode === "weapons-locations"
      ? state.currentGrid.weaponsLocations
      : state.currentGrid.locationsSuspects;
  const nextValue = toolToValue(state.dragValue);
  const stateKey = `${rowIndex}:${colIndex}`;
  if (gridState.cells[stateKey] === nextValue) return;
  gridState.cells[stateKey] = nextValue;
  cell.className = `grid-cell ${nextValue}` + (mode === "weapons-suspects" && colIndex === gridState.cols - 1 ? " divider" : "");
  cell.textContent = nextValue === "yes" ? "✔" : nextValue === "no" ? "✕" : "?";
  state.pendingSaves.add(mode);
  scheduleGridSave();
}

async function renderGrid() {
  if (!state.detail) return;
  const suspects = state.detail.suspects;
  const locations = state.detail.locations;
  const weapons = state.detail.weapons;

  const token = ++state.gridToken;
  const [weaponsSuspectsState, weaponsLocationsState, locationsSuspectsState] = await Promise.all([
    loadGridState(state.detail.id, "weapons-suspects", weapons.length, suspects.length),
    loadGridState(state.detail.id, "weapons-locations", weapons.length, locations.length),
    loadGridState(state.detail.id, "locations-suspects", locations.length, suspects.length)
  ]);
  if (token !== state.gridToken) return;
  state.currentGrid = {
    weaponsSuspects: {
      ...weaponsSuspectsState,
      mode: "weapons-suspects",
      rows: weapons.length,
      cols: suspects.length
    },
    weaponsLocations: {
      ...weaponsLocationsState,
      mode: "weapons-locations",
      rows: weapons.length,
      cols: locations.length
    },
    locationsSuspects: {
      ...locationsSuspectsState,
      mode: "locations-suspects",
      rows: locations.length,
      cols: suspects.length
    }
  };

  const table = document.createElement("table");
  table.className = "grid-table";
  table.addEventListener("pointerleave", stopDragging);

  const groupRow = document.createElement("tr");
  const groupBlank = document.createElement("th");
  groupBlank.classList.add("sticky-left");
  groupBlank.textContent = "";
  groupRow.appendChild(groupBlank);

  const locGroup = document.createElement("th");
  locGroup.className = "group";
  locGroup.colSpan = Math.max(suspects.length, 1);
  locGroup.textContent = "Suspects";
  groupRow.appendChild(locGroup);

  const wepGroup = document.createElement("th");
  wepGroup.className = "group";
  wepGroup.colSpan = Math.max(locations.length, 1);
  wepGroup.textContent = "Locations";
  groupRow.appendChild(wepGroup);

  table.appendChild(groupRow);

  const headRow = document.createElement("tr");
  const blank = document.createElement("th");
  blank.classList.add("sticky-left");
  blank.textContent = "";
  headRow.appendChild(blank);

  suspects.forEach((col, index) => {
    const th = document.createElement("th");
    th.className = "header-token";
    th.appendChild(makeToken(col, "suspect"));
    if (index === suspects.length - 1) th.classList.add("divider");
    headRow.appendChild(th);
  });

  locations.forEach((col) => {
    const th = document.createElement("th");
    th.className = "header-token";
    th.appendChild(makeToken(col, "location"));
    headRow.appendChild(th);
  });

  table.appendChild(headRow);

  weapons.forEach((row, rowIndex) => {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.className = "header-token sticky-left";
    th.appendChild(makeToken(row, "weapon"));
    tr.appendChild(th);

    suspects.forEach((_, colIndex) => {
      const td = document.createElement("td");
      td.dataset.mode = "weapons-suspects";
      td.dataset.row = rowIndex;
      td.dataset.col = colIndex;
      const stateKey = `${rowIndex}:${colIndex}`;
      const value = state.currentGrid.weaponsSuspects.cells[stateKey] || "unknown";
      td.className = `grid-cell ${value}`;
      if (colIndex === suspects.length - 1) td.classList.add("divider");
      td.textContent = value === "yes" ? "✔" : value === "no" ? "✕" : "?";
      td.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        state.isDragging = true;
        state.dragValue = state.activeTool;
        applyToolToCell(td, rowIndex, colIndex, "weapons-suspects");
      });
      td.addEventListener("pointerenter", () => {
        if (!state.isDragging) return;
        applyToolToCell(td, rowIndex, colIndex, "weapons-suspects");
      });
      tr.appendChild(td);
    });

    locations.forEach((_, colIndex) => {
      const td = document.createElement("td");
      td.dataset.mode = "weapons-locations";
      td.dataset.row = rowIndex;
      td.dataset.col = colIndex;
      const stateKey = `${rowIndex}:${colIndex}`;
      const value = state.currentGrid.weaponsLocations.cells[stateKey] || "unknown";
      td.className = `grid-cell ${value}`;
      td.textContent = value === "yes" ? "✔" : value === "no" ? "✕" : "?";
      td.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        state.isDragging = true;
        state.dragValue = state.activeTool;
        applyToolToCell(td, rowIndex, colIndex, "weapons-locations");
      });
      td.addEventListener("pointerenter", () => {
        if (!state.isDragging) return;
        applyToolToCell(td, rowIndex, colIndex, "weapons-locations");
      });
      tr.appendChild(td);
    });

    table.appendChild(tr);
  });

  if (locations.length > 0 && suspects.length > 0) {
    const spacer = document.createElement("tr");
    const spacerTh = document.createElement("th");
    spacerTh.textContent = "Locations × Suspects";
    spacerTh.className = "group";
    spacerTh.colSpan = 1 + suspects.length + locations.length;
    spacer.appendChild(spacerTh);
    table.appendChild(spacer);

    locations.forEach((location, rowIndex) => {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.className = "header-token sticky-left";
      th.appendChild(makeToken(location, "location"));
      tr.appendChild(th);

      suspects.forEach((_, colIndex) => {
        const td = document.createElement("td");
        td.dataset.mode = "locations-suspects";
        td.dataset.row = rowIndex;
        td.dataset.col = colIndex;
        const stateKey = `${rowIndex}:${colIndex}`;
        const value = state.currentGrid.locationsSuspects.cells[stateKey] || "unknown";
        td.className = `grid-cell ${value}`;
        td.textContent = value === "yes" ? "✔" : value === "no" ? "✕" : "?";
        td.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          state.isDragging = true;
          state.dragValue = state.activeTool;
          applyToolToCell(td, rowIndex, colIndex, "locations-suspects");
        });
        td.addEventListener("pointerenter", () => {
          if (!state.isDragging) return;
          applyToolToCell(td, rowIndex, colIndex, "locations-suspects");
        });
        tr.appendChild(td);
      });

      locations.forEach((_, colIndex) => {
        const td = document.createElement("td");
        td.className = "blank";
        if (colIndex === 0) td.classList.add("divider");
        tr.appendChild(td);
      });

      table.appendChild(tr);
    });
  }

  gridEl.innerHTML = "";
  if (
    suspects.length === 0 ||
    weapons.length === 0 ||
    locations.length === 0
  ) {
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
    weapons: splitLines(document.getElementById("weapons").value),
    tags: splitLines(document.getElementById("tags").value),
    solutionSuspect: solutionSuspect.value,
    solutionLocation: solutionLocation.value,
    solutionWeapon: solutionWeapon.value
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
  clearDraft();
});

resetButton.addEventListener("click", () => {
  resetForm();
});

cancelEditButton.addEventListener("click", () => {
  resetForm();
});

editButton.addEventListener("click", async () => {
  if (!state.detail) return;
  state.editingId = state.detail.id;
  populateForm(state.detail);
  const draftPayload = await loadServerDraft(state.detail.id);
  if (draftPayload && draftPayload.data) {
    applyServerDraft(draftPayload);
  }
});

cloneButton.addEventListener("click", () => {
  if (!state.detail) return;
  cloneMystery(state.detail.id);
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
  if (payload.mode === "weapons-suspects") {
    state.currentGrid.weaponsSuspects = {
      mode: "weapons-suspects",
      rows: payload.rows,
      cols: payload.cols,
      cells: payload.cells || {}
    };
  } else if (payload.mode === "weapons-locations") {
    state.currentGrid.weaponsLocations = {
      mode: "weapons-locations",
      rows: payload.rows,
      cols: payload.cols,
      cells: payload.cells || {}
    };
  } else if (payload.mode === "locations-suspects") {
    state.currentGrid.locationsSuspects = {
      mode: "locations-suspects",
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
    payload.mode === "weapons-suspects"
      ? state.currentGrid.weaponsSuspects
      : payload.mode === "weapons-locations"
      ? state.currentGrid.weaponsLocations
      : state.currentGrid.locationsSuspects;
  const cells = table.querySelectorAll(`td.grid-cell[data-mode="${payload.mode}"]`);
  cells.forEach((cell) => {
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    const value = subset.cells[`${row}:${col}`] || "unknown";
    cell.className = `grid-cell ${value}` + (payload.mode === "weapons-suspects" && col === subset.cols - 1 ? " divider" : "");
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

function stopDragging() {
  if (!state.isDragging) return;
  state.isDragging = false;
  if (state.pendingSaves.size > 0) {
    scheduleGridSave();
  }
}

async function init() {
  try {
    await loadMysteries();
  } catch (err) {
    listEl.textContent = "Failed to load case files.";
  }
  syncSolutionSelectors(null);
  connectWebSocket();
  updateToolbarActive();
  const draft = getDraft();
  if (draft && !state.editingId) {
    applyDraft(draft);
  }
}

init();
["suspects", "locations", "weapons"].forEach((id) => {
  document.getElementById(id).addEventListener("input", () => {
    syncSolutionSelectors(null);
    scheduleDraftSave();
  });
});

["title", "clues", "tags"].forEach((id) => {
  document.getElementById(id).addEventListener("input", scheduleDraftSave);
});

[solutionSuspect, solutionLocation, solutionWeapon].forEach((select) => {
  select.addEventListener("change", scheduleDraftSave);
});

if (gridToolbar) {
  gridToolbar.addEventListener("click", (event) => {
    const button = event.target.closest(".tool-button");
    if (!button) return;
    state.activeTool = button.dataset.tool || "unknown";
    updateToolbarActive();
  });
}

if (fullscreenButton) {
  fullscreenButton.addEventListener("click", () => {
    setFullscreen(!gridShell.classList.contains("fullscreen"));
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setFullscreen(false);
});

document.addEventListener("pointerup", stopDragging);
document.addEventListener("pointercancel", stopDragging);
document.addEventListener("keyup", (event) => {
  if (["1", "2", "3", "0"].includes(event.key)) {
    if (event.key === "1") state.activeTool = "unknown";
    if (event.key === "2") state.activeTool = "yes";
    if (event.key === "3") state.activeTool = "no";
    if (event.key === "0") state.activeTool = "erase";
    updateToolbarActive();
  }
});
