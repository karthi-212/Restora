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
      const userId = url.searchParams.get("userId");
      const userEmail = url.searchParams.get("userEmail");
      const status = url.searchParams.get("status");
      
      let orders = await db.getOrders();
      
      // Filter by userId or userEmail
      if (userId || userEmail) {
        if (userEmail) {
          // Look up user by email first
          const user = await db.getUserByEmail(userEmail);
          if (user) {
            orders = orders.filter(o => o.user_id === user.id);
          } else {
            // User not found, return empty array
            return sendJson(res, 200, []);
          }
        } else {
          orders = orders.filter(o => o.user_id === userId);
        }
      }
      
      // Filter by status
      if (status) {
        orders = orders.filter(o => o.status === status);
      }
      
      // Sort by created_at descending
      orders.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
      
      // Parse items JSON and convert timestamps
      const formatted = orders.map(order => ({
        ...order,
        userId: order.user_id,
        items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
        createdAt: order.created_at ? order.created_at * 1000 : Date.now(),
        updatedAt: order.updated_at ? order.updated_at * 1000 : Date.now(),
      }));
      
      return sendJson(res, 200, formatted);
    }

    if (method === "POST") {
      const payload = await parseBody(req);
      const { userId, items, subtotal, tax, total, paymentMethod } = payload;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return sendJson(res, 400, {
          error: "items array is required",
        });
      }

      if (typeof subtotal !== "number" || typeof total !== "number") {
        return sendJson(res, 400, {
          error: "subtotal and total must be numbers",
        });
      }

      const orderId = createId();
      const now = Math.floor(Date.now() / 1000);

      // If userId is an email, look up the actual user ID
      let actualUserId = userId;
      if (userId && userId.includes("@")) {
        const user = await db.getUserByEmail(userId);
        actualUserId = user ? user.id : null;
      }

      // Create order
      const order = {
        id: orderId,
        user_id: actualUserId || null,
        items: JSON.stringify(items),
        subtotal,
        tax: tax || 0,
        total,
        status: "ordered", // Changed from "pending" to "ordered"
        payment_method: paymentMethod || null,
        created_at: now,
        updated_at: now,
      };

      await db.createOrder(order);

      // Create sales records for analytics
      const sales = items.map(item => ({
        id: createId(),
        order_id: orderId,
        item_id: item.id || null,
        item_name: item.name || "Unknown",
        quantity: item.qty || 1,
        price: item.price || 0,
        total: (item.price || 0) * (item.qty || 1),
        created_at: now,
      }));

      await db.createSales(sales);
      
      return sendJson(res, 201, {
        ...order,
        userId: order.user_id,
        items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
        createdAt: order.created_at * 1000,
        updatedAt: order.updated_at * 1000,
      });
    }

    if (method === "PATCH") {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const id = url.searchParams.get("id");
      if (!id) return sendJson(res, 400, { error: "id query parameter is required" });

      const existing = await db.getOrder(id);
      if (!existing) {
        return sendJson(res, 404, { error: "Order not found" });
      }

      const payload = await parseBody(req);
      const updates = {};
      
      if (payload.status !== undefined) updates.status = payload.status;
      
      const updated = await db.updateOrder(id, updates);
      
      return sendJson(res, 200, {
        ...updated,
        userId: updated.user_id,
        items: typeof updated.items === 'string' ? JSON.parse(updated.items) : updated.items,
        createdAt: updated.created_at * 1000,
        updatedAt: updated.updated_at * 1000,
      });
    }

    res.statusCode = 405;
    res.setHeader("Allow", "GET,POST,PATCH");
    res.end();
  } catch (error) {
    console.error("Orders API error:", error);
    return sendJson(res, 500, { error: error.message || "Internal server error" });
  }
};
