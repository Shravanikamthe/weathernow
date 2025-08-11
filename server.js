const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bodyParser = require("body-parser");
const path = require("path");

const User = require("./models/user");

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// --- MongoDB Connect ---
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// --- Middleware ---
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: "weathernow_secret_key",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

// --- Routes ---

// Serve static pages
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});
app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "public/signup.html"));
});
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public/login.html"));
});
app.get("/history", (req, res) => {
  res.sendFile(path.join(__dirname, "public/history.html"));
});

// --- Signup Handler ---
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) return res.send("Email already registered.");

    const user = new User({ name, email, password });
    await user.save();

    req.session.user = {
      _id: user._id,
      name: user.name,
      email: user.email
    };

    res.redirect("/");
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).send("Signup failed. Try again.");
  }
});

// --- Login Handler ---
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.send("Invalid email or password.");

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.send("Invalid email or password.");

    req.session.user = {
      _id: user._id,
      name: user.name,
      email: user.email
    };

    res.redirect("/");
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Login failed.");
  }
});

// --- Logout Handler ---
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send("Logout failed.");
    }
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

// --- Save Weather Search ---
app.post("/api/search", async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).send("Unauthorized");

    const { city, temperature } = req.body;
    const user = await User.findById(req.session.user._id);
    user.searchHistory.push({ city, temperature });
    await user.save();

    res.status(200).send("Search saved");
  } catch (err) {
    console.error("Search save error:", err);
    res.status(500).send("Failed to save search");
  }
});

// --- Get Weather Search History ---
app.get("/api/history", async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).send("Unauthorized");

    const user = await User.findById(req.session.user._id);
    const history = user.searchHistory.sort((a, b) => b.date - a.date);

    res.json(history);
  } catch (err) {
    console.error("History fetch error:", err);
    res.status(500).send("Error getting history");
  }
});

// --- Check User Login Status ---
app.get("/api/user", (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, name: req.session.user.name });
  } else {
    res.json({ loggedIn: false });
  }
});

// --- Start Server (ONLY ONCE!) ---
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
