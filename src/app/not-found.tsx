import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 gap-6 text-center">
      <span className="text-6xl" role="img" aria-label="lost">
        🥭🐾
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">頁面走丟了</h1>
        <p className="text-sm text-zinc-500">這個網址找不到任何寵物。</p>
      </div>
      <Link
        href="/"
        className="flex h-10 items-center rounded-lg bg-amber-500 px-5 text-sm font-medium text-white hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      >
        回首頁
      </Link>
    </main>
  );
}
