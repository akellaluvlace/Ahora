// app/lib/types.ts

// A single item within a section list (e.g., progress, dev)
// Can be a simple string or a rich object with more data.
export type Bullet =
  | string
  | {
      text: string;
      img?: string;
      link?: string;
      code?: string;
      lang?: string;
    };

// The complete shape of a single diary entry from your MDX files.
export type DiaryEntry = {
  // Required properties from front-matter
  slug: string;
  title: string;
  date: string;

  // Optional properties from front-matter
  mood?: string;
  progress?: Bullet[];
  dev?: Bullet[];
  social?: Bullet[];
  personal?: Bullet[];
  discussion?: {
    x?: string;
    linkedin?: string;
    reddit?: string;
  };
  // The component expects `entry.metrics`, but the data loader
  // doesn't add it. Let's make it optional.
  metrics?: { [k: string]: number };
};