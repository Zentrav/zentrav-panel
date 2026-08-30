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

// OAuth token alma
app.post("/api/token", async (req, res) => {
  try {
    const { code, code_verifier } = req.body;
    if (!code) return res.status(400).json({ error: "code yok" });

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code: code,
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

    // Kullanıcı bilgisini al
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

// Ban kaldır (unban)
app.post("/api/unban", async (req, res) => {
  try {
    const { access_token, broadcaster_user_id, user_id } = req.body;
    if (!access_token || !user_id) {
      return res.status(400).json({ error: "Eksik parametre" });
    }

    const unbanRes = await fetch("https://api.kick.com/public/v1/moderation/bans", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        broadcaster_user_id: broadcaster_user_id,
        user_id: user_id
      })
    });

    const data = await unbanRes.json();
    res.json({ success: unbanRes.ok, data });
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
