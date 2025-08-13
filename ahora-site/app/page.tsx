// app/page.tsx
import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <div className="max-w-2xl space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold">
          Meaningful Anonymous Chats, Matched by Vibe & Interest.
        </h1>
        <p className="text-lg md:text-xl text-neutral-600 dark:text-neutral-300">
          Tired of superficial swipes and boring small talk? Ahora connects you with people who share your mood and interests – instantly and anonymously.
        </p>
        <div className="space-y-2">
          {/* Replace with a real waitlist form later */}
          <button className="w-full md:w-auto bg-black dark:bg-white text-white dark:text-black font-semibold px-6 py-3 rounded-lg">
            Join the Waitlist (Coming Soon)
          </button>
          <p className="text-xs text-neutral-500">Launching Fall 2025 on Android (iOS coming soon)</p>
        </div>
        <div className="pt-8">
          <Link href="/build" className="inline-block rounded-lg border px-4 py-2 hover:border-black dark:hover:border-white transition-colors">
            Follow Our Journey → View Builder Diary
          </Link>
        </div>
      </div>
      {/* 
        TODO: Add other landing page sections here as per the content strategy:
        - Problem -> Solution
        - Key Features & Benefits
        - How It Works
        - Footer with social links
      */}
    </main>
  );
}