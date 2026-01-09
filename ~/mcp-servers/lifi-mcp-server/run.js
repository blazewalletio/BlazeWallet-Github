#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import createStatelessServer from "./src/index.ts";

// Get config from environment variables
const config = {
  debug: process.env.DEBUG === "true",
  lifiApiKey: process.env.LIFI_API_KEY || "",
};

// Validate API key
if (!config.lifiApiKey) {
  console.error("Error: LIFI_API_KEY environment variable is required");
  process.exit(1);
}

// Create server
const server = createStatelessServer({ config });

// Connect to stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);

console.error("Li.Fi MCP Server running on stdio");

