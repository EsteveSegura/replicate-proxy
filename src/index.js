export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		// Handle CORS preflight requests
		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: corsHeaders(),
			});
		}

		// Get the path from the request
		const targetUrl = `https://api.replicate.com${url.pathname}${url.search}`;

		// Log the request
		const timestamp = new Date().toISOString();
		console.log(`[${timestamp}] ${request.method} ${url.pathname}`);
		console.log(`Proxying to: ${targetUrl}`);

		// Get request body if present
		let body = null;
		if (request.method !== "GET" && request.method !== "HEAD") {
			body = await request.text();
		}

		try {
			// Forward the request to Replicate API
			const replicateResponse = await fetch(targetUrl, {
				method: request.method,
				headers: {
					Authorization: request.headers.get("Authorization"),
					"Content-Type": request.headers.get("Content-Type") || "application/json",
				},
				body: body,
			});

			// Get response content type
			const contentType = replicateResponse.headers.get("Content-Type") || "application/json";
			const data = await replicateResponse.text();

			// Return response with CORS headers
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
				JSON.stringify({
					error: "Proxy error",
					message: error.message,
				}),
				{
					status: 500,
					headers: {
						...corsHeaders(),
						"Content-Type": "application/json",
					},
				}
			);
		}
	}
};

function corsHeaders() {
	return {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
		"Access-Control-Allow-Headers": "*",
	};
}
