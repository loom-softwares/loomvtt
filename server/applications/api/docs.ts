/**
 * core/src/api/docs.ts
 *
 * Serves an interactive Swagger/Scalar-like OpenAPI specification page
 * documenting all available LoomVTT REST APIs.
 * Mounted at /docs in core/src/index.ts
 */

import { Router } from 'express';

export const docsRouter = Router();

// OpenAPI Specification JSON definition
const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "LoomVTT Core Engine REST API",
    version: "1.0.0",
    description: "LoomVTT developer portal documentation covering Cast CRUD, Stages control, Active Tiles, Assets management, and offline backups."
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local Core VTT Server"
    }
  ],
  paths: {
    "/api/cast": {
      "get": {
        "summary": "List all Cast Members",
        "description": "Returns a list of all characters and tokens in the database.",
        "responses": {
          "200": { "description": "Successful retrieval of Cast Members." }
        }
      },
      "post": {
        "summary": "Create a Cast Member",
        "description": "Registers a new character/token in the database.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["name"],
                "properties": {
                  "name": { "type": "string" },
                  "kind": { "type": "string" },
                  "x": { "type": "integer", "default": 0 },
                  "y": { "type": "integer", "default": 0 },
                  "colorHex": { "type": "string" }
                }
              }
            }
          }
        },
        "responses": {
          "201": { "description": "Cast member created successfully." }
        }
      }
    },
    "/api/stages": {
      "get": {
        "summary": "List all Stages",
        "description": "Returns a list of all scenes/stages.",
        "responses": {
          "200": { "description": "Successful retrieval of Stages." }
        }
      },
      "post": {
        "summary": "Create a Stage",
        "description": "Registers a new stage in the database.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["name"],
                "properties": {
                  "name": { "type": "string" }
                }
              }
            }
          }
        },
        "responses": {
          "201": { "description": "Stage created successfully." }
        }
      }
    },
    "/api/tiles": {
      "get": {
        "summary": "List all Active Tiles",
        "description": "Returns a list of all Monk's Active Tiles triggers configured on the stage.",
        "responses": {
          "200": { "description": "Successful retrieval." }
        }
      }
    },
    "/api/export/offline": {
      "get": {
        "summary": "Export Standalone Guild Log",
        "description": "Downloads a single self-contained HTML page package containing all character records for offline usage.",
        "responses": {
          "200": { "description": "File download initiated." }
        }
      }
    }
  }
};

// GET /docs — Renders interactive Swagger UI/Scalar mock page
docsRouter.get('/', (_req, res) => {
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LoomVTT — REST API Docs & Reference</title>
  <!-- Load Scalar Elements styling -->
  <style>
    body {
      margin: 0;
      background-color: #0f111a;
      color: #f3f4f6;
      font-family: system-ui, -apple-system, sans-serif;
    }
    header {
      background: #151824;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      padding: 20px 40px;
    }
    header h1 {
      margin: 0;
      font-size: 1.5rem;
      background: linear-gradient(135deg, #a5b4fc, #6366f1);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    main {
      padding: 40px;
      max-width: 1100px;
      margin: 0 auto;
    }
    .endpoint-card {
      background: #151824;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      margin-bottom: 20px;
      overflow: hidden;
    }
    .endpoint-header {
      padding: 15px 20px;
      display: flex;
      align-items: center;
      gap: 15px;
      cursor: pointer;
      background: rgba(255, 255, 255, 0.02);
    }
    .method-tag {
      font-size: 0.75rem;
      font-weight: bold;
      padding: 4px 8px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .method-tag.get { background: #10b981; color: #fff; }
    .method-tag.post { background: #3b82f6; color: #fff; }
    .path-label {
      font-family: monospace;
      font-weight: bold;
    }
    .endpoint-details {
      padding: 20px;
      border-top: 1px solid rgba(255,255,255,0.08);
      font-size: 0.9rem;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <header style="display: flex; justify-content: space-between; align-items: center;">
    <h1>LoomVTT API Reference Portal</h1>
    <a href="/docs/js" style="background: #6366f1; color: #fff; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 0.85rem; font-weight: bold;">
      <i class="fa-solid fa-code"></i> Client JS SDK reference
    </a>
  </header>
  <main>
    <h2>LoomVTT Engine OpenAPI 3.0 Specs</h2>
    <p style="color: #9ca3af; margin-bottom: 30px;">
      Interactive reference docs for game master tools, stage coordinate logic, active tiles, and addon hooks mapping.
    </p>

    <div class="endpoints-list">
      ${Object.entries(openApiSpec.paths).map(([path, pathData]) => {
        return Object.entries(pathData).map(([method, details]: [string, any]) => `
          <div class="endpoint-card">
            <div class="endpoint-header">
              <span class="method-tag ${method}">${method}</span>
              <span class="path-label">${path}</span>
              <span style="margin-left: auto; color: #6b7280; font-size: 0.85rem;">${details.summary}</span>
            </div>
            <div class="endpoint-details">
              <p>${details.description}</p>
              <h4 style="color: #f3f4f6; margin-top: 15px; margin-bottom: 5px;">Response States</h4>
              <ul>
                <li><strong>200 / 201:</strong> Success.</li>
                <li><strong>500:</strong> Core server processing error.</li>
              </ul>
            </div>
          </div>
        `).join('');
      }).join('')}
    </div>
  </main>
</body>
</html>`;

  res.send(htmlContent);
});
