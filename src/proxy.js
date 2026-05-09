import { corsHeaders } from "./cors.js";

const REPLICATE_BASE = "https://api.replicate.com";

export async function handleProxy(request) {
	const url = new URL(request.url);
	const targetUrl = `${REPLICATE_BASE}${url.pathname}${url.search}`;

	const timestamp = new Date().toISOString();
	console.log(`[${timestamp}] ${request.method} ${url.pathname}`);
	console.log(`Proxying to: ${targetUrl}`);

	let body = null;
	if (request.method !== "GET" && request.method !== "HEAD") {
		body = await request.text();
	}

	try {
		const replicateResponse = await fetch(targetUrl, {
			method: request.method,
			headers: {
				Authorization: request.headers.get("Authorization"),
				"Content-Type": request.headers.get("Content-Type") || "application/json",
			},
			body,
		});

		const contentType = replicateResponse.headers.get("Content-Type") || "application/json";
		const data = await replicateResponse.text();

		return new Response(data, {
			status: replicateResponse.status,
			headers: {
				...corsHeaders(),
				"Content-Type": contentType,
			},
		});
	} catch (error) {
		console.error("Proxy Error:", error);
		return new Response(
			JSON.stringify({ error: "Proxy error", message: error.message }),
			{
				status: 500,
				headers: { ...corsHeaders(), "Content-Type": "application/json" },
			},
		);
	}
}
