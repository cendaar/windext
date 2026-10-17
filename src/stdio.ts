#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createServer } from './core/server.js'
import { MemoryStore } from './core/store.js'
const server = createServer(new MemoryStore())
await server.connect(new StdioServerTransport())
