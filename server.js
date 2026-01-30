let env_set = require("dotenv");
env_set.config();

const mysql = require("mysql2/promise");
let express = require("express");
let cors = require("cors");
let jwt = require("jsonwebtoken");
let app = express();
app.use(express.json());


const allowedOrigins = new Set([
  "http://localhost:3000",
  "https://monumental-gaufre-ed6370.netlify.app",
]);

app.use(
  cors({
    origin: (origin, cb) => {
      
      if (!origin) {
        cb(null, true);
        return;
      }

      if (allowedOrigins.has(origin)) {
        cb(null, true);
        return;
      }

      cb(new Error("CORS blocked for origin: " + origin), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);


app.options("*", cors());

const DEMO_USER = { user_id: "1", username: "24041225", password: "apple123" };

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Create connection pool with error handling
const pool = mysql.createPool(dbConfig);

const verifyToken = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({ error: "Authorization header missing" });
  }

  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ error: "Invalid Authorization format" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = decoded;
    next();
  });
};

//login
app.post("/login", async (req, res) => {
  const { studentId, password } = req.body;

  if (!studentId || !password) {
    return res.status(400).send("Student ID and password are required");
  }

  // Check against demo user
  if (studentId === DEMO_USER.username && password === DEMO_USER.password) {
    const token = jwt.sign(
      { user_id: DEMO_USER.user_id, id: DEMO_USER.user_id, username: DEMO_USER.username },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );
    return res.json({ token, user_id: DEMO_USER.user_id });
  }

  // For real users, check the database
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      "SELECT * FROM Users WHERE user_id = ?",
      [studentId],
    );
    connection.release();

    if (rows.length === 0) {
      return res.status(401).send("Student not found");
    }

    const user = rows[0];

    // Match plain text password (no bcrypt)
    if (user.password !== password) {
      return res.status(401).send("Invalid credentials");
    }

    const token = jwt.sign(
      { id: user.user_id, user_id: user.user_id, studentId: user.student_id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );
    res.json({ token, user_id: user.user_id });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

const allowedOrigins = ["http://localhost:3000"];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
};

app.use(cors(corsOptions));

//Event (Jiayi)
// GET all events
app.get("/events", async (req, res) => {
  let conn;
  try {
    console.log("Attempting to get connection from pool for /events");
    conn = await pool.getConnection();
    console.log("Connection acquired, executing query");
    const [rows] = await conn.execute("SELECT * FROM events");
    console.log("Query executed successfully, returning results");
    res.json(rows);
  } catch (err) {
    console.error("Error in /events:", err.message);
    res.status(500).json({ message: "Failed to fetch events", error: err.message });
  } finally {
    if (conn) {
      console.log("Releasing connection");
      conn.release();
    }
  }
});

app.get("/events/:id", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.execute(
      "SELECT * FROM events WHERE event_id = ?",
      [req.params.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch event" });
  } finally {
    if (conn) conn.release();
  }
});

app.post("/events", verifyToken, async (req, res) => {
  const { title, description, event_date, event_time, location } = req.body;

  let creator_id = req.user.id;

  if (!title || !event_date || !event_time) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.execute(
      `INSERT INTO events (title, description, event_date, event_time, location, creator_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, description, event_date, event_time, location, creator_id],
    );

    res.status(201).json({ message: "Event added successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add event" });
  } finally {
    if (conn) conn.release();
  }
});

app.put("/events/:id", verifyToken, async (req, res) => {
  const { title, description, event_date, event_time, location } = req.body;

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.execute(
      `UPDATE events
       SET title = ?, description = ?, event_date = ?, event_time = ?, location = ?
       WHERE event_id = ?`,
      [title, description, event_date, event_time, location, req.params.id],
    );

    res.json({ message: "Event updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update event" });
  } finally {
    if (conn) conn.release();
  }
});

app.delete("/events/:id", verifyToken, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.execute("DELETE FROM events WHERE event_id = ?", [
      req.params.id,
    ]);

    res.json({ message: "Event deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete event" });
  } finally {
    if (conn) conn.release();
  }
});


app.get("/posts", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const query = `
      SELECT Posts.*, Users.username, Users.school, Users.diploma 
      FROM Posts 
      JOIN Users ON Posts.user_id = Users.user_id 
      ORDER BY Posts.created_at DESC
    `;
    const [rows] = await conn.execute(query);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch posts" });
  } finally {
    if (conn) conn.release();
  }
});

app.get("/posts/:id", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const query = `
      SELECT Posts.*, Users.username, Users.school 
      FROM Posts 
      JOIN Users ON Posts.user_id = Users.user_id 
      WHERE post_id = ?
    `;
    const [rows] = await conn.execute(query, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch post" });
  } finally {
    if (conn) conn.release();
  }
});

app.post("/posts", verifyToken, async (req, res) => {
  const { title, content, category } = req.body;
  const user_id = req.user.user_id;

  if (!content) {
    return res.status(400).json({ message: "Content is required" });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    const query = `INSERT INTO Posts (user_id, title, content, category) VALUES (?, ?, ?, ?)`;
    const [result] = await conn.execute(query, [user_id, title, content, category]);

    res.status(201).json({
      message: "Post created successfully",
      post_id: result.insertId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create post" });
  } finally {
    if (conn) conn.release();
  }
});

app.put("/posts/:id", verifyToken, async (req, res) => {
  const { title, content, category } = req.body;

  let conn;
  try {
    conn = await pool.getConnection();
    const query = `UPDATE Posts SET title = ?, content = ?, category = ? WHERE post_id = ?`;
    const [result] = await conn.execute(query, [title, content, category, req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.json({ message: "Post updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update post" });
  } finally {
    if (conn) conn.release();
  }
});

app.delete("/posts/:id", verifyToken, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [result] = await conn.execute("DELETE FROM Posts WHERE post_id = ?", [
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete post" });
  } finally {
    if (conn) conn.release();
  }
});

//all notes, kaelynn
app.get("/mynotes", verifyToken, async (req, res) => {
  const userId = req.user.username;
  const { created_at, updated_at } = req.query;

  let conn;
  try {
    conn = await pool.getConnection();
    let query = "SELECT notes.*, Users.username FROM notes JOIN Users ON notes.user_id = Users.user_id WHERE notes.user_id = ?";
    const params = [userId];

    if (created_at) {
      query += " AND created_at >= ?";
      params.push(created_at);
    }

    if (updated_at) {
      query += " AND updated_at <= ?";
      params.push(updated_at);
    }

    query += " ORDER BY created_at DESC";
    const [rows] = await conn.execute(query, params);
    res.json(rows);
  } catch (err) {
    console.error("Database error", err);
    res.status(500).json({ message: "Failed to fetch your notes" });
  } finally {
    if (conn) conn.release();
  }
});

app.get("/notes", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.execute("SELECT notes.*, Users.username FROM notes JOIN Users ON notes.user_id = Users.user_id ORDER BY notes.created_at DESC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch all notes" });
  } finally {
    if (conn) conn.release();
  }
});

app.get("/notes/:id", async (req, res) => {
  const { id } = req.params;

  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.execute(
      "SELECT notes.*, Users.username FROM notes JOIN Users ON notes.user_id = Users.user_id WHERE notes.note_id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Note not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    if (conn) conn.release();
  }
});
app.post("/notes/add", verifyToken, async (req, res) => {
  const { title, description, content, pdf_url, school_of, diploma } = req.body;
  const user_id = req.user.username;

  if (!user_id) {
    return res.status(400).json({ error: "User ID not found in token" });
  }

  if (!title || !description || !school_of || !diploma) {
    return res.status(400).json({ error: "Title, description, school_of, and diploma are required" });
  }

  if (!content && !pdf_url) {
    return res.status(400).json({ error: "Content or PDF URL is required" });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    const [result] = await conn.execute(
      "INSERT INTO notes (user_id, title, description, content, pdf_url, school_of, diploma) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [user_id, title, description, content, pdf_url, school_of, diploma]
    );

    res.status(201).json({
      message: "Note added successfully",
      note_id: result.insertId
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: "Error adding note", details: err.message });
  } finally {
    if (conn) conn.release();
  }
});



app.put("/notes/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { user_id, title, description, content, pdf_url, school_of, diploma } = req.body;

  if (!title || !description || !school_of || !diploma) {
    return res.status(400).send("Title, description, school_of, and diploma are required");
  }

  if (!content && !pdf_url) {
    return res.status(400).send("Content or PDF URL is required");
  }

  let conn;
  try {
    conn = await pool.getConnection();
    const [result] = await conn.execute(
      "UPDATE notes SET title = ?, description = ?, content = ?, pdf_url = ?, school_of = ?, diploma = ? WHERE note_id = ? AND user_id = ?",
      [title, description, content, pdf_url, school_of, diploma, id, user_id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).send("Note not found or you don't have permission to edit it");
    }

    res.json({ message: "Note updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating note");
  } finally {
    if (conn) conn.release();
  }
});

app.delete("/notes/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.user_id || req.user.id;

  let conn;
  try {
    conn = await pool.getConnection();
    const [result] = await conn.execute(
      "DELETE FROM notes WHERE note_id = ? AND user_id = ?",
      [id, userId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).send("Note not found or you don't have permission to delete it");
    }

    res.json({ message: "Note deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting note");
  } finally {
    if (conn) conn.release();
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log("Server running on port " + port);
});
