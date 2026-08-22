---
title: Omawrite Markdown Showcase
description: A compact tour of the Markdown elements rendered by the plugin.
tags:
  - omawrite/demo
  - markdown
---

# Omawrite Markdown Showcase

This note is a compact visual test for the Omawrite writing surface. It includes the most common Markdown building blocks without changing the source file.

## Headings and emphasis

### A smaller section heading

Text can be **strong**, *emphasized*, ~~crossed out~~, ==highlighted==, or written as `inline code`. Here is a [regular link](https://github.com/omacom-io/omawrite) next to a footnote marker[^demo].

> A quiet writing surface should make the words easier to hear.
>
> This blockquote also checks spacing, contrast, and line height.

## Lists and tasks

- First unordered item
- Second item with **bold detail**
  - Nested item
- [x] Completed task
- [ ] Open task

1. Draft the idea.
2. Revise the structure.
3. Publish the result.

## Code and a table

```ts
function describeMode(isFullScreen: boolean): string {
  return isFullScreen ? "Omawrite + fullscreen" : "Omawrite";
}
```

| Property | Example value | Why it matters |
| --- | --- | --- |
| Typeface | iA Writer Mono S | Monospaced, calm rhythm |
| Alignment | Justified | Follows the selected preview setting |
| Width | 80 characters | Keeps long lines readable |

---

## A final paragraph

The same note can be viewed in light or dark mode, in a normal Obsidian window or in native fullscreen. Omawrite changes the interface around the Markdown; the underlying note remains ordinary Markdown.

[^demo]: Footnotes are included to exercise another built-in Markdown feature.
