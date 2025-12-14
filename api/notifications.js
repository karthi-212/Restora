// Mock email notification system
// In production, integrate with services like SendGrid, AWS SES, or Nodemailer

const { db } = require("./db");

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

// Mock email sending function
async function sendEmail(to, subject, body) {
  // In production, replace this with actual email service
  console.log("📧 [MOCK EMAIL]");
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body: ${body}`);
  console.log("---");
  
  // Simulate async email sending
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true, messageId: `mock-${Date.now()}` });
    }, 100);
  });
}

module.exports = async (req, res) => {
  const { method } = req;

  try {
    if (method === "POST") {
      const payload = await parseBody(req);
      const { type, to, data } = payload;

      if (!type || !to) {
        return sendJson(res, 400, {
          error: "type and to (email) are required",
        });
      }

      let subject = "";
      let body = "";

      switch (type) {
        case "reservation_confirmation":
          subject = "Reservation Confirmed - Restora Restaurant";
          body = `
Dear ${data.name || "Guest"},

Your table reservation has been confirmed!

Details:
- Date: ${data.date}
- Time: ${data.time}
- Guests: ${data.guests}
- Phone: ${data.phone}

We look forward to serving you at Restora!

Best regards,
Restora Restaurant Team
          `;
          break;

        case "reservation_status_update":
          subject = `Reservation ${data.status} - Restora Restaurant`;
          body = `
Dear ${data.name || "Guest"},

Your reservation status has been updated to: ${data.status}

Details:
- Date: ${data.date}
- Time: ${data.time}
- Guests: ${data.guests}

${data.status === "approved" ? "We look forward to seeing you!" : "Please contact us if you have any questions."}

Best regards,
Restora Restaurant Team
          `;
          break;

        case "order_confirmation":
          subject = "Order Confirmed - Restora Restaurant";
          body = `
Dear ${data.name || "Guest"},

Thank you for your order!

Order #${data.orderId}
Total: ₹${data.total}

Items:
${data.items.map(item => `- ${item.name} x${item.qty} - ₹${item.price * item.qty}`).join("\n")}

Your order is being prepared and will be ready soon!

Best regards,
Restora Restaurant Team
          `;
          break;

        case "welcome":
          subject = "Welcome to Restora Restaurant!";
          body = `
Dear ${data.name || "Guest"},

Welcome to Restora! We're excited to have you join our community.

You can now:
- Browse our menu
- Make reservations
- Order online
- Leave reviews

Thank you for choosing Restora!

Best regards,
Restora Restaurant Team
          `;
          break;

        default:
          return sendJson(res, 400, {
            error: "Unknown notification type",
          });
      }

      const result = await sendEmail(to, subject, body);

      return sendJson(res, 200, {
        success: true,
        type,
        to,
        messageId: result.messageId,
        message: "Email sent successfully (mock)",
      });
    }

    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end();
  } catch (error) {
    console.error("Notifications API error:", error);
    return sendJson(res, 500, { error: error.message || "Internal server error" });
  }
};

