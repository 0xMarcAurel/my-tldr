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
  description: "Generate a summary of this post using AI.",
  location: "post",
  forUserType: "moderator",
  onPress: async (event, context) => {
    try {
      // get post details
      const postId = event.targetId;
      const post = await context.reddit.getPostById(postId);
      const title = post.title;
      const isLinkPost = !post.body && post.url && !post.url.includes("reddit.com");

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
      ].join(' ');

      // build request body depending on post type
      const contents = isLinkPost
        ? [{ parts: [{ text: `${basePrompt}\n\nTitle: ${title}\n\nArticle URL: ${post.url}` }] }]
        : [{ parts: [{ text: `${basePrompt}\n\nTitle: ${title}\n\n${post.body ?? ''}`.slice(0, 4000) }] }];

      const tools = isLinkPost ? [{ url_context: {} }] : [];

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
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents,
            ...(tools.length > 0 && { tools }),
            generationConfig
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(`Gemini API error: ${data.error.message}`);
      }

      // check if url retrieval failed
      const urlStatus = data?.candidates?.[0]?.urlContextMetadata?.urlMetadata?.[0]?.urlRetrievalStatus;
      const urlFailed = isLinkPost && urlStatus && urlStatus !== "URL_RETRIEVAL_STATUS_SUCCESS";

      let commentBody: string;

      if (urlFailed) {
        commentBody = [
          `**TL;DR:**`,
          ``,
          `The article could not be retrieved for summarization. You can read it directly here: ${post.url}`,
          ``,
          `---`,
          `*^(Article content was unavailable for AI summarization.)*`,
        ].join('\n');
      } else {
        const parts = data?.candidates?.[0]?.content?.parts ?? [];
        const summary = parts.find((p: { text?: string }) => p.text?.trim())?.text;

        if (!summary) {
          throw new Error("Gemini returned no content. Check API key and quota.");
        }

        // post the comment
        commentBody = [
          `**TL;DR:**`,
          ``,
          summary,
          ``,
          `---`,
          `*^(This is an AI-generated summary, always make sure to verify the accuracy of the information provided.)*`
        ].join('\n');
      }

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