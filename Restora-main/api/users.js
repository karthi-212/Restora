const { db, createId } = require("./db");

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  const { method } = req;

  try {
    if (method === "GET") {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const email = url.searchParams.get("email");
      
      if (email) {
        const user = await db.getUserByEmail(email);
        if (!user) {
          return sendJson(res, 404, { error: "User not found" });
        }
        
        // Remove password from response
        const { password, ...safeUser } = user;
        
        return sendJson(res, 200, {
          ...safeUser,
          favorites: user.favorites ? (typeof user.favorites === 'string' ? JSON.parse(user.favorites) : user.favorites) : [],
          createdAt: user.created_at ? user.created_at * 1000 : Date.now(),
          updatedAt: user.updated_at ? user.updated_at * 1000 : Date.now(),
        });
      }
      
      // Get all users (without passwords)
      const users = await db.getUsers();
      
      const formatted = users.map(u => {
        const { password, ...safeUser } = u;
        return {
          ...safeUser,
          favorites: u.favorites ? (typeof u.favorites === 'string' ? JSON.parse(u.favorites) : u.favorites) : [],
          createdAt: u.created_at ? u.created_at * 1000 : Date.now(),
          updatedAt: u.updated_at ? u.updated_at * 1000 : Date.now(),
        };
      });
      
      return sendJson(res, 200, formatted);
    }

    if (method === "POST") {
      const payload = await parseBody(req);
      const { email, password, name, role } = payload;
      
      if (!email || !password || !name) {
        return sendJson(res, 400, {
          error: "email, password and name are required",
        });
      }

      // Check if user exists
      const existing = await db.getUserByEmail(email);
      if (existing) {
        return sendJson(res, 409, { error: "User already exists" });
      }

      const userId = createId();
      const now = Math.floor(Date.now() / 1000);

      const user = {
        id: userId,
        email,
        password,
        name,
        role: role || "user",
        avatar_url: null,
        favorites: null,
        created_at: now,
        updated_at: now,
      };

      await db.createUser(user);
      
      // Remove password from response
      const { password: _, ...safeUser } = user;
      
      return sendJson(res, 201, {
        ...safeUser,
        favorites: [],
        createdAt: user.created_at * 1000,
        updatedAt: user.updated_at * 1000,
      });
    }

    if (method === "PATCH") {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const id = url.searchParams.get("id");
      if (!id) return sendJson(res, 400, { error: "id query parameter is required" });

      const existing = await db.getUsers();
      const user = existing.find(u => u.id === id);
      if (!user) {
        return sendJson(res, 404, { error: "User not found" });
      }

      const payload = await parseBody(req);
      const updates = {};
      
      if (payload.name !== undefined) updates.name = payload.name;
      if (payload.avatar_url !== undefined) updates.avatar_url = payload.avatar_url;
      if (payload.favorites !== undefined) {
        updates.favorites = typeof payload.favorites === 'string' ? payload.favorites : JSON.stringify(payload.favorites);
      }
      if (payload.role !== undefined) updates.role = payload.role;
      
      const updated = await db.updateUser(id, updates);
      
      // Remove password from response
      const { password: _, ...safeUser } = updated;
      
      return sendJson(res, 200, {
        ...safeUser,
        favorites: updated.favorites ? (typeof updated.favorites === 'string' ? JSON.parse(updated.favorites) : updated.favorites) : [],
        createdAt: updated.created_at * 1000,
        updatedAt: updated.updated_at * 1000,
      });
    }

    res.statusCode = 405;
    res.setHeader("Allow", "GET,POST,PATCH");
    res.end();
  } catch (error) {
    console.error("Users API error:", error);
    return sendJson(res, 500, { error: error.message || "Internal server error" });
  }
};
