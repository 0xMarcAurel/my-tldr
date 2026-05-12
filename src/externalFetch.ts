// helper function to fetch external URLs via backend proxy
interface ExternalContent {
    title: string;
    content: string;
}

interface BackendResponse {
    success: boolean;
    title?: string;
    content?: string;
    error?: string;
}

export async function fetchExternalContent(url: string): Promise<ExternalContent> {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

    if (!backendUrl) {
        throw new Error("NEXT_PUBLIC_BACKEND_URL is not configured");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
        const response = await fetch(`${backendUrl}/fetch-and-extract`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`);
        }

        const data: BackendResponse = await response.json();

        if (!data.success) {
            throw new Error(data.error || "Backend extraction failed");
        }

        if (!data.title || !data.content) {
            throw new Error("Backend response missing title or content");
        }

        return { title: data.title, content: data.content };
    } finally {
        clearTimeout(timeoutId);
    }
}