# my-tldr

My TL;DR is an open-source Reddit mod tool, built on [Devvit](https://developers.reddit.com/docs), that generates AI-powered summaries of posts with a single click. The output is automatically posted as a distinguished, stickied comment.

The app was originally built for [r/ethtrader](https://www.reddit.com/r/ethtrader/), but it's open for any subreddit to use.

---

## How it works

A moderator opens any post, clicks `"Summarize this post"` from the Mod actions menu, and My TL;DR will:

- Fetch the post title and body
- Send the content to Gemini 2.5 Flash, via Google's API
- Post the summary back to the thread as a distinguished, stickied comment

---

## Limitations

This app was specifically built to summarize **Reddit text posts**. For posts that link to external articles/URLs, the app will attempt to retrieve the content. However, some news sites and sources block automated access, in which case the app will post a comment noting that the article couldn't be retrieved.

---

## Requirements

- An account with moderator permissions on your subreddit
- [Node.js](https://nodejs.org/) 18 or higher
- The Devvit CLI
- A (free) [Gemini API key](https://aistudio.google.com/apikey)

---

## Installation

### 1. Install the Devvit CLI and log in

```bash
npm install -g devvit
devvit login
```

### 2. Install the app on your subreddit

Visit the app's directory page and click `Add to Community`, then select your subreddit.

Or, if you're building from source, run:

```bash
devvit upload
```

### 3. Configure your Gemini API key

After installation, go to your subreddit and navigate to:

**Mod Tools → my-tldr → Configure**

Paste your Gemini API key and save.

Or, once again if you're building from source:

```bash
devvit settings set gemini-api-key
```

To get a free key:

1. Go to: https://aistudio.google.com/apikey
2. Sign in with a Google account
3. Click `Create API key`

### 4. Use the app

Open any post in your subreddit, click the `Mod actions` menu, and select `"Summarize this post"`. The summary will appear as a stickied comment within a few seconds.

---

## API key & cost

**Each subreddit installation requires its own Gemini API key. Keys are not shared between subreddits or installations.**

The app is built for **Gemini 2.5 Flash** on Google's free tier (no billing setup or credit card is required). Do note that the free tier has rate limits, but since this tool is manually triggered by moderators, you're very unlikely to hit them.

If you prefer a different LLM provider, the API call in `src/main.ts` can be adapted to any REST-based model (OpenAI, Anthropic, Mistral, etc), though you'll need to update the endpoint, headers, and response parsing accordingly.

---

## Building from source

```bash
# Clone the repository
git clone https://github.com/0xMarcAurel/my-tldr
cd my-tldr

# Install dependencies
npm install

# Log in with your Reddit account
devvit login

# Start a live-reload playtest session
npm run dev

# Deploy
devvit upload
```

---

## Tech stack

|          |                  |
| -------- | ---------------- |
| Platform | Reddit Devvit    |
| Language | TypeScript       |
| AI Model | Gemini 2.5 Flash |
| Cost     | Free tier        |

---

## Open-source

The source code for this app is available [here](https://github.com/0xMarcAurel/my-tldr).

Contributions, issues, and forks are welcome.

---

## Credits

Built by [u/0xMarcAurel](https://www.reddit.com/user/0xMarcAurel) for [r/ethtrader](https://www.reddit.com/r/ethtrader/).
