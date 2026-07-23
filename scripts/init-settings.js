import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const customDir = process.argv[2];
const settingsDir = customDir
  ? path.resolve(rootDir, customDir)
  : path.join(rootDir, "src/settings");
const settingsPath = path.join(settingsDir, "index.json");

/**
 * Initialize settings if they don't already exist.
 *
 * - If src/settings/index.json exists (generated, edited, or downloaded), keep it.
 * - If it doesn't exist, generate it from src/schema.ts defaults.
 *
 * To download settings from an installation:
 *   bun run download-settings <installation-name>
 *
 * To reset to schema defaults:
 *   Delete src/settings/index.json and re-run bun run dev
 */
async function initSettings() {
  // Ensure settings directory exists
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }

  // If settings already exist, keep them
  if (fs.existsSync(settingsPath)) {
    console.log("✅ Using existing settings from src/settings/index.json");
    return;
  }

  // Generate from schema defaults
  await generateFromSchema();
}

async function generateFromSchema() {
  try {
    console.log("🔨 Generating settings from schema defaults...");

    const schemaPath = path.join(rootDir, "src/schema.ts");
    const tempSchemaPath = path.join(rootDir, "build/schema.json");

    // Ensure build directory exists
    if (!fs.existsSync(path.join(rootDir, "build"))) {
      fs.mkdirSync(path.join(rootDir, "build"), { recursive: true });
    }

    // Generate schema with ts-schema
    await execFileAsync(
      "npx",
      ["ts-schema", schemaPath, path.join(rootDir, "build")],
      {
        cwd: rootDir,
      }
    );

    // Read the generated schema
    const schemaJson = JSON.parse(fs.readFileSync(tempSchemaPath, "utf-8"));

    // Extract default values from schema
    const defaults = extractDefaults(schemaJson);

    // Create settings in phystack format
    const settings = {
      app: {
        gridApp: {
          settings: defaults,
        },
      },
    };

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log("✅ Generated settings from schema defaults");
  } catch (error) {
    console.error("❌ Failed to generate settings from schema:", error.message);

    // Create minimal empty settings
    const minimalSettings = {
      app: {
        gridApp: {
          settings: {},
        },
      },
    };

    fs.writeFileSync(settingsPath, JSON.stringify(minimalSettings, null, 2));
    console.log("⚠️  Created empty settings");
  }
}

/**
 * Extract default values from JSON schema
 */
function extractDefaults(schema) {
  const defaults = {};

  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (prop.default !== undefined) {
        defaults[key] = prop.default;
      } else if (prop.type === "object" && prop.properties) {
        defaults[key] = extractDefaults(prop);
      } else if (prop.type === "array" && prop.default) {
        defaults[key] = prop.default;
      }
    }
  }

  return defaults;
}

// Run the initialization
initSettings().catch((error) => {
  console.error("❌ Settings initialization failed:", error);
  process.exit(1);
});
