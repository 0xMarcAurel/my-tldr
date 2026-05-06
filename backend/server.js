import "dotenv/config";
import express from "express";
import axios from "axios";
import { load } from "cheerio";

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());

// health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "Backend running" });
});

// main endpoint
app.post("/fetch-and-extract", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, error: "URL required" });
  }

  try {
    // fetch the page
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const $ = load(response.data);

    // extract title
    const title =
      $("h1").first().text() ||
      $('meta[property="og:title"]').attr("content") ||
      $("title").text() ||
      "Untitled";

    // extract main content (try article -> main -> body)
    let content =
      $("article").text() ||
      $("[data-testid='tweetText']").text() || // for X posts
      $("main").text() ||
      $('[role="main"]').text() ||
      $("body").text();

    // clean up content
    content = content.replace(/\s+/g, " ").trim().slice(0, 5000); // limited to 5000 characters

    if (!content) {
      return res.status(400).json({
        success: false,
        error: "Could not extract content from URL",
      });
    }

    res.json({
      success: true,
      title: title.trim(),
      content,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error("Fetch error:", message);

    res.status(400).json({
      success: false,
      error: message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
