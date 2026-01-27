let env_set = require("dotenv");
env_set.config();

const mysql = require("mysql2/promise");
let express = require("express");
let cors = require("cors");

let app = express();
app.use(express.json());

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

//Event (Jiayi)
// GET all events
app.get("/events", async (req, res) => {
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute("SELECT * FROM events");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch events" });
  } finally {
    if (conn) await conn.end();
  }
});

// GET event by ID
app.get("/events/:id", async (req, res) => {
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);
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
    if (conn) await conn.end();
  }
});

// ADD new event
app.post("/events", async (req, res) => {
  const { title, description, event_date, event_time, location, creator_id } =
    req.body;

  if (!title || !event_date || !event_time) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);
    await conn.execute(
      `INSERT INTO events
       (title, description, event_date, event_time, location, creator_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, description, event_date, event_time, location, creator_id],
    );

    res.status(201).json({ message: "Event added successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add event" });
  } finally {
    if (conn) await conn.end();
  }
});

// UPDATE event
app.put("/events/:id", async (req, res) => {
  const { title, description, event_date, event_time, location } = req.body;

  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);
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
    if (conn) await conn.end();
  }
});

// DELETE event
app.delete("/events/:id", async (req, res) => {
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);
    await conn.execute("DELETE FROM events WHERE event_id = ?", [
      req.params.id,
    ]);

    res.json({ message: "Event deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete event" });
  } finally {
    if (conn) await conn.end();
  }
});

app.get("/posts", async (req, res) => {
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);

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
    if (conn) await conn.end();
  }
});

app.get("/posts/:id", async (req, res) => {
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);
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
    if (conn) await conn.end();
  }
});

app.post("/posts", async (req, res) => {
  const { user_id, title, content, category } = req.body;

  // Validation
  if (!user_id || !content) {
    return res
      .status(400)
      .json({ message: "User ID and Content are required" });
  }

  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);
    const query = `
      INSERT INTO Posts (user_id, title, content, category) 
      VALUES (?, ?, ?, ?)
    `;

    const [result] = await conn.execute(query, [
      user_id,
      title,
      content,
      category,
    ]);

    res.status(201).json({
      message: "Post created successfully",
      post_id: result.insertId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create post" });
  } finally {
    if (conn) await conn.end();
  }
});

app.put("/posts/:id", async (req, res) => {
  const { title, content, category } = req.body;

  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);

    const query = `
      UPDATE Posts 
      SET title = ?, content = ?, category = ? 
      WHERE post_id = ?
    `;

    const [result] = await conn.execute(query, [
      title,
      content,
      category,
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.json({ message: "Post updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update post" });
  } finally {
    if (conn) await conn.end();
  }
});

app.delete("/posts/:id", async (req, res) => {
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);

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
    if (conn) await conn.end();
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log("Server running on port " + port);
});
