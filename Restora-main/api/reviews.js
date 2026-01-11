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
      const itemId = url.searchParams.get("itemId");
      
      let reviews = await db.getReviews();
      
      // Filter by itemId
      if (itemId) {
        reviews = reviews.filter(r => r.item_id === itemId);
      }
      
      // Sort by created_at descending
      reviews.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
      
      // Convert timestamps
      const formatted = reviews.map(r => ({
        ...r,
        itemId: r.item_id,
        itemName: r.item_name,
        reviewerName: r.reviewer_name,
        timestamp: r.created_at ? r.created_at * 1000 : Date.now(),
        createdAt: r.created_at ? r.created_at * 1000 : Date.now(),
        updatedAt: r.updated_at ? r.updated_at * 1000 : Date.now(),
      }));
      
      return sendJson(res, 200, formatted);
    }

    if (method === "POST") {
      const payload = await parseBody(req);
      const { id, itemId, rating, reviewerName, text, userEmail, itemName } = payload;
      
      if (!itemId || !rating || !text) {
        return sendJson(res, 400, {
          error: "itemId, rating and text are required",
        });
      }

      if (rating < 1 || rating > 5) {
        return sendJson(res, 400, {
          error: "rating must be between 1 and 5",
        });
      }

      // Get item name - use provided itemName or fetch from database
      let finalItemName = itemName;
      if (!finalItemName) {
        const item = await db.getMenuItem(itemId);
        finalItemName = item?.name || "Unknown";
      }

      const reviewId = id || createId();
      const now = Math.floor(Date.now() / 1000);

      const review = {
        id: reviewId,
        item_id: itemId,
        item_name: finalItemName,
        rating: Number(rating),
        reviewer_name: reviewerName || "Anonymous",
        text,
        user_id: null,
        created_at: now,
        updated_at: now,
      };

      await db.createReview(review);
      
      return sendJson(res, 201, {
        ...review,
        itemId: review.item_id,
        itemName: review.item_name,
        reviewerName: review.reviewer_name,
        timestamp: review.created_at * 1000,
        createdAt: review.created_at * 1000,
        updatedAt: review.updated_at * 1000,
      });
    }

    if (method === "DELETE") {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const id = url.searchParams.get("id");
      if (!id) return sendJson(res, 400, { error: "id query parameter is required" });

      const existing = await db.getReview(id);
      if (!existing) {
        return sendJson(res, 404, { error: "Review not found" });
      }

      await db.deleteReview(id);
      res.statusCode = 204;
      return res.end();
    }

    res.statusCode = 405;
    res.setHeader("Allow", "GET,POST,DELETE");
    res.end();
  } catch (error) {
    console.error("Reviews API error:", error);
    return sendJson(res, 500, { error: error.message || "Internal server error" });
  }
};
