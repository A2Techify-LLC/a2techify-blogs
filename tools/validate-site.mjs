#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const postsDir = path.join(root, "_posts");
const errors = [];

function fail(message) {
  errors.push(message);
}

function parseFrontMatter(source, fileName) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    fail(`${fileName}: missing or malformed front matter`);
    return { data: {}, body: source };
  }

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!pair) continue;
    const value = pair[2].trim();
    data[pair[1]] = value.startsWith("[") && value.endsWith("]")
      ? value.slice(1, -1).split(",").map((item) => item.trim().replace(/^["']|["']$/g, "")).filter(Boolean)
      : value.replace(/^["']|["']$/g, "");
  }
  return { data, body: match[2] };
}

const postFiles = fs.readdirSync(postsDir).filter((file) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(file)).sort();
const seenTitles = new Set();
const usedTags = new Set();

for (const file of postFiles) {
  const source = fs.readFileSync(path.join(postsDir, file), "utf8");
  const { data, body } = parseFrontMatter(source, file);

  for (const key of ["layout", "title", "date", "categories", "tags", "description", "image"]) {
    if (!data[key] || data[key].length === 0) fail(`${file}: required front-matter field '${key}' is missing`);
  }

  if (seenTitles.has(data.title)) fail(`${file}: duplicate title '${data.title}'`);
  seenTitles.add(data.title);

  if (data.layout && data.layout !== "post") fail(`${file}: layout must be 'post'`);
  if (!body.includes("<!--more-->")) fail(`${file}: missing excerpt separator <!--more-->`);
  if (!/^##\s+References\s*$/im.test(body)) fail(`${file}: missing References section`);

  for (const tag of Array.isArray(data.tags) ? data.tags : []) usedTags.add(tag);

  if (data.image) {
    const imagePath = path.join(root, data.image.replace(/^\//, ""));
    if (!fs.existsSync(imagePath)) fail(`${file}: image not found at ${data.image}`);
    if (!/\.(png|jpe?g|webp)$/i.test(data.image)) fail(`${file}: social image should be PNG, JPEG, or WebP`);
  }

  const draftPath = path.join(root, "linkedin-drafts", file);
  if (!fs.existsSync(draftPath)) {
    fail(`${file}: matching LinkedIn draft is missing`);
  } else {
    const draft = fs.readFileSync(draftPath, "utf8");
    if (!draft.startsWith(`# ${data.title}\n`) && !draft.startsWith(`# ${data.title}\r\n`)) {
      fail(`${file}: LinkedIn draft title is stale; regenerate the draft`);
    }
  }
}

for (const tag of usedTags) {
  const tagPage = path.join(root, "tags", tag, "index.html");
  if (!fs.existsSync(tagPage)) fail(`tag '${tag}': page is missing at tags/${tag}/index.html`);
}

const configuredImageMatch = fs.readFileSync(path.join(root, "_config.yml"), "utf8").match(/^image:\s*["']?([^"'\r\n]+)/m);
if (configuredImageMatch) {
  const configuredImage = path.join(root, configuredImageMatch[1].replace(/^\//, ""));
  if (!fs.existsSync(configuredImage)) fail(`default social image not found at ${configuredImageMatch[1]}`);
  if (!/\.(png|jpe?g|webp)$/i.test(configuredImageMatch[1])) fail("default social image should be PNG, JPEG, or WebP");
}

if (errors.length > 0) {
  console.error(`Site validation failed with ${errors.length} error${errors.length === 1 ? "" : "s"}:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Site validation passed: ${postFiles.length} posts and ${usedTags.size} topic pages checked.`);
