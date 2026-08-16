#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const postsDir = path.join(root, "_posts");
const draftsDir = path.join(root, "linkedin-drafts");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  return trimmed.replace(/^["']|["']$/g, "");
}

function parseFrontMatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { data: {}, body: source };
  }

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (pair) {
      data[pair[1]] = parseScalar(pair[2]);
    }
  }

  return { data, body: match[2] };
}

function parseSiteConfig() {
  const configPath = path.join(root, "_config.yml");
  if (!fs.existsSync(configPath)) {
    return {};
  }

  const config = {};
  for (const line of read(configPath).split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (pair) {
      config[pair[1]] = parseScalar(pair[2]);
    }
  }
  return config;
}

function postUrl(config, fileName) {
  const match = fileName.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/);
  if (!match) {
    return "";
  }
  const [, year, month, day, slug] = match;
  const siteUrl = String(config.url || "").replace(/\/$/, "");
  const baseUrl = String(config.baseurl || "").replace(/\/$/, "");
  return `${siteUrl}${baseUrl}/${year}/${month}/${day}/${slug}/`;
}

function stripMarkdown(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\[[^\]]+\]\(([^)]+)\)/g, "$1")
    .replace(/^[\s>*-]+/gm, "")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstSentence(text, maxLength = 210) {
  const clean = stripMarkdown(text);
  if (clean.length <= maxLength) {
    return clean;
  }
  const sentence = clean.match(/^(.+?[.!?])\s/);
  if (sentence && sentence[1].length <= maxLength) {
    return sentence[1];
  }
  const clipped = clean.slice(0, maxLength - 4);
  const wordBoundary = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, wordBoundary > 120 ? wordBoundary : clipped.length).trim()}...`;
}

function sectionBodies(body) {
  const sections = [];
  const regex = /^##\s+(.+)$/gm;
  const matches = [...body.matchAll(regex)];

  for (let index = 0; index < matches.length; index += 1) {
    const title = matches[index][1].trim();
    const start = matches[index].index + matches[index][0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : body.length;
    sections.push({ title, body: body.slice(start, end).trim() });
  }

  return sections;
}

function paragraphs(markdown) {
  return markdown
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith("#") && !part.startsWith("```") && !part.startsWith("- ["));
}

function takeaways(body) {
  const preferred = new Set([
    "What Happened",
    "Why It Matters",
    "How The Technology Works",
    "What To Watch Next"
  ]);

  return sectionBodies(body)
    .filter((section) => preferred.has(section.title))
    .map((section) =>
      paragraphs(section.body).find((paragraph) => {
        const clean = stripMarkdown(paragraph);
        return clean.length > 80 && !/companion repo is/i.test(clean);
      })
    )
    .filter(Boolean)
    .map((text) => firstSentence(text, 190))
    .slice(0, 5);
}

function draftForPost(postPath, config) {
  const source = read(postPath);
  const { data, body } = parseFrontMatter(source);
  const fileName = path.basename(postPath);
  const url = postUrl(config, fileName);
  const date = fileName.slice(0, 10);
  const slug = fileName.slice(11).replace(/\.md$/, "");
  const title = data.title || slug.replace(/-/g, " ");
  const intro = data.description || firstSentence(paragraphs(body)[0] || "");
  const bullets = takeaways(body);
  const tags = Array.isArray(data.tags) ? data.tags.join(", ") : data.tags || "";

  const lines = [
    `# ${title}`,
    "",
    "LinkedIn newsletter draft for A2Techify Notes.",
    "",
    `Source post: ${url}`,
    "LinkedIn URL: TODO after publishing",
    "",
    "## Newsletter Title",
    "",
    title,
    "",
    "## Intro",
    "",
    intro,
    "",
    "## Takeaways",
    ""
  ];

  for (const bullet of bullets) {
    lines.push(`- ${bullet}`);
  }

  if (data.sample_repo) {
    lines.push("", "## Example Code", "", data.sample_repo);
  }

  lines.push(
    "",
    "## CTA",
    "",
    `Read the full note: ${url}`,
    "",
    "## Publishing Notes",
    "",
    "- Publish manually from the A2Techify LinkedIn Page newsletter editor.",
    "- After publishing, add the LinkedIn newsletter URL to the source post front matter as `linkedin_url`.",
    "- Keep the blog post as the canonical article.",
    ""
  );

  if (tags) {
    lines.push(`Topics: ${tags}`, "");
  }

  return { date, slug, content: `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}` };
}

function postFilesFromArgs() {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    return args
      .map((arg) => path.resolve(root, arg))
      .filter((filePath) => filePath.includes(`${path.sep}_posts${path.sep}`))
      .filter((filePath) => fs.existsSync(filePath) && filePath.endsWith(".md"));
  }

  return fs
    .readdirSync(postsDir)
    .filter((fileName) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(fileName))
    .map((fileName) => path.join(postsDir, fileName));
}

fs.mkdirSync(draftsDir, { recursive: true });

const config = parseSiteConfig();
const postFiles = postFilesFromArgs();

for (const postPath of postFiles) {
  const draft = draftForPost(postPath, config);
  const outputPath = path.join(draftsDir, `${draft.date}-${draft.slug}.md`);
  fs.writeFileSync(outputPath, draft.content, "utf8");
  console.log(`created ${path.relative(root, outputPath)}`);
}
