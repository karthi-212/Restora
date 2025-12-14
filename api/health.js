module.exports = (_req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      ok: true,
      uptime: process.uptime ? process.uptime() : null,
      message: "Restora Vercel API is running",
    })
  );
};


