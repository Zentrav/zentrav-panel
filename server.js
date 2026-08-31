const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = "01M170XMJP255VZW7RK3JM8V5B";
const CLIENT_SECRET = "7964256469ff8951a0739e64d872f55dc2c6c6c5a66336874cb1a237078eac3c";
const REDIRECT_URI = "https://spirited-flow-production-b791.up.railway.app/";
const CHANNEL = "zentrav";

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

let appeals = [];
let broadcasterUserId = null;
let lastAccessToken = null;

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

// ===== OAUTH =====
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

    lastAccessToken = tokenData.access_token;

    const userRes = await fetch("https://api.kick.com/public/v1/users", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json();
    const user = userData.data?.[0] || userData;

    const name = (user.name || user.username || "").toLowerCase();
    if (name === "zentrav" && user.user_id) {
      broadcasterUserId = user.user_id;
    }

    res.json({ access_token: tokenData.access_token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== RESMİ OLMAYAN: BANLI LİSTESİ =====
app.get("/api/banned-users", async (req, res) => {
  const results = { tried: [], users: [], error: null };

  const endpoints = [
    `https://kick.com/api/v2/channels/${CHANNEL}/bans`,
    `https://kick.com/api/v1/channels/${CHANNEL}/banned-users`,
    `https://kick.com/api/v2/channels/${CHANNEL}/banned-users`
  ];

  const headersList = [
    {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Authorization: lastAccessToken ? `Bearer ${lastAccessToken}` : undefined
    },
    {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
  ];

  for (const url of endpoints) {
    for (const headers of headersList) {
      const cleanHeaders = Object.fromEntries(
        Object.entries(headers).filter(([, v]) => v !== undefined)
      );
      try {
        const r = await fetch(url, { headers: cleanHeaders });
        results.tried.push({ url, status: r.status });
        if (!r.ok) continue;

        const data = await r.json();
        // Farklı cevap formatlarını dene
        let list = data?.data || data?.bans || data?.users || data || [];
        if (!Array.isArray(list)) list = list?.data || [];
        if (!Array.isArray(list)) continue;

        const parsed = list.map((item, i) => {
          const username =
            item.username ||
            item.user?.username ||
            item.banned_user?.username ||
            item.slug ||
            item.name ||
            `user_${i}`;
          const userId =
            item.user_id ||
            item.user?.id ||
            item.banned_user?.id ||
            item.id ||
            null;
          return {
            id: Date.now() + i,
            username,
            user_id: userId,
            time: item.banned_at || item.created_at || "—",
            bannedBy: item.banned_by?.username || item.moderator?.username || "Zentrav",
            banDate: item.banned_at || item.created_at || new Date().toLocaleString("tr-TR"),
            banReason: item.reason || "No reason provided",
            appeal: "(Kick ban listesinden)",
            status: "pending"
          };
        }).filter(u => u.username);

        if (parsed.length) {
          results.users = parsed;
          // Mevcut taleplere ekle (yoksa)
          for (const u of parsed) {
            const exists = appeals.find(
              a => a.username.toLowerCase() === u.username.toLowerCase() && a.status === "pending"
            );
            if (!exists) appeals.unshift(u);
          }
          return res.json({ success: true, count: parsed.length, users: parsed, tried: results.tried });
        }
      } catch (e) {
        results.tried.push({ url, error: e.message });
      }
    }
  }

  res.json({
    success: false,
    message: "Ban listesi alınamadı (endpoint cookie/login istiyor olabilir)",
    tried: results.tried,
    users: []
  });
});

// Username → user_id
async function findUserIdByUsername(username) {
  try {
    const res = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(username)}`, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" }
    });
    if (!res.ok) return null;
    const data = await res.json();
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
        error: "Önce Zentrav hesabıyla giriş yap (broadcaster ID yok)"
      });
    }

    let userId = await findUserIdByUsername(username);
    if (!userId) {
      // Appeal içinde kayıtlı user_id varsa onu kullan
      const item = appeals.find(a => a.id === Number(appeal_id));
      userId = item?.user_id || null;
    }
    if (!userId) {
      return res.status(400).json({ error: "Kullanıcı ID bulunamadı" });
    }

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
      return res.status(unbanRes.status).json({ error: "Kick unban başarısız", details: data });
    }

    if (appeal_id) {
      const item = appeals.find(a => a.id === Number(appeal_id));
      if (item) item.status = "unbanned";
    }

    res.json({ success: true, message: username + " banı kaldırıldı", user_id: userId, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log("Server running on port " + PORT));
