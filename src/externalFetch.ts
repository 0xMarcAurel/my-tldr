// helper function to fetch external URLs via backend proxy
export async function fetchExternalContent(url: string): Promise<{ title: string; content: string } | null> {
    const BACKEND_URL = "https://my-tldr.onrender.com";

    try {
        const response = await fetch(`${BACKEND_URL}/fetch-and-extract`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
        });

        if (!response.ok) {
            console.error(`Backend error: ${response.status}`);
            return null;
        }

        const data = await response.json();

        if (!data.success) {
            console.error(`Backend failed: ${data.error}`);
            return null;
        }

        return {
            title: data.title,
            content: data.content,
        };
    } catch (error) {
        console.error(`Fetch external content error: ${error}`);
        return null;
    }
}