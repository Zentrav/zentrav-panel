const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Basit ana sayfa
app.get("/", (req, res) => {
  res.send(`
    <h1>Zentrav Panel Backend Çalışıyor</h1>
    <p>Backend başarıyla ayağa kalktı.</p>
  `);
});

// Test endpoint
app.get("/api/status", (req, res) => {
  res.json({ status: "ok", message: "Zentrav backend aktif" });
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
