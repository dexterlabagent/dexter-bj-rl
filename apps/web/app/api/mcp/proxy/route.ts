import { Redis } from '@upstash/redis';
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
})

// Store sessions globally for access across requests
declare global {
  var _mcpSessions: Record<string, string>;
}

global._mcpSessions = global._mcpSessions || {};

/**
 * Parse custom MCP server headers from the x-mcp-headers request header.
 * Sent as a JSON-encoded Record<string, string>.
 */
function parseMcpHeaders(request: NextRequest): Record<string, string> {
  const raw = request.headers.get('x-mcp-headers');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function GET(request: NextRequest) {
  const server = request.nextUrl.searchParams.get('server');
  if (!server) {
    return NextResponse.json({ error: 'Missing server parameter' }, { status: 400 });
  }

  const mcpHeaders = parseMcpHeaders(request);
  const newSessionId = randomUUID();
  global._mcpSessions[newSessionId] = server;

  try {
    const targetUrl = `${server}`;
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        ...Object.fromEntries(request.headers),
        ...mcpHeaders,
        host: new URL(server).host,
      },
    });

    if (!response.body) {
      throw new Error('No response body from MCP server');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          delete global._mcpSessions[newSessionId];
          return;
        }

        const chunkString = decoder.decode(value, { stream: true });
        const sessionId = chunkString.match(/sessionId=([^&]+)/)?.[1];
        if (sessionId) {
          await redis.set(`mcp:session:${sessionId}`, server);
        }
        controller.enqueue(value);
      },
      cancel() {
        reader.cancel();
        delete global._mcpSessions[newSessionId];
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-mcp-headers, x-base-url',
      },
    });
  } catch (error) {
    console.error('Error proxying SSE request:', error);
    delete global._mcpSessions[newSessionId];
    return NextResponse.json({ error: 'Failed to connect to MCP server' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const server = request.nextUrl.searchParams.get('server');

  if (!server) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: { code: -32602, message: "Missing server parameter" },
        id: null
      },
      { status: 400 }
    );
  }

  const mcpHeaders = parseMcpHeaders(request);
  const targetUrl = `${server}`;

  try {
    let jsonRpcRequest;
    try {
      const body = await request.text();
      jsonRpcRequest = JSON.parse(body);

      if (!jsonRpcRequest.jsonrpc || jsonRpcRequest.jsonrpc !== "2.0" || !jsonRpcRequest.method) {
        throw new Error("Invalid JSONRPC request");
      }
    } catch (err) {
      console.error("Error parsing JSONRPC request:", err);
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          error: { code: -32700, message: "Parse error" },
          id: null
        },
        { status: 400 }
      );
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...mcpHeaders,
        host: new URL(server).host,
      },
      body: JSON.stringify(jsonRpcRequest),
    });

    const responseText = await response.text();

    let jsonResponse;
    try {
      jsonResponse = JSON.parse(responseText);
    } catch (err) {
      console.error("Error parsing JSONRPC response:", err);
      jsonResponse = {
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal error: Invalid JSON response from server" },
        id: jsonRpcRequest.id || null
      };
    }

    return NextResponse.json(jsonResponse, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-mcp-headers, x-base-url',
      },
    });
  } catch (error) {
    console.error(`Error in POST handler:`, error);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal error" },
        id: null
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-mcp-headers, x-base-url',
    },
  });
}
