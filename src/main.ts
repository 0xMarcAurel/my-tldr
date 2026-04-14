import 'dotenv/config';
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

Devvit.addMenuItem({
  label: "Summarize this post",
  location: "post",
  forUserType: "moderator",
  onPress: async (event, context) => {

    try {
      context.ui.showToast("Generating summary...");

      // get post details
      const postId = event.targetId;
      const post = await context.reddit.getPostById(postId);
      const title = post.title;
      const body = post.body ?? '';   // '' is for link posts
      const fullText = `Title: ${title}\n\n${body}`.slice(0, 4000);

      // call the Gemini API to get the summary
      const rawKey =
        (await context.settings.get("gemini-api-key")) ??
        process.env.GEMINI_API_KEY;

      if (!rawKey || typeof rawKey !== "string") {
        throw new Error("Invalid Gemini API key");
      }

      const apiKey = rawKey;

      const prompt = [
        `Summarize this Reddit post in a short concise text block.`,
        `Be brief and factual.\n\n${fullText}`
      ].join(' ');

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 300,
              temperature: 0.4,
            },
          }),
        }
      );

      const data = await response.json();
      const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!summary) {
        throw new Error("Gemini returned no content. Check API key and quota.");
      }

      // post the summary as a comment
      const commentBody = [
        `**TL;DR:**`,
        ``,
        summary,
        ``,
        `---`,
        `*^(This is an AI-generated summary, always make sure to verify the accuracy of the information provided.)*`
      ].join('\n');

      await context.reddit.submitComment({
        id: postId,
        text: commentBody,
      });

      context.ui.showToast("Summary posted.");
    } catch (error) {
      console.error("Error generating summary:", error);
      context.ui.showToast("Failed to generate summary.");
    }
  }
});

export default Devvit;