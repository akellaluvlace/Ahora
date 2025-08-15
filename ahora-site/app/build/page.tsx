// app/build/page.tsx
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { DiaryEntry } from "../lib/types";
import BuildPageClient from "./client"; // Import the co-located client component

export const dynamic = "force-static";

function loadEntries(): DiaryEntry[] {
  const dir = path.join(process.cwd(), "content", "diary");
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".mdx"));
  const entries = files.map(filename => {
    const slug = filename.replace(/\.mdx$/, "");
    const raw = fs.readFileSync(path.join(dir, filename), "utf8");
    const { data } = matter(raw);
    return { slug, ...data } as DiaryEntry;
  });
  // Sort entries by date, newest first
  return entries.sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export default function BuildPage() {
  const entries = loadEntries();

  // The Server Component now only renders the Client Component, passing data as props.
  return <BuildPageClient entries={entries} />;
}