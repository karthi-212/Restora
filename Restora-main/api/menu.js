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
      const category = url.searchParams.get("category");
      const search = url.searchParams.get("search");
      
      let menu = await db.getMenu();
      
      // Filter by category
      if (category) {
        menu = menu.filter(item => item.category === category);
      }
      
      // Filter by search term
      if (search) {
        const searchLower = search.toLowerCase();
        menu = menu.filter(item => 
          item.name.toLowerCase().includes(searchLower) ||
          (item.description && item.description.toLowerCase().includes(searchLower))
        );
      }
      
      // Convert timestamps
      const formatted = menu.map(item => ({
        ...item,
        createdAt: item.created_at ? item.created_at * 1000 : Date.now(),
        updatedAt: item.updated_at ? item.updated_at * 1000 : Date.now(),
        available: item.available !== undefined ? item.available : true,
      }));
      
      return sendJson(res, 200, formatted);
    }

    if (method === "POST") {
      const payload = await parseBody(req);
      const { id, name, price, image, category, description, available } = payload;
      
      if (!name || !price) {
        return sendJson(res, 400, { error: "name and price are required" });
      }

      const itemId = id || createId();
      const now = Math.floor(Date.now() / 1000);

      const item = {
        id: itemId,
        name,
        price: Number(price),
        image: image || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=60",
        category: category || "Specials",
        description: description || null,
        available: available !== undefined ? available : true,
        created_at: now,
        updated_at: now,
      };

      await db.createMenuItem(item);
      
      return sendJson(res, 201, {
        ...item,
        createdAt: item.created_at * 1000,
        updatedAt: item.updated_at * 1000,
      });
    }

    if (method === "PUT" || method === "PATCH") {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const id = url.searchParams.get("id");
      if (!id) return sendJson(res, 400, { error: "id query parameter is required" });

      const existing = await db.getMenuItem(id);
      if (!existing) {
        return sendJson(res, 404, { error: "Menu item not found" });
      }

      const payload = await parseBody(req);
      const updates = {};
      
      if (payload.name !== undefined) updates.name = payload.name;
      if (payload.price !== undefined) updates.price = Number(payload.price);
      if (payload.image !== undefined) updates.image = payload.image;
      if (payload.category !== undefined) updates.category = payload.category;
      if (payload.description !== undefined) updates.description = payload.description;
      if (payload.available !== undefined) updates.available = payload.available;
      
      const updated = await db.updateMenuItem(id, updates);
      
      return sendJson(res, 200, {
        ...updated,
        createdAt: updated.created_at * 1000,
        updatedAt: updated.updated_at * 1000,
        available: updated.available !== undefined ? updated.available : true,
      });
    }

    if (method === "DELETE") {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const id = url.searchParams.get("id");
      if (!id) return sendJson(res, 400, { error: "id query parameter is required" });

      const existing = await db.getMenuItem(id);
      if (!existing) {
        return sendJson(res, 404, { error: "Menu item not found" });
      }

      await db.deleteMenuItem(id);
      res.statusCode = 204;
      return res.end();
    }

    res.statusCode = 405;
    res.setHeader("Allow", "GET,POST,PUT,PATCH,DELETE");
    res.end();
  } catch (error) {
    console.error("Menu API error:", error);
    return sendJson(res, 500, { error: error.message || "Internal server error" });
  }
};
