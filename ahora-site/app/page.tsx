import Link from "next/link";
import ThemeToggle from "./components/ThemeToggle";

export default function Home() {
  return (
    <main>
      {/* Top bar */}
      <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-4">
        <div className="text-sm text-neutral-500 dark:text-neutral-400">Ahora</div>
        <ThemeToggle />
      </div>

      {/* Landing hero only (no dashboard on the homepage) */}
      <section className="mx-auto max-w-screen-xl px-4 py-12 md:py-20 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
          Meaningful Anonymous Chats,<br className="hidden sm:block" />
          Matched by Vibe &amp; Interest.
        </h1>
        <p className="mx-auto mt-4 max-w-[60ch] text-base text-neutral-600 dark:text-neutral-300">
          Tired of superficial swipes and boring small talk? Ahora connects you with people who
          share your mood and interests — instantly and anonymously.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            className="inline-flex h-11 items-center justify-center rounded-full border px-5 font-medium
                       border-neutral-200 bg-neutral-900 text-white
                       dark:border-neutral-800 dark:bg-white dark:text-neutral-900"
            href="#"
          >
            Join the Waitlist (Coming Soon)
          </a>
          <Link
            href="/build"
            className="inline-flex h-11 items-center justify-center rounded-full border px-5 font-medium
                       border-neutral-300 bg-white text-neutral-900
                       dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
          >
            Follow Our Journey → View Builder Diary
          </Link>
        </div>
      </section>
    </main>
  );
}