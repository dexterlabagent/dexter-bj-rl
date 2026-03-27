import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { jsonSchema, tool, ToolSet } from 'ai';

export type McpServerEntry = {
	url: string;
	headers?: Record<string, string>;
};

export type MCPServersConfig = {
	proxyEndpoint: string;
	mcpServers: Record<string, McpServerEntry>;
};

async function getMcpClients(config: MCPServersConfig): Promise<Client[]> {
	const clients: Client[] = [];

	// Ping proxy endpoint to ensure it's ready
	try {
		await fetch(config.proxyEndpoint, { method: 'HEAD' });
	} catch (error) {
		console.warn(`Failed to ping proxy endpoint: ${config.proxyEndpoint}`, error);
	}

	for (const key in config.mcpServers) {
		const entry = config.mcpServers[key];
		const baseUrl = entry.url;
		const serverHeaders = entry.headers || {};
		const proxyEndpoint = config.proxyEndpoint;

		const client = new Client(
			{
				name: key,
				version: '0.1.0',
				baseUrl: baseUrl,
				proxyUrl: proxyEndpoint,
			},
			{
				capabilities: {
					sampling: {},
				},
			},
		);

		try {
			await client.connect(new SSEClientTransport(new URL(`${proxyEndpoint}?server=${baseUrl}`), {
				requestInit: {
					headers: {
						'x-base-url': baseUrl,
						...(Object.keys(serverHeaders).length > 0
							? { 'x-mcp-headers': JSON.stringify(serverHeaders) }
							: {}),
					},
				},
			}));
			clients.push(client);
		} catch (error) {
			console.error(`Failed to connect to ${baseUrl}:`, error);
		}
	}
	return clients;
}

export async function buildAllTools(config: MCPServersConfig): Promise<{ allTools: ToolSet, toolServerMap: Map<string, Client>, onClose: () => void } | undefined> {
	try {
		const mcpClients = await getMcpClients(config);
		let allTools: ToolSet = {};
		const toolServerMap = new Map();

		await Promise.all(mcpClients.map(async (mcpClient) => {
			let allMcpTools = [];
			let nextCursor: string | undefined = undefined;

			do {
				const toolList = await mcpClient.listTools({
					cursor: nextCursor
				});

				nextCursor = toolList.nextCursor;

				const mcpTools = toolList.tools.map((tool) => {
					toolServerMap.set(tool.name, mcpClient);
					return {
						name: tool.name,
						description: tool.description,
						input_schema: tool.inputSchema,
					};
				});

				allMcpTools.push(...mcpTools);
			} while (nextCursor);

			const aiSdkTools = allMcpTools.map((t) => {
				return {
					name: t.name,
					tool: tool({
						parameters: jsonSchema(t.input_schema as any) as any,
						description: t.description,
						execute: async (args) => {
							const result = await mcpClient.callTool({
								name: t.name,
								arguments: args,
							});
							return result;
						}
					})
				};
			});

			allTools = aiSdkTools?.reduce((acc, tool) => {
				acc[tool.name] = tool.tool;
				return acc;
			}, allTools);
		}));

		return {
			allTools, toolServerMap, onClose: () => {
				mcpClients.forEach((client) => {
					client.close();
				});
			}
		};

	} catch (error) {
		console.error('Error building tools:', error);
		throw error;
	}
}
