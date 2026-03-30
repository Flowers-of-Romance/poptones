/**
 * Translate Japanese posts to English using Claude API via Claude Code's `claude` CLI.
 * Run: deno run -A scripts/translate.ts [--force]
 * --force: Re-translate even if English version exists
 */

const POSTS_DIR = "./posts";
const EN_DIR = "./posts/en";
const force = Deno.args.includes("--force");

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function translate(jaPath: string, enPath: string) {
  const content = await Deno.readTextFile(jaPath);

  // Parse frontmatter
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!fmMatch) {
    console.log(`  Skipping (no frontmatter): ${jaPath}`);
    return;
  }
  const frontmatter = fmMatch[1];
  const body = content.slice(fmMatch[0].length);

  // Extract title
  const titleMatch = frontmatter.match(/title:\s*(.+)/);
  const jaTitle = titleMatch ? titleMatch[1].trim() : "";

  // Build prompt
  const prompt = `Translate this Japanese blog post to English. Rules:
- Translate naturally, not literally. Adapt idioms and cultural references.
- Keep all markdown formatting, HTML tags, and code blocks exactly as-is.
- Keep proper nouns (model names like Gemma3, Llama3, tool names like ollama, MeCab) unchanged.
- Keep technical terms (DPO, SFT, RLHF, em dash, etc.) unchanged.
- Translate the title too and output it on the first line as: TITLE: <translated title>
- Do NOT add any explanation or commentary. Output only the translated text.
- For quotes from films (Pulp Fiction etc.), use the original English dialogue.

Title: ${jaTitle}

---

${body}`;

  // Call claude CLI in print mode
  const cmd = new Deno.Command("claude", {
    args: ["-p", prompt],
    stdout: "piped",
    stderr: "piped",
  });

  console.log(`  Translating...`);
  const result = await cmd.output();

  if (!result.success) {
    const err = new TextDecoder().decode(result.stderr);
    console.error(`  Error: ${err}`);
    return;
  }

  const output = new TextDecoder().decode(result.stdout).trim();

  // Extract translated title
  let enTitle = jaTitle;
  let enBody = output;
  const titleLineMatch = output.match(/^TITLE:\s*(.+)\n/);
  if (titleLineMatch) {
    enTitle = titleLineMatch[1].trim();
    enBody = output.slice(titleLineMatch[0].length).trim();
  }

  // Get slug for language switcher link
  const slug = jaPath.split(/[/\\]/).pop()!.replace(/\.md$/, "");

  // Build English frontmatter
  const enFrontmatter = frontmatter
    .replace(/title:\s*.+/, `title: ${enTitle}`)
    + `\nlang: en`;

  // Add language switcher at top of body
  const langSwitch = `<div class="lang-switch"><a href="/poptones/posts/${slug}/">日本語</a></div>\n\n`;

  const enContent = `---\n${enFrontmatter}\n---\n\n${langSwitch}${enBody}\n`;

  await Deno.writeTextFile(enPath, enContent);
  console.log(`  Done: ${enPath}`);

  // Add language switcher to Japanese version if not already there
  const jaContent = await Deno.readTextFile(jaPath);
  if (!jaContent.includes("lang-switch")) {
    const jaLangSwitch = `<div class="lang-switch"><a href="/poptones/posts/en/${slug}/">English</a></div>\n`;
    // Insert after post-note or post-meta
    let updated = jaContent;
    const insertPoint = jaContent.match(/<\/p>\s*\n/);
    if (insertPoint && insertPoint.index !== undefined) {
      const pos = insertPoint.index + insertPoint[0].length;
      // Find the second </p> or after post-note
      const noteMatch = jaContent.match(/<p class="post-note">[\s\S]*?<\/p>\s*\n/);
      if (noteMatch && noteMatch.index !== undefined) {
        const noteEnd = noteMatch.index + noteMatch[0].length;
        updated = jaContent.slice(0, noteEnd) + "\n" + jaLangSwitch + "\n" + jaContent.slice(noteEnd);
      }
    }
    if (updated !== jaContent) {
      await Deno.writeTextFile(jaPath, updated);
      console.log(`  Added English link to: ${jaPath}`);
    }
  }
}

// Main
console.log(force ? "Force mode: re-translating all posts" : "Translating new posts only");

await Deno.mkdir(EN_DIR, { recursive: true });

for await (const entry of Deno.readDir(POSTS_DIR)) {
  if (!entry.isFile || !entry.name.endsWith(".md")) continue;
  if (entry.name.includes("コピー")) continue;

  const jaPath = `${POSTS_DIR}/${entry.name}`;
  const enPath = `${EN_DIR}/${entry.name}`;

  console.log(`\n${entry.name}:`);

  if (!force && await exists(enPath)) {
    console.log("  Already translated, skipping");
    continue;
  }

  await translate(jaPath, enPath);

  // Rate limit: wait between translations
  await new Promise((r) => setTimeout(r, 2000));
}

console.log("\nAll done.");
