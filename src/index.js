import { corsHeaders } from "./cors.js";
import { handleAgent } from "./agent.js";
import { handleProxy } from "./proxy.js";

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: corsHeaders() });
		}

		if (url.pathname === "/agent" && request.method === "POST") {
			return handleAgent(request);
		}

		return handleProxy(request);
	},
};
