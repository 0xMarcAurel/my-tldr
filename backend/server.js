import "dotenv/config";
import express from "express";
import cors from "cors";
import axios from "axios";
import Readability from "@mozilla/readability";
import { JSDOM } from "jsdom";

const PORT = process.env.PORT || 3000;
const app = express();

app.use(
  cors({
    origin: true,
    methods: ["POST", "GET"],
    allowedHeaders: ["Content-Type"],
    maxAge: 3600,
  }),
);

app.use(express.json());

// health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "Backend running" });
});

// main endpoint
app.post("/fetch-and-extract", async (req, res) => {
  const { url } = req.body;

  // url validation
  if (!url) {
    return res.status(400).json({ success: false, error: "URL required" });
  }

  if (!url.startsWith("http")) {
    return res.status(400).json({ success: false, error: "Invalid URL" });
  }

  if (typeof url !== "string") {
    return res
      .status(400)
      .json({ success: false, error: "URL must be a string" });
  }

  if (url.length > 2048) {
    return res
      .status(400)
      .json({ success: false, error: "URL length exceeds limit" });
  }

  const blockedDomains = ["localhost", "127.0.0.1"];

  if (blockedDomains.some((domain) => url.includes(domain))) {
    return res.status(400).json({
      success: false,
      error: "Access to internal URLs not allowed",
    });
  }

  // robust private IP check / local check
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;

    if (
      hostname === "0.0.0.0" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") ||
      hostname.startsWith("172.17.") ||
      hostname.startsWith("172.18.") ||
      hostname.startsWith("172.19.") ||
      hostname.startsWith("172.2") ||
      hostname.startsWith("172.30.") ||
      hostname.startsWith("172.31.")
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Access to internal URLs not allowed" });
    }
  } catch (error) {
    return res.status(400).json({ success: false, error: "Invalid URL" });
  }

  try {
    // fetch the page
    const response = await axios.get(url, {
      timeout: 10000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const dom = new JSDOM(response.data, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    // extract title and main content
    const title = article?.title?.trim() || "Untitled";
    let content = article?.textContent?.trim() || "";

    if (!content) {
      return res.status(400).json({
        success: false,
        error: "Could not extract content from URL",
      });
    }

    content = content.slice(0, 4000);

    res.json({
      success: true,
      title: title.trim(),
      content,
    });
  } catch (error) {
    let statusCode = 500;
    let errorMsg = "Unknown error";

    if (error.code === "ECONNABORTED") {
      statusCode = 408;
      errorMsg = "Request timeout (took longer than 10s)";
    } else if (error.code === "ENOTFOUND") {
      statusCode = 400;
      errorMsg = "Domain not found";
    } else if (error.code === "ECONNREFUSED") {
      statusCode = 400;
      errorMsg = "Connection refused by target server";
    } else if (
      error?.response?.status === 403 ||
      error.message.includes("403")
    ) {
      statusCode = 403;
      errorMsg = "Access denied by target server";
    } else if (error instanceof Error) {
      errorMsg = error.message;
    }

    console.error(`[${statusCode}] Fetch error for ${url}: ${errorMsg}`);

    res.status(statusCode).json({ success: false, error: errorMsg });
  }
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
