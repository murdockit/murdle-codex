const http = require("http");
const path = require("path");
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { WebSocketServer } = require("ws");

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3030;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json({ limit: "1mb" }));

function sanitizeList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function validatePayload(body) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const clues = typeof body.clues === "string" ? body.clues.trim() : "";
  const suspects = sanitizeList(body.suspects);
  const locations = sanitizeList(body.locations);
  const weapons = sanitizeList(body.weapons);
  const tags = sanitizeList(body.tags);
  const solutionTbd = Boolean(body.solutionTbd);
  const solutionSuspect =
    typeof body.solutionSuspect === "string" ? body.solutionSuspect.trim() : "";
  const solutionLocation =
    typeof body.solutionLocation === "string" ? body.solutionLocation.trim() : "";
  const solutionWeapon =
    typeof body.solutionWeapon === "string" ? body.solutionWeapon.trim() : "";

  const errors = [];
  if (!title) errors.push("Title is required.");
  if (!clues) errors.push("Clues are required.");
  if (suspects.length === 0) errors.push("At least one suspect is required.");
  if (locations.length === 0) errors.push("At least one location is required.");
  if (weapons.length === 0) errors.push("At least one weapon is required.");
  if (!solutionTbd && solutionSuspect && !suspects.includes(solutionSuspect)) {
    errors.push("Solution suspect must match a suspect.");
  }
  if (!solutionTbd && solutionLocation && !locations.includes(solutionLocation)) {
    errors.push("Solution location must match a location.");
  }
  if (!solutionTbd && solutionWeapon && !weapons.includes(solutionWeapon)) {
    errors.push("Solution weapon must match a weapon.");
  }

  return {
    ok: errors.length === 0,
    errors,
    data: {
      title,
      clues,
      suspects,
      locations,
      weapons,
      tags,
      solutionTbd,
      solutionSuspect: solutionTbd ? null : solutionSuspect,
      solutionLocation: solutionTbd ? null : solutionLocation,
      solutionWeapon: solutionTbd ? null : solutionWeapon
    }
  };
}

function validateGridPayload(body) {
  const mode = typeof body.mode === "string" ? body.mode.trim() : "";
  const rows = Number.isInteger(body.rows) ? body.rows : Number(body.rows);
  const cols = Number.isInteger(body.cols) ? body.cols : Number(body.cols);
  const cells = body.cells && typeof body.cells === "object" ? body.cells : null;

  const errors = [];
  if (!mode) errors.push("Mode is required.");
  if (!Number.isInteger(rows) || rows < 0) errors.push("Rows must be a non-negative integer.");
  if (!Number.isInteger(cols) || cols < 0) errors.push("Cols must be a non-negative integer.");
  if (!cells) errors.push("Cells payload is required.");

  return {
    ok: errors.length === 0,
    errors,
    data: { mode, rows, cols, cells }
  };
}

function validateDraftPayload(body) {
  const data = body && typeof body === "object" ? body : {};
  const title = typeof data.title === "string" ? data.title : "";
  const clues = typeof data.clues === "string" ? data.clues : "";
  const suspects = typeof data.suspects === "string" ? data.suspects : "";
  const locations = typeof data.locations === "string" ? data.locations : "";
  const weapons = typeof data.weapons === "string" ? data.weapons : "";
  const tags = typeof data.tags === "string" ? data.tags : "";
  const solutionTbd = Boolean(data.solutionTbd);
  const solutionSuspect =
    typeof data.solutionSuspect === "string" ? data.solutionSuspect : "";
  const solutionLocation =
    typeof data.solutionLocation === "string" ? data.solutionLocation : "";
  const solutionWeapon =
    typeof data.solutionWeapon === "string" ? data.solutionWeapon : "";

  return {
    ok: true,
    data: {
      title,
      clues,
      suspects,
      locations,
      weapons,
      tags,
      solutionTbd,
      solutionSuspect,
      solutionLocation,
      solutionWeapon
    }
  };
}

function validateChecklistPayload(body) {
  const items = Array.isArray(body.items) ? body.items : [];
  const normalized = items.map((item) => ({
    text: typeof item.text === "string" ? item.text : "",
    done: Boolean(item.done),
    note: typeof item.note === "string" ? item.note : ""
  }));
  return { ok: true, data: normalized };
}

app.get("/api/mysteries", async (req, res) => {
  try {
    const items = await prisma.mystery.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        suspects: true,
        locations: true,
        weapons: true,
        tags: true,
        solutionTbd: true
      }
    });

    res.json(
      items.map((item) => ({
        id: item.id,
        title: item.title,
        createdAt: item.createdAt,
        suspectCount: Array.isArray(item.suspects) ? item.suspects.length : 0,
        locationCount: Array.isArray(item.locations) ? item.locations.length : 0,
        weaponCount: Array.isArray(item.weapons) ? item.weapons.length : 0,
        tags: item.tags || [],
        solutionTbd: Boolean(item.solutionTbd)
      }))
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to load mysteries." });
  }
});

app.get("/api/mysteries/:id", async (req, res) => {
  try {
    const item = await prisma.mystery.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: "Not found." });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: "Failed to load mystery." });
  }
});

app.post("/api/mysteries", async (req, res) => {
  const validation = validatePayload(req.body);
  if (!validation.ok) return res.status(400).json({ errors: validation.errors });

  try {
    const created = await prisma.mystery.create({ data: validation.data });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: "Failed to create mystery." });
  }
});

app.put("/api/mysteries/:id", async (req, res) => {
  const validation = validatePayload(req.body);
  if (!validation.ok) return res.status(400).json({ errors: validation.errors });

  try {
    const updated = await prisma.mystery.update({
      where: { id: req.params.id },
      data: validation.data
    });
    await prisma.mysteryDraft.deleteMany({ where: { mysteryId: req.params.id } });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update mystery." });
  }
});

app.delete("/api/mysteries/:id", async (req, res) => {
  try {
    await prisma.mystery.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete mystery." });
  }
});

app.get("/api/mysteries/:id/draft", async (req, res) => {
  try {
    const draft = await prisma.mysteryDraft.findUnique({
      where: { mysteryId: req.params.id }
    });
    if (!draft) return res.json({ data: null, updatedAt: null });
    res.json({ data: draft.data, updatedAt: draft.updatedAt });
  } catch (err) {
    res.status(500).json({ error: "Failed to load draft." });
  }
});

app.put("/api/mysteries/:id/draft", async (req, res) => {
  const validation = validateDraftPayload(req.body);
  if (!validation.ok) return res.status(400).json({ errors: ["Invalid draft payload."] });

  try {
    const saved = await prisma.mysteryDraft.upsert({
      where: { mysteryId: req.params.id },
      update: { data: validation.data },
      create: { mysteryId: req.params.id, data: validation.data }
    });
    res.json({ data: saved.data, updatedAt: saved.updatedAt });
  } catch (err) {
    res.status(500).json({ error: "Failed to save draft." });
  }
});

app.get("/api/mysteries/:id/checklist", async (req, res) => {
  try {
    const checklist = await prisma.clueChecklist.findUnique({
      where: { mysteryId: req.params.id }
    });
    if (!checklist) return res.json({ items: [], updatedAt: null });
    res.json({ items: checklist.items, updatedAt: checklist.updatedAt });
  } catch (err) {
    res.status(500).json({ error: "Failed to load checklist." });
  }
});

app.put("/api/mysteries/:id/checklist", async (req, res) => {
  const validation = validateChecklistPayload(req.body);
  if (!validation.ok) return res.status(400).json({ errors: ["Invalid checklist payload."] });

  try {
    const saved = await prisma.clueChecklist.upsert({
      where: { mysteryId: req.params.id },
      update: { items: validation.data },
      create: { mysteryId: req.params.id, items: validation.data }
    });
    res.json({ items: saved.items, updatedAt: saved.updatedAt });
  } catch (err) {
    res.status(500).json({ error: "Failed to save checklist." });
  }
});

app.get("/api/mysteries/:id/grid", async (req, res) => {
  const mode = typeof req.query.mode === "string" ? req.query.mode.trim() : "";
  if (!mode) return res.status(400).json({ error: "Mode is required." });

  try {
    const grid = await prisma.gridState.findUnique({
      where: { mysteryId_mode: { mysteryId: req.params.id, mode } }
    });
    if (!grid) return res.json({ rows: 0, cols: 0, cells: {} });
    res.json({ rows: grid.rows, cols: grid.cols, cells: grid.cells });
  } catch (err) {
    res.status(500).json({ error: "Failed to load grid state." });
  }
});

app.post("/api/mysteries/:id/grid", async (req, res) => {
  const validation = validateGridPayload(req.body);
  if (!validation.ok) return res.status(400).json({ errors: validation.errors });

  try {
    const saved = await prisma.gridState.upsert({
      where: { mysteryId_mode: { mysteryId: req.params.id, mode: validation.data.mode } },
      update: {
        rows: validation.data.rows,
        cols: validation.data.cols,
        cells: validation.data.cells
      },
      create: {
        mysteryId: req.params.id,
        mode: validation.data.mode,
        rows: validation.data.rows,
        cols: validation.data.cols,
        cells: validation.data.cells
      }
    });
    const payload = {
      type: "grid:update",
      mysteryId: req.params.id,
      mode: validation.data.mode,
      rows: saved.rows,
      cols: saved.cols,
      cells: saved.cells
    };
    const message = JSON.stringify(payload);
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
    res.json({ rows: saved.rows, cols: saved.cols, cells: saved.cells });
  } catch (err) {
    res.status(500).json({ error: "Failed to save grid state." });
  }
});

const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
