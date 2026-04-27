import "dotenv/config";
import { Devvit } from "@devvit/public-api";

Devvit.configure({ redditAPI: true, http: true });

Devvit.addSettings([
  {
    name: "gemini-api-key",
    label: "Gemini API Key",
    type: "string",
    isSecret: true,
    scope: "app",
  },
]);

const botVersion = "v0.0.1.60"; // update with each release

// helper function to fetch gemini's API in case it's unavailable (due to high demand)
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delayMs = 1500): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, options);

    if (response.status !== 503) {
      return response;
    }

    if (i < retries - 1) {
      await new Promise(res => setTimeout(res, delayMs * (i + 1)));
    }
  }

  throw new Error("Gemini API is unavailable after multiple retries. Please try again later.");
}

Devvit.addMenuItem({
  label: "Summarize this post",
  description: "Generate a summary of this post using AI.",
  location: "post",
  forUserType: "moderator",
  onPress: async (event, context) => {
    try {
      context.ui.showToast("Generating summary...")

      // get post details
      const postId = event.targetId;
      const post = await context.reddit.getPostById(postId);
      const title = post.title;

      const isLinkPost =
        !post.body &&
        post.url &&
        post.url.startsWith("http") &&
        !post.url.includes("reddit.com");

      // get API key
      const rawKey =
        (await context.settings.get("gemini-api-key"));

      if (!rawKey || typeof rawKey !== "string") {
        throw new Error("Invalid Gemini API key");
      }

      const apiKey = rawKey;

      const basePrompt = [
        `Summarize this post.`,
        `Write 1-2 short paragraphs (2-4 sentences total).`,
        `Ensure all sentences are complete. Do not cut off mid-sentence.`,
        `Only use information from the post. Do not add assumptions or external context.`,
        `End the response with a complete sentence and proper punctuation.`,
        `Keep the language clear and simple to understand.`,
      ].join(" ");

      // build request body depending on post type
      let contentForSummary: string;

      if (isLinkPost) {
        try {
          // jina reader will extract clean text from any url
          const jinaRes = await fetch(`https://r.jina.ai/${post.url}`, {
            headers: { "Accept": "text/plain" },
          });

          const articleText = await jinaRes.text();

          if (!articleText) {
            contentForSummary = `Title: ${title}\n\nNote: Article content could not be retrieved.`;
          } else {
            contentForSummary = `Title: ${title}\n\nArticle content:\n${articleText}`.slice(0, 4000);
          }
        } catch (err) {
          console.error("Jina fetch failed:", err);

          contentForSummary = `Title: ${title}\n\nNote: Article content could not be retrieved.`;
        }
      } else {
        contentForSummary = `Title: ${title}\n\n${post.body ?? ""}`.slice(0, 4000);
      }

      const contents = [{ parts: [{ text: `${basePrompt}\n\n${contentForSummary}` }] }];

      const generationConfig = isLinkPost
        ? {
          maxOutputTokens: 1000,
          temperature: 0.4,
        }
        : {
          maxOutputTokens: 500,
          temperature: 0.4,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        };

      // call gemini API
      const response = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents,
            generationConfig
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(`Gemini API error: ${data.error.message}`);
      }

      // check if url retrieval failed
      const parts = data?.candidates?.[0]?.content?.parts ?? [];
      const summary = parts.find((part: { text?: string }) => part.text?.trim())?.text;

      if (!summary) {
        throw new Error("Gemini returned no content. Check API key and quota.");
      }

      // post the comment
      const commentBody = [
        `**TL;DR:**`,
        ``,
        summary,
        ``,
        `---`,
        `*This is an AI-generated summary, always make sure to verify the accuracy of the information provided.*`,
        ``,
        `*^(my-tldr ${botVersion})*`
      ].join("\n");


      const comment = await context.reddit.submitComment({
        id: postId,
        text: commentBody,
      });

      comment.distinguish(true);

      context.ui.showToast("Summary posted.");
    } catch (error) {
      console.error("Error generating summary:", error);

      context.ui.showToast("Failed to generate summary.");
    }
  }
});

export default Devvit;