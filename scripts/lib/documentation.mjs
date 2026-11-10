import { readdirSync } from 'node:fs';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import GithubSlugger from 'github-slugger';

const markdown = new MarkdownIt({ html: true });

export function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return markdownFiles(filename);
    }
    return entry.isFile() && entry.name.endsWith('.md') ? [filename] : [];
  });
}

export function parseMarkdown(contents) {
  const tokens = markdown.parse(contents, {});
  const slugger = new GithubSlugger();
  const anchors = new Set();
  const links = [];
  const codeBlocks = [];

  function headingText(tokens) {
    return tokens
      .map((token) => {
        if (token.children) {
          return headingText(token.children);
        }
        if (token.type === 'softbreak' || token.type === 'hardbreak') {
          return '\n';
        }
        return ['text', 'code_inline'].includes(token.type)
          ? token.content
          : '';
      })
      .join('');
  }

  function visit(token, line) {
    const target = token.attrGet('href') ?? token.attrGet('src');
    if (target !== null) {
      links.push({ target, line });
    }
    if (token.type === 'html_block' || token.type === 'html_inline') {
      const html = token.content.replace(/<!--[\s\S]*?-->/g, '');
      for (const [tag, name] of html.matchAll(/<([a-z][\w-]*)\b[^>]*>/gi)) {
        for (const [, attribute, anchor] of tag.matchAll(
          /\s(id|name)=["']([^"']+)["']/gi,
        )) {
          if (attribute.toLowerCase() === 'id' || name.toLowerCase() === 'a') {
            anchors.add(markdown.utils.unescapeAll(anchor));
          }
        }
      }
    }
    for (const child of token.children ?? []) {
      visit(child, line);
    }
  }

  for (const [index, token] of tokens.entries()) {
    const line = (token.map?.[0] ?? 0) + 1;
    if (token.type === 'heading_open') {
      anchors.add(slugger.slug(headingText(tokens[index + 1].children)));
    }
    if (token.type === 'fence') {
      const [language = '', ...options] = token.info.trim().split(/\s+/);
      codeBlocks.push({
        language: language.toLowerCase(),
        options,
        code: token.content,
        line,
      });
    }
    visit(token, line);
  }
  return { anchors, links, codeBlocks };
}
