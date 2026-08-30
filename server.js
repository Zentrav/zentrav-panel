const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = "01M170XMJP255VZW7RK3JM8V5B";
const CLIENT_SECRET = "7964256469ff8951a0739e64d872f55dc2c6c6c5a66336874cb1a237078eac3c";
const REDIRECT_URI = "https://spirited-flow-production-b791.up.railway.app/";

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Bellekte tutulan talepler (server yeniden başlayınca sıfırlanır)
let appeals = [];

// Tüm talepleri getir
app.get("/api/appeals", (req, res) => {
  res.json(appeals.filter(a => a.status === "pending"));
});

// Yeni talep ekle (aynı kullanıcı 1 kere)
app.post("/api/appeals", (req, res) => {
  const { username, appeal } = req.body;
  if (!username) return res.status(400).json({ error: "Kullanıcı adı gerekli" });

  const exists = appeals.find(a => a.username.toLowerCase() === username.toLowerCase() && a.status === "pending");
  if (exists) {
    return res.status(400).json({ error: "Bu kullanıcı zaten talep göndermiş" });
  }

  const newAppeal = {
    id: Date.now(),
    username: username.trim(),
    time: "Az önce",
    bannedBy: "Zentrav",
    banDate: new Date().toLocaleString("tr-TR"),
    banReason: "No reason provided",
    appeal: appeal || "Belirtilmedi",
    status: "pending"
  };
  appeals.unshift(newAppeal);
  res.json(newAppeal);
});

// Talebi güncelle (unban / reject)
app.post("/api/appeals/:id", (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  const item = appeals.find(a => a.id === id);
  if (!item) return res.status(404).json({ error: "Bulunamadı" });
  item.status = status;
  res.json(item);
});

// OAuth token
app.post("/api/token", async (req, res) => {
  try {
    const { code, code_verifier } = req.body;
    if (!code) return res.status(400).json({ error: "code yok" });

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code,
      code_verifier: code_verifier || ""
    });

    const tokenRes = await fetch("https://id.kick.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) return res.status(400).json({ error: "Token alınamadı", details: tokenData });

    const userRes = await fetch("https://api.kick.com/public/v1/users", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json();

    res.json({
      access_token: tokenData.access_token,
      user: userData.data?.[0] || userData
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log("Server running on port " + PORT));
