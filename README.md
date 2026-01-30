# RP Community Backend

A Node.js Express backend server for the RP Community application.

Features

- **Authentication**: JWT-based login (Student ID/Password).
- **Notes Management**: Create, read, update, and delete study notes.
- **Events API**: Manage community events.
- **Posts API**: Community forum posts.
- **Database**: Integration with MySQL for persistent storage.

Prerequisites

- **Node.js**: [Download and install Node.js](https://nodejs.org/)
- **MySQL**: Ensure you have a MySQL server running.

Installation

1.  **Clone the repository** (if applicable) or navigate to the project directory:
    ```bash
    cd rpcommunity_backend
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

## Usage

**Start the server:**

```bash
node server.js
```

The server will start on `http://localhost:5000` (or your defined PORT).

## 📡 API Endpoints

### Authentication
- `POST /login` - Login with studentId and password.

### Notes
- `GET /notes` - Get all notes.
- `GET /notes/:id` - Get a specific note.
- `GET /mynotes` - Get notes created by the logged-in user.
- `POST /notes/add` - Create a new note (Requires Token).
- `PUT /notes/:id` - Update a note (Requires Token).
- `DELETE /notes/:id` - Delete a note (Requires Token).

### Events
- `GET /events` - Get all events.
- `POST /events` - Create an event.
- `PUT /events/:id` - Update an event.
- `DELETE /events/:id` - Delete an event.

### Posts
- `GET /posts` - Get all posts.
- `POST /posts` - Create a post.
- `PUT /posts/:id` - Update a post.
- `DELETE /posts/:id` - Delete a post.

Troubleshooting

- **`ER_BAD_NULL_ERROR`**: If you see this when adding a note, ensure your login token is valid and the `user_id` is being correctly extracted in `server.js`.
- **CORS Errors**: Ensure your frontend is running on `http://localhost:3000` or update the `allowedOrigins` in `server.js`.
