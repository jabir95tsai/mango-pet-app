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
        className="h-10 px-5 rounded-full bg-amber-500 text-white text-sm font-medium flex items-center hover:bg-amber-600"
      >
        回首頁
      </Link>
    </main>
  );
}
