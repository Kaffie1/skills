#!/usr/bin/env node

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const process = require("node:process");

const BRIDGE_DIR = __dirname;
const DAEMON_PORT = Number(process.env.DRAWIO_BRIDGE_PORT || 6131);
const DAEMON_HOST = "127.0.0.1";
const DAEMON_INFO_PATH = path.join(BRIDGE_DIR, ".daemon.json");
const DAEMON_SOCKET_PATH = path.join(BRIDGE_DIR, ".drawio-bridge.sock");
const MCP_ROOT =
  "/home/naviai/.nvm/versions/node/v20.20.2/lib/node_modules/@next-ai-drawio/mcp-server";
const LINKEDOM_CJS = path.join(MCP_ROOT, "node_modules/linkedom/cjs/index.js");

const TOOL_METADATA = [
  { name: "start_session", description: "Open browser preview and create a new draw.io session." },
  { name: "create_new_diagram", description: "Create a new diagram from full mxGraphModel XML." },
  { name: "edit_diagram", description: "Edit an existing diagram with add/update/delete operations." },
  { name: "get_diagram", description: "Fetch the latest diagram XML from the browser-backed session." },
  { name: "export_diagram", description: "Export the diagram as .drawio, .png, or .svg." },
];

const DIAGRAM_PROMPT = {
  name: "diagram-workflow",
  description: "Guidelines for creating and editing draw.io diagrams",
  messages: [
    {
      role: "user",
      content: {
        type: "text",
        text: `# Draw.io Diagram Workflow Guidelines

## Creating a New Diagram
1. Call start_session to open the browser preview
2. Use create_new_diagram with complete mxGraphModel XML to create a new diagram

## Adding Elements to Existing Diagram
1. Use edit_diagram with "add" operation
2. Provide a unique cell_id and complete mxCell XML
3. No need to call get_diagram first - the server fetches latest state automatically

## Modifying or Deleting Existing Elements
1. FIRST call get_diagram to see current cell IDs and structure
2. THEN call edit_diagram with "update" or "delete" operations
3. For update, provide the cell_id and complete new mxCell XML

## Important Notes
- create_new_diagram REPLACES the entire diagram - only use for new diagrams
- edit_diagram PRESERVES user's manual changes (fetches browser state first)
- Always use unique cell_ids when adding elements (e.g., "shape-1", "arrow-2")`,
      },
    },
  ],
};

function usage() {
  console.log(`drawio-mcp-bridge

Usage:
  drawio-mcp-bridge status
  drawio-mcp-bridge list-tools
  drawio-mcp-bridge list-prompts
  drawio-mcp-bridge get-prompt <name>
  drawio-mcp-bridge call <tool-name> [json-args]
  drawio-mcp-bridge daemon

Aliases:
  drawio-mcp-bridge start-session
  drawio-mcp-bridge create-diagram '<json>'
  drawio-mcp-bridge edit-diagram '<json>'
  drawio-mcp-bridge get-diagram
  drawio-mcp-bridge export-diagram '<json>'
`);
}

function parseJsonArg(raw) {
  if (!raw) {
    return {};
  }
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON arguments must be an object");
  }
  return parsed;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestJson(method, route, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        socketPath: DAEMON_SOCKET_PATH,
        path: route,
        method,
        headers: payload
          ? {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(payload),
            }
          : {},
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            if (res.statusCode >= 400) {
              reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
              return;
            }
            resolve(parsed);
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    req.on("error", reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function readDaemonInfo() {
  try {
    return JSON.parse(await fsp.readFile(DAEMON_INFO_PATH, "utf8"));
  } catch {
    return null;
  }
}

async function isDaemonReady() {
  try {
    await requestJson("GET", "/status");
    return true;
  } catch {
    return false;
  }
}

async function ensureDaemon() {
  if (await isDaemonReady()) {
    return;
  }

  const child = spawn(process.execPath, [__filename, "daemon"], {
    detached: true,
    stdio: "ignore",
    cwd: BRIDGE_DIR,
  });
  child.unref();

  for (let i = 0; i < 40; i += 1) {
    if (await isDaemonReady()) {
      return;
    }
    await wait(250);
  }

  const info = await readDaemonInfo();
  const detail = info ? ` pid=${info.pid}` : "";
  throw new Error(`Drawio bridge daemon did not start in time.${detail}`);
}

function printCallResult(result) {
  if (!result) {
    return;
  }
  if (result.text) {
    console.log(result.text);
  }
  if (result.data && !result.text) {
    console.log(JSON.stringify(result.data, null, 2));
  } else if (result.data && result.command === "get_diagram") {
    console.log(JSON.stringify(result.data, null, 2));
  }
}

async function runClient(command, rest) {
  switch (command) {
    case "status": {
      const ready = await isDaemonReady();
      if (!ready) {
        console.log(JSON.stringify({ ready: false, port: DAEMON_PORT }, null, 2));
        return;
      }
      const status = await requestJson("GET", "/status");
      console.log(JSON.stringify(status, null, 2));
      return;
    }
    case "list-tools":
      console.log(JSON.stringify(TOOL_METADATA, null, 2));
      return;
    case "list-prompts":
      console.log(JSON.stringify([{ name: DIAGRAM_PROMPT.name, description: DIAGRAM_PROMPT.description }], null, 2));
      return;
    case "get-prompt": {
      const [name] = rest;
      if (name !== DIAGRAM_PROMPT.name) {
        throw new Error(`Unknown prompt: ${name || "<missing>"}`);
      }
      console.log(JSON.stringify(DIAGRAM_PROMPT, null, 2));
      return;
    }
    default:
      break;
  }

  let toolName = command;
  let rawArgs = rest[0];

  if (command === "call") {
    toolName = rest[0];
    rawArgs = rest[1];
  } else if (command === "start-session") {
    toolName = "start_session";
    rawArgs = null;
  } else if (command === "create-diagram") {
    toolName = "create_new_diagram";
  } else if (command === "edit-diagram") {
    toolName = "edit_diagram";
  } else if (command === "get-diagram") {
    toolName = "get_diagram";
    rawArgs = null;
  } else if (command === "export-diagram") {
    toolName = "export_diagram";
  }

  if (!toolName) {
    throw new Error("Missing tool name");
  }

  await ensureDaemon();
  const args = parseJsonArg(rawArgs);
  const result = await requestJson("POST", "/call", { tool: toolName, arguments: args });
  printCallResult(result);
  if (result.isError) {
    process.exitCode = 2;
  }
}

async function runDaemon() {
  const { DOMParser } = require(LINKEDOM_CJS);
  globalThis.DOMParser = DOMParser;
  globalThis.XMLSerializer = class {
    serializeToString(node) {
      if (node.outerHTML !== undefined) {
        return node.outerHTML;
      }
      if (node.documentElement) {
        return node.documentElement.outerHTML;
      }
      return "";
    }
  };

  const openModule = await import(path.join(MCP_ROOT, "node_modules/open/index.js"));
  const httpServerModule = await import(path.join(MCP_ROOT, "dist/http-server.js"));
  const validationModule = await import(path.join(MCP_ROOT, "dist/xml-validation.js"));
  const operationsModule = await import(path.join(MCP_ROOT, "dist/diagram-operations.js"));
  const historyModule = await import(path.join(MCP_ROOT, "dist/history.js"));

  const open = openModule.default;
  const {
    getState,
    requestSync,
    setState,
    shutdown,
    startHttpServer,
    waitForSync,
  } = httpServerModule;
  const { validateAndFixXml } = validationModule;
  const { applyDiagramOperations } = operationsModule;
  const { addHistory } = historyModule;

  const config = {
    port: parseInt(process.env.PORT || "6002", 10),
  };

  let currentSession = null;

  async function startSession() {
    const port = await startHttpServer(config.port);
    const sessionId = `mcp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    currentSession = {
      id: sessionId,
      xml: "",
      version: 0,
      lastGetDiagramTime: 0,
    };
    const browserUrl = `http://localhost:${port}?mcp=${sessionId}`;
    await open(browserUrl);
    return {
      command: "start_session",
      text: `Session started successfully!\n\nSession ID: ${sessionId}\nBrowser URL: ${browserUrl}\n\nThe browser will now show real-time diagram updates.`,
      data: { sessionId, browserUrl },
    };
  }

  async function createNewDiagram({ xml: inputXml }) {
    if (!currentSession) {
      return { isError: true, text: "Error: No active session. Please call start_session first." };
    }
    let xml = inputXml;
    const { valid, error, fixed } = validateAndFixXml(xml);
    if (fixed) {
      xml = fixed;
    }
    if (!valid && error) {
      return { isError: true, text: `Error: XML validation failed - ${error}` };
    }
    const browserState = getState(currentSession.id);
    if (browserState && browserState.xml) {
      currentSession.xml = browserState.xml;
    }
    if (currentSession.xml) {
      addHistory(currentSession.id, currentSession.xml, browserState && browserState.svg ? browserState.svg : "");
    }
    currentSession.xml = xml;
    currentSession.version += 1;
    currentSession.lastGetDiagramTime = Date.now();
    setState(currentSession.id, xml);
    addHistory(currentSession.id, xml, "");
    return {
      command: "create_new_diagram",
      text: `Diagram content set successfully!\n\nThe diagram is now visible in your browser.\n\nXML length: ${xml.length} characters`,
    };
  }

  async function getDiagram() {
    if (!currentSession) {
      return { isError: true, text: "Error: No active session. Please call start_session first." };
    }
    const syncRequested = requestSync(currentSession.id);
    if (syncRequested) {
      await waitForSync(currentSession.id);
    }
    currentSession.lastGetDiagramTime = Date.now();
    const browserState = getState(currentSession.id);
    if (browserState && browserState.xml) {
      currentSession.xml = browserState.xml;
    }
    if (!currentSession.xml) {
      return { command: "get_diagram", text: "No diagram exists yet. Use create_new_diagram to create one." };
    }
    return {
      command: "get_diagram",
      text: `Current diagram XML:\n\n${currentSession.xml}`,
      data: { xml: currentSession.xml },
    };
  }

  async function editDiagram({ operations }) {
    if (!currentSession) {
      return { isError: true, text: "Error: No active session. Please call start_session first." };
    }
    const timeSinceGet = Date.now() - currentSession.lastGetDiagramTime;
    if (timeSinceGet > 30000) {
      return {
        isError: true,
        text:
          "Error: You must call get_diagram first before edit_diagram.\n\nThis ensures you have the latest diagram state including any manual edits the user made in the browser. Please call get_diagram, then use that XML to construct your edit operations.",
      };
    }
    const browserState = getState(currentSession.id);
    if (browserState && browserState.xml) {
      currentSession.xml = browserState.xml;
    }
    if (!currentSession.xml) {
      return {
        isError: true,
        text: "Error: No diagram to edit. Please create a diagram first with create_new_diagram.",
      };
    }
    addHistory(currentSession.id, currentSession.xml, browserState && browserState.svg ? browserState.svg : "");
    const validatedOps = operations.map((op) => {
      if (!op.new_xml) {
        return op;
      }
      const { fixed } = validateAndFixXml(op.new_xml);
      return fixed ? { ...op, new_xml: fixed } : op;
    });
    const { result, errors } = applyDiagramOperations(currentSession.xml, validatedOps);
    currentSession.xml = result;
    currentSession.version += 1;
    setState(currentSession.id, result);
    addHistory(currentSession.id, result, "");
    const warnings = errors.length
      ? `\n\nWarnings:\n${errors.map((e) => `- ${e.type} ${e.cellId}: ${e.message}`).join("\n")}`
      : "";
    return {
      command: "edit_diagram",
      text: `Diagram edited successfully!\n\nApplied ${operations.length} operation(s).${warnings}`,
      data: { warnings: errors },
    };
  }

  async function exportDiagram({ path: exportPath, format }) {
    if (!currentSession) {
      return { isError: true, text: "Error: No active session. Please call start_session first." };
    }
    const browserState = getState(currentSession.id);
    if (browserState && browserState.xml) {
      currentSession.xml = browserState.xml;
    }
    if (!currentSession.xml) {
      return { isError: true, text: "Error: No diagram to export. Please create a diagram first." };
    }
    const nodePath = path;
    const ext = nodePath.extname(exportPath).toLowerCase();
    const detectedFormat =
      format || (ext === ".png" ? "png" : ext === ".svg" ? "svg" : "drawio");

    if (detectedFormat === "drawio") {
      let filePath = exportPath;
      if (!filePath.endsWith(".drawio")) {
        filePath = `${filePath}.drawio`;
      }
      const absolutePath = nodePath.resolve(filePath);
      await fsp.writeFile(absolutePath, currentSession.xml, "utf8");
      return {
        command: "export_diagram",
        text: `Diagram exported successfully!\n\nFile: ${absolutePath}\nSize: ${currentSession.xml.length} characters`,
        data: { path: absolutePath, format: detectedFormat },
      };
    }

    let filePath = exportPath;
    if (ext !== `.${detectedFormat}`) {
      if (ext === ".drawio" || ext === ".png" || ext === ".svg") {
        filePath = filePath.slice(0, -ext.length);
      }
      filePath = `${filePath}.${detectedFormat}`;
    }
    const absolutePath = nodePath.resolve(filePath);
    const state = getState(currentSession.id);
    if (!state) {
      return { isError: true, text: "Error: Session state not found. Is the browser open?" };
    }
    state.exportFormat = detectedFormat;
    state.exportData = undefined;
    const start = Date.now();
    while (Date.now() - start < 10000) {
      if (state.exportData) {
        break;
      }
      await wait(200);
    }
    const exportData = state.exportData;
    state.exportData = undefined;
    state.exportFormat = undefined;
    if (!exportData) {
      return {
        isError: true,
        text: "Error: Export timed out. Make sure the browser tab is open and the diagram is loaded.",
      };
    }
    if (detectedFormat === "png") {
      const base64 = exportData.replace(/^data:image\/png;base64,/, "");
      await fsp.writeFile(absolutePath, Buffer.from(base64, "base64"));
    } else {
      let svgContent = exportData;
      if (svgContent.startsWith("data:image/svg+xml;base64,")) {
        const base64 = svgContent.replace(/^data:image\/svg\+xml;base64,/, "");
        svgContent = Buffer.from(base64, "base64").toString("utf8");
      }
      await fsp.writeFile(absolutePath, svgContent, "utf8");
    }
    const stat = await fsp.stat(absolutePath);
    return {
      command: "export_diagram",
      text: `Diagram exported successfully!\n\nFile: ${absolutePath}\nFormat: ${detectedFormat}\nSize: ${stat.size} bytes`,
      data: { path: absolutePath, format: detectedFormat, size: stat.size },
    };
  }

  async function invokeTool(tool, args) {
    switch (tool) {
      case "start_session":
        return startSession();
      case "create_new_diagram":
        return createNewDiagram(args);
      case "get_diagram":
        return getDiagram();
      case "edit_diagram":
        return editDiagram(args);
      case "export_diagram":
        return exportDiagram(args);
      default:
        return { isError: true, text: `Error: Unknown tool '${tool}'.` };
    }
  }

  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/status") {
      const payload = {
        ready: true,
        pid: process.pid,
        socketPath: DAEMON_SOCKET_PATH,
        session: currentSession,
      };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
      return;
    }

    if (req.method === "POST" && req.url === "/call") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", async () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const result = await invokeTool(parsed.tool, parsed.arguments || {});
          res.writeHead(result.isError ? 400 : 200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (error) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message || String(error) }));
        }
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.on("error", async (error) => {
    if (error.code === "EADDRINUSE") {
      process.exit(0);
      return;
    }
    await fsp.writeFile(path.join(BRIDGE_DIR, ".daemon-error.log"), String(error.stack || error), "utf8");
    process.exit(1);
  });

  try {
    await fsp.unlink(DAEMON_SOCKET_PATH);
  } catch {}

  server.listen(DAEMON_SOCKET_PATH, async () => {
    await fsp.writeFile(
      DAEMON_INFO_PATH,
      JSON.stringify(
        { pid: process.pid, socketPath: DAEMON_SOCKET_PATH, startedAt: new Date().toISOString() },
        null,
        2
      ),
      "utf8"
    );
  });

  const cleanup = async () => {
    try {
      await fsp.unlink(DAEMON_INFO_PATH);
    } catch {}
    try {
      await fsp.unlink(DAEMON_SOCKET_PATH);
    } catch {}
    shutdown();
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

async function main() {
  const [, , command, ...rest] = process.argv;

  if (!command || command === "-h" || command === "--help") {
    usage();
    return;
  }

  if (command === "daemon") {
    await runDaemon();
    return;
  }

  await runClient(command, rest);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error.message || String(error));
  process.exit(1);
});
