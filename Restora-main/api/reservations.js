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
      const status = url.searchParams.get("status");
      const date = url.searchParams.get("date");
      
      let reservations = await db.getReservations();
      
      // Filter by status
      if (status) {
        reservations = reservations.filter(r => r.status === status);
      }
      
      // Filter by date
      if (date) {
        reservations = reservations.filter(r => r.date === date);
      }
      
      // Sort by created_at descending
      reservations.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
      
      // Convert timestamps
      const formatted = reservations.map(r => ({
        ...r,
        createdAt: r.created_at ? r.created_at * 1000 : Date.now(),
        updatedAt: r.updated_at ? r.updated_at * 1000 : Date.now(),
        requests: r.notes || "",
        userEmail: r.email || null,
      }));
      
      return sendJson(res, 200, formatted);
    }

    if (method === "POST") {
      const payload = await parseBody(req);
      const {
        id,
        name,
        phone,
        guests,
        date,
        time,
        notes,
        userEmail,
      } = payload;

      if (!name || !phone || !guests || !date || !time) {
        return sendJson(res, 400, {
          error: "name, phone, guests, date and time are required for a reservation",
        });
      }

      const reservationId = id || createId();
      const now = Math.floor(Date.now() / 1000);

      const reservation = {
        id: reservationId,
        name,
        phone,
        email: userEmail || null,
        date,
        time,
        guests: Number(guests),
        notes: notes || "",
        status: "pending",
        user_id: null,
        created_at: now,
        updated_at: now,
      };

      await db.createReservation(reservation);
      
      return sendJson(res, 201, {
        ...reservation,
        createdAt: reservation.created_at * 1000,
        updatedAt: reservation.updated_at * 1000,
        requests: reservation.notes || "",
        userEmail: reservation.email || null,
      });
    }

    if (method === "PATCH") {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const id = url.searchParams.get("id");
      if (!id) return sendJson(res, 400, { error: "id query parameter is required" });

      const existing = await db.getReservation(id);
      if (!existing) {
        return sendJson(res, 404, { error: "Reservation not found" });
      }

      const payload = await parseBody(req);
      const { status } = payload;

      if (status && !["pending", "approved", "rejected"].includes(status)) {
        return sendJson(res, 400, {
          error: "status must be pending, approved or rejected",
        });
      }

      const updates = {};
      if (status) updates.status = status;

      const updated = await db.updateReservation(id, updates);
      
      return sendJson(res, 200, {
        ...updated,
        createdAt: updated.created_at * 1000,
        updatedAt: updated.updated_at * 1000,
        requests: updated.notes || "",
        userEmail: updated.email || null,
      });
    }

    if (method === "DELETE") {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const id = url.searchParams.get("id");

      if (id) {
        const existing = await db.getReservation(id);
        if (!existing) {
          return sendJson(res, 404, { error: "Reservation not found" });
        }
        await db.deleteReservation(id);
      } else {
        // Clear all reservations (admin only)
        const reservations = await db.getReservations();
        for (const res of reservations) {
          await db.deleteReservation(res.id);
        }
      }

      res.statusCode = 204;
      return res.end();
    }

    res.statusCode = 405;
    res.setHeader("Allow", "GET,POST,PATCH,DELETE");
    res.end();
  } catch (error) {
    console.error("Reservations API error:", error);
    return sendJson(res, 500, { error: error.message || "Internal server error" });
  }
};
