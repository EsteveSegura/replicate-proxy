import { Agent, OpenAIProvider, Tool } from "gnomoagent";
import { corsHeaders } from "./cors.js";

function buildToolkit({ initialNodes }) {
	const knownIds = new Set();
	const knownKindsById = new Map();
	for (const n of initialNodes) {
		if (n && typeof n.id === "string") {
			knownIds.add(n.id);
			knownKindsById.set(n.id, n.type);
		}
	}
	const ops = [];
	let counter = 0;
	const allocId = () => {
		counter++;
		return `ai_${Date.now()}_${counter}`;
	};

	const createImage = new Tool({
		name: "create_image_generator_node",
		description:
			"Create a new Image Generator node on the canvas. Returns the node id you must use to reference it in connect_nodes.",
		inputSchema: {
			type: "object",
			properties: {
				prompt: {
					type: "string",
					description: "The prompt that controls what the image generator will produce.",
				},
				model: {
					type: "string",
					description: "Optional model id. Default: nano-banana-pro.",
				},
			},
			required: ["prompt"],
		},
		handler: async ({ prompt, model }) => {
			const id = allocId();
			ops.push({
				op: "create",
				kind: "image-generator",
				id,
				data: { prompt, model: model ?? null },
			});
			knownIds.add(id);
			knownKindsById.set(id, "image-generator");
			return { id };
		},
	});

	const createText = new Tool({
		name: "create_text_generator_node",
		description:
			"Create a new Text Generator node on the canvas. Returns the node id you must use to reference it in connect_nodes.",
		inputSchema: {
			type: "object",
			properties: {
				prompt: {
					type: "string",
					description: "The prompt that controls what the text generator will produce.",
				},
				model: {
					type: "string",
					description: "Optional model id. Default: gpt-5.",
				},
			},
			required: ["prompt"],
		},
		handler: async ({ prompt, model }) => {
			const id = allocId();
			ops.push({
				op: "create",
				kind: "text-generator",
				id,
				data: { prompt, model: model ?? null },
			});
			knownIds.add(id);
			knownKindsById.set(id, "text-generator");
			return { id };
		},
	});

	// Handle ids in BaseNode.vue follow `input-${index}` / `output-${index}`
	// where index matches the position in the io.inputs / io.outputs arrays.
	// We compute the right index based on the port type the source emits and
	// the ordered input list of the target.
	const EMITS = {
		"image-generator": "image",
		"text-generator": "prompt",
		prompt: "prompt",
		"prompt-template": "prompt",
		image: "image",
		draw: "image",
	};
	const TARGET_INPUTS = {
		"image-generator": ["image", "prompt"],
		"text-generator": ["image", "prompt"],
		prompt: ["prompt"],
		"prompt-template": ["prompt"],
		draw: ["image"],
		diff: ["image", "image"],
		compare: ["image", "image"],
	};

	function inferHandles(sourceKind, targetKind) {
		const emit = EMITS[sourceKind];
		const inputs = TARGET_INPUTS[targetKind];
		if (!emit || !inputs) {
			return { source_handle: "output-0", target_handle: null };
		}
		const idx = inputs.indexOf(emit);
		if (idx < 0) {
			return { source_handle: "output-0", target_handle: null };
		}
		return { source_handle: "output-0", target_handle: `input-${idx}` };
	}

	const connect = new Tool({
		name: "connect_nodes",
		description:
			"Connect two existing nodes by their ids. Edge direction is source → target. Handles are inferred from node types.",
		inputSchema: {
			type: "object",
			properties: {
				source_id: { type: "string" },
				target_id: { type: "string" },
			},
			required: ["source_id", "target_id"],
		},
		handler: async ({ source_id, target_id }) => {
			if (!knownIds.has(source_id)) {
				throw new Error(
					`Unknown source_id "${source_id}". Use an id from the canvas snapshot or one returned by a create_*_node tool.`,
				);
			}
			if (!knownIds.has(target_id)) {
				throw new Error(
					`Unknown target_id "${target_id}". Use an id from the canvas snapshot or one returned by a create_*_node tool.`,
				);
			}
			if (source_id === target_id) {
				throw new Error("source_id and target_id must be different.");
			}
			const sourceKind = knownKindsById.get(source_id);
			const targetKind = knownKindsById.get(target_id);
			const handles = inferHandles(sourceKind, targetKind);
			if (!handles.target_handle) {
				throw new Error(
					`Incompatible connection: a "${sourceKind}" emits "${EMITS[sourceKind] ?? "?"}" but "${targetKind}" does not accept that as an input. Pick a target whose inputs match the source's output type.`,
				);
			}
			ops.push({
				op: "connect",
				source_id,
				target_id,
				source_handle: handles.source_handle,
				target_handle: handles.target_handle,
			});
			return { ok: true };
		},
	});

	const updatePrompt = new Tool({
		name: "update_node_prompt",
		description:
			"Update the user-editable prompt of an existing image-generator or text-generator node. This writes ONLY to the field the user types into in the UI (the textarea); it never overwrites generated output, model, params, label, or any other state. Use this instead of creating a duplicate when the user asks to change what an existing node does.",
		inputSchema: {
			type: "object",
			properties: {
				node_id: {
					type: "string",
					description: "Id of the node to update. Must exist in the canvas snapshot or have been created earlier in this session.",
				},
				prompt: {
					type: "string",
					description: "The new prompt text the user wants in the textarea.",
				},
			},
			required: ["node_id", "prompt"],
		},
		handler: async ({ node_id, prompt }) => {
			if (!knownIds.has(node_id)) {
				throw new Error(
					`Unknown node_id "${node_id}". Use an id from the canvas snapshot or one returned by a create_*_node tool.`,
				);
			}
			const kind = knownKindsById.get(node_id);
			if (kind !== "image-generator" && kind !== "text-generator") {
				throw new Error(
					`Cannot update the prompt of a "${kind}" node — only image-generator and text-generator have a user-editable prompt.`,
				);
			}
			ops.push({ op: "update", id: node_id, data: { prompt } });
			return { ok: true };
		},
	});

	const deleteNode = new Tool({
		name: "delete_node",
		description:
			"Remove an existing node from the canvas. Edges that touch the node are also removed. Use this only when the user explicitly wants the node gone.",
		inputSchema: {
			type: "object",
			properties: {
				node_id: { type: "string" },
			},
			required: ["node_id"],
		},
		handler: async ({ node_id }) => {
			if (!knownIds.has(node_id)) {
				throw new Error(
					`Unknown node_id "${node_id}". Use an id from the canvas snapshot or one returned by a create_*_node tool.`,
				);
			}
			knownIds.delete(node_id);
			knownKindsById.delete(node_id);
			ops.push({ op: "delete", id: node_id });
			return { ok: true };
		},
	});

	return {
		tools: [createImage, createText, connect, updatePrompt, deleteNode],
		getOps: () => ops,
	};
}

function buildSystemPrompt(canvas) {
	return [
		"You are an assistant embedded inside a visual node-editor for AI workflows (Vue + VueFlow).",
		"Your job is to help the user build and maintain the graph they describe by calling the available tools. Keep replies short.",
		"",
		"Node types you can create:",
		"- image-generator: inputs = [image, prompt]; output = image.",
		"- text-generator:  inputs = [image, prompt]; output = prompt.",
		"",
		"Available tools:",
		"- create_image_generator_node(prompt, model?) — creates a new image-generator. Returns its id.",
		"- create_text_generator_node(prompt, model?)  — creates a new text-generator. Returns its id.",
		"- connect_nodes(source_id, target_id)         — adds an edge between two existing nodes.",
		"- update_node_prompt(node_id, prompt)         — changes the prompt of an existing node.",
		"- delete_node(node_id)                        — removes an existing node and its edges.",
		"",
		"Rules — read carefully:",
		"1. ALWAYS read the canvas snapshot below first. If a node already exists that matches what the user is asking for, REUSE it (update or connect) — do NOT create a duplicate.",
		"2. If the user asks to 'change', 'edit', 'update', 'rename', or 'replace the prompt of' an existing node, use update_node_prompt — never create_*_node.",
		"3. If the user asks to 'remove', 'delete', or 'get rid of' a node, use delete_node.",
		"4. Only call create_*_node when the user is asking for a node that does NOT already exist in the snapshot.",
		"5. Never invent node ids. Use ids from the canvas snapshot below or ones returned by your tool calls.",
		"6. The canvas auto-tidies after you finish, so do not worry about positions.",
		"7. If the user is just chatting (asking questions, no graph changes needed), reply normally without calling tools.",
		"",
		"Canvas snapshot (sanitized — image binaries are NOT included):",
		JSON.stringify(canvas),
	].join("\n");
}

export async function handleAgent(request) {
	let payload;
	try {
		payload = await request.json();
	} catch {
		return jsonResponse({ error: "Invalid JSON body" }, 400);
	}

	const { prompt, apiKey, model, maxIterations, canvas } = payload || {};

	if (!apiKey) {
		return jsonResponse({ error: "Missing 'apiKey' in body" }, 400);
	}
	if (!prompt || typeof prompt !== "string") {
		return jsonResponse({ error: "Missing 'prompt' in body" }, 400);
	}

	const safeCanvas =
		canvas && typeof canvas === "object"
			? {
					nodes: Array.isArray(canvas.nodes) ? canvas.nodes : [],
					edges: Array.isArray(canvas.edges) ? canvas.edges : [],
				}
			: { nodes: [], edges: [] };

	try {
		const { tools, getOps } = buildToolkit({ initialNodes: safeCanvas.nodes });

		const agent = new Agent({
			provider: new OpenAIProvider({
				apiKey,
				model: model,
			}),
			systemPrompt: buildSystemPrompt(safeCanvas),
			tools,
			maxIterations: maxIterations ?? 10,
		});

		const { finalMessage, iterations } = await agent.run(prompt);
		return jsonResponse({
			message: finalMessage,
			operations: getOps(),
			iterations,
		});
	} catch (error) {
		console.error("Agent error:", error);
		return jsonResponse({ error: "Agent error", message: error.message }, 500);
	}
}

function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders(), "Content-Type": "application/json" },
	});
}
