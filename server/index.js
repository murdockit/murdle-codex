const path = require("path");
const express = require("express");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3030;

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

  const errors = [];
  if (!title) errors.push("Title is required.");
  if (!clues) errors.push("Clues are required.");
  if (suspects.length === 0) errors.push("At least one suspect is required.");
  if (locations.length === 0) errors.push("At least one location is required.");
  if (weapons.length === 0) errors.push("At least one weapon is required.");

  return {
    ok: errors.length === 0,
    errors,
    data: { title, clues, suspects, locations, weapons }
  };
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
        weapons: true
      }
    });

    res.json(
      items.map((item) => ({
        id: item.id,
        title: item.title,
        createdAt: item.createdAt,
        suspectCount: Array.isArray(item.suspects) ? item.suspects.length : 0,
        locationCount: Array.isArray(item.locations) ? item.locations.length : 0,
        weaponCount: Array.isArray(item.weapons) ? item.weapons.length : 0
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

const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
