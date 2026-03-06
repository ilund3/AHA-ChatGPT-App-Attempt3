#!/usr/bin/env node
/**
 * Build widget HTML for each organization from the AHA template.
 * Run from project root: node "GPT Apps/build-widgets.js"
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const gptAppsDir = join(rootDir, "GPT Apps");
const templatePath = join(rootDir, "public", "aha-widget.html");
const orgsPath = join(gptAppsDir, "organizations.json");

const template = readFileSync(templatePath, "utf8");
const orgs = JSON.parse(readFileSync(orgsPath, "utf8"));

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildGetInvolvedSection(org) {
  const items = org.getInvolved
    .map(
      (item) =>
        `                <li class="org-resource-item"><span>${escapeHtml(item)}</span></li>`
    )
    .join("\n");
  return `
      <div id="support-groups-view" class="tab-view">
        <div class="tab-content">
          <div class="integrations-container">
            <div class="integrations-header">
              <h2 class="integrations-title">Get Involved</h2>
              <p class="integrations-subtitle">Ways to get involved with ${escapeHtml(org.name)}.</p>
            </div>
            <ul class="org-resource-list">
${items}
            </ul>
          </div>
        </div>
      </div>
`;
}

function buildServicesSection(org) {
  const items = org.services
    .map(
      (item) =>
        `                <li class="org-resource-item"><span>${escapeHtml(item)}</span></li>`
    )
    .join("\n");
  return `
      <div id="integrations-view" class="tab-view">
        <div class="tab-content">
          <div class="integrations-container">
            <div class="integrations-header">
              <h2 class="integrations-title">Services</h2>
              <p class="integrations-subtitle">Programs and resources from ${escapeHtml(org.name)}.</p>
            </div>
            <ul class="org-resource-list">
${items}
            </ul>
          </div>
        </div>
      </div>
`;
}

// Find section boundaries in template (use unique markers)
const supportGroupsStart = template.indexOf('<div id="support-groups-view" class="tab-view">');
const volunteerViewStart = template.indexOf('<div id="volunteer-view" class="tab-view">');
const integrationsStart = template.indexOf('<div id="integrations-view" class="tab-view">');
const donateViewStart = template.indexOf('<div id="donate-view" class="tab-view">');

if (supportGroupsStart === -1 || volunteerViewStart === -1 || integrationsStart === -1 || donateViewStart === -1) {
  console.error("Template structure changed; could not find section markers.");
  process.exit(1);
}

for (const org of orgs) {
  let html = template;

  // Theme color: replace AHA red and dark red
  html = html.replace(/#DC143C/gi, org.color);
  html = html.replace(/#b8122e/gi, org.color);

  // Org name in title and key labels
  html = html.replace(/<title>American Heart Association<\/title>/, `<title>${escapeHtml(org.name)}</title>`);
  html = html.replace(/American Heart Association widget/gi, `${org.name} widget`);
  html = html.replace(/American Heart Association's/gi, `${org.name}'s`);
  html = html.replace(/American Heart Association<\//g, `${org.name}</`);

  // Replace Get Involved section (from support-groups-view to just before volunteer-view)
  const beforeGetInvolved = html.slice(0, supportGroupsStart);
  const afterGetInvolved = html.slice(volunteerViewStart);
  html = beforeGetInvolved + buildGetInvolvedSection(org) + "\n      " + afterGetInvolved;

  // Re-find integrations start (position may have changed)
  const integrationsStart2 = html.indexOf('<div id="integrations-view" class="tab-view">');
  const donateViewStart2 = html.indexOf('<div id="donate-view" class="tab-view">');
  const beforeServices = html.slice(0, integrationsStart2);
  const afterServices = html.slice(donateViewStart2);
  html = beforeServices + buildServicesSection(org) + "\n      " + afterServices;

  // Inject CSS for org-resource-list (new sections use these classes)
  const listStyle = `
      .org-resource-list { list-style: none; padding: 0; margin: 20px 0 0 0; }
      .org-resource-item { padding: 12px 0; border-bottom: 1px solid #e5e7eb; font-family: "Montserrat", "Helvetica Neue", Arial, sans-serif; font-size: 16px; color: #1f2937; }
      .org-resource-item:last-child { border-bottom: none; }
  `;
  html = html.replace("    </style>", listStyle + "\n    </style>");

  const appDir = join(gptAppsDir, org.slug);
  const outDir = join(appDir, "public");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "widget.html"), html, "utf8");
  console.log(`Wrote ${org.slug}/public/widget.html`);

  // index.html – test page that loads the widget
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(org.name)} – Widget Test</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #f3f4f6; padding: 20px; }
    h1 { font-size: 18px; color: #374151; margin-bottom: 12px; }
    .frame-wrap { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    iframe { display: block; width: 100%; min-height: 600px; border: none; }
  </style>
</head>
<body>
  <h1>${escapeHtml(org.name)} – Widget</h1>
  <div class="frame-wrap">
    <iframe src="public/widget.html" title="${escapeHtml(org.name)} widget"></iframe>
  </div>
</body>
</html>
`;
  writeFileSync(join(appDir, "index.html"), indexHtml, "utf8");

  // resources JSON for future MCP/server use
  const resourcesDir = join(appDir, "resources");
  mkdirSync(resourcesDir, { recursive: true });
  const resourcesJson = {
    organization: org.name,
    themeColor: org.color,
    services: org.services.map((title, i) => ({ id: `service-${i + 1}`, title, category: "Services" })),
    getInvolved: org.getInvolved.map((title, i) => ({ id: `get-involved-${i + 1}`, title, category: "Get Involved" })),
  };
  writeFileSync(join(resourcesDir, `${org.slug}-resources.json`), JSON.stringify(resourcesJson, null, 2), "utf8");

  // server.js (copy template) and package.json for local run
  const serverTemplate = readFileSync(join(gptAppsDir, "server-template.js"), "utf8");
  writeFileSync(join(appDir, "server.js"), serverTemplate, "utf8");
  const packageJson = {
    name: org.slug.replace(/-/g, "_"),
    version: "0.1.0",
    description: `${org.name} ChatGPT App`,
    type: "module",
    main: "server.js",
    scripts: { start: "node server.js" },
  };
  writeFileSync(join(appDir, "package.json"), JSON.stringify(packageJson, null, 2), "utf8");
}

console.log(`Done. Built ${orgs.length} apps (widget, index.html, resources, server, package.json).`);
