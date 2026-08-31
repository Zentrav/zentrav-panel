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

// Bellekte talepler
let appeals = [];

// Zentrav'ın ID'si (giriş yapınca dolacak)
let broadcasterUserId = null;

// ===== TALEPLER =====
app.get("/api/appeals", (req, res) => {
  res.json(appeals.filter(a => a.status === "pending"));
});

app.post("/api/appeals", (req, res) => {
  const { username, appeal } = req.body;
  if (!username) return res.status(400).json({ error: "Kullanıcı adı gerekli" });

  const exists = appeals.find(
    a => a.username.toLowerCase() === username.toLowerCase() && a.status === "pending"
  );
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
    status: "pending",
    user_id: null
  };
  appeals.unshift(newAppeal);
  res.json(newAppeal);
});

app.post("/api/appeals/:id", (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  const item = appeals.find(a => a.id === id);
  if (!item) return res.status(404).json({ error: "Bulunamadı" });
  item.status = status;
  res.json(item);
});

// ===== OAUTH TOKEN =====
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
    if (!tokenRes.ok) {
      return res.status(400).json({ error: "Token alınamadı", details: tokenData });
    }

    // Giriş yapan kullanıcı bilgisi
    const userRes = await fetch("https://api.kick.com/public/v1/users", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json();
    const user = userData.data?.[0] || userData;

    // Eğer Zentrav ise broadcaster ID'yi kaydet
    const name = (user.name || user.username || "").toLowerCase();
    if (name === "zentrav" && user.user_id) {
      broadcasterUserId = user.user_id;
    }

    res.json({
      access_token: tokenData.access_token,
      user
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== USERNAME → USER_ID BULMA (resmi olmayan yol) =====
async function findUserIdByUsername(username) {
  try {
    // Kick'in public channel endpoint'i
    const res = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(username)}`, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Bazı yapılarda user_id veya id gelir
    return data?.user_id || data?.user?.id || data?.id || null;
  } catch {
    return null;
  }
}

// ===== GERÇEK UNBAN =====
app.post("/api/unban", async (req, res) => {
  try {
    const { access_token, username, appeal_id } = req.body;
    if (!access_token || !username) {
      return res.status(400).json({ error: "Eksik bilgi" });
    }

    if (!broadcasterUserId) {
      return res.status(400).json({
        error: "Önce Zentrav hesabıyla giriş yapmalısın (broadcaster ID yok)"
      });
    }

    // Username'den user_id bul
    let userId = await findUserIdByUsername(username);
    if (!userId) {
      return res.status(400).json({
        error: "Kullanıcı ID bulunamadı. Kick kullanıcı adını doğru yazdığından emin ol."
      });
    }

    // Gerçek unban isteği
    const unbanRes = await fetch("https://api.kick.com/public/v1/moderation/bans", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        broadcaster_user_id: Number(broadcasterUserId),
        user_id: Number(userId)
      })
    });

    const data = await unbanRes.json().catch(() => ({}));

    if (!unbanRes.ok) {
      return res.status(unbanRes.status).json({
        error: "Kick unban başarısız",
        details: data
      });
    }

    // Talebi listeden kaldır
    if (appeal_id) {
      const item = appeals.find(a => a.id === Number(appeal_id));
      if (item) item.status = "unbanned";
    }

    res.json({
      success: true,
      message: username + " banı kaldırıldı",
      user_id: userId,
      data
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
