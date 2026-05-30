import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "隱私權政策 — Mango Pet",
  description: "Mango Pet 隱私權政策。",
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto p-6 py-12">
      <Link
        href="/"
        className="text-sm text-amber-600 hover:underline mb-6 inline-block"
      >
        ← 回首頁
      </Link>
      <article className="prose prose-sm prose-zinc dark:prose-invert max-w-none">
        <h1>隱私權政策 / Privacy Policy</h1>
        <p>最後更新：2026-05-12</p>

        <p>
          Mango Pet (「本服務」) 重視您的隱私。本政策說明我們如何收集、使用、保護
          您的個人資料。使用本服務代表您同意本政策。
        </p>

        <h2>我們收集的資料</h2>
        <ul>
          <li>
            <strong>帳號資料</strong>：透過 Google / Apple / Facebook OAuth
            取得的姓名、Email、頭像。
          </li>
          <li>
            <strong>寵物資料</strong>：您主動輸入的寵物名字、品種、健康紀錄、照片等。
          </li>
          <li>
            <strong>位置資料</strong>：僅在您主動開啟「遛狗追蹤」或新增餐廳時，
            從瀏覽器取得當前位置。我們不會在背景持續追蹤。
          </li>
          <li>
            <strong>FCM token</strong>：您啟用推播時自動產生的 token，用於推送提醒。
          </li>
        </ul>

        <h2>資料用途</h2>
        <ul>
          <li>提供您要求的服務（寵物紀錄、推播提醒、地圖等）</li>
          <li>計算遛狗排行榜分數</li>
          <li>顯示給您指定為「公開」或「好友」可見的貼文</li>
        </ul>

        <h2>第三方服務</h2>
        <ul>
          <li>
            <strong>Firebase (Google)</strong>：資料儲存、認證、推播。資料儲存於
            Asia-East1 或 Asia-Northeast1 區域。
          </li>
          <li>
            <strong>Google Maps</strong>：地圖顯示與地點查詢。
          </li>
        </ul>

        <h2>您的權利</h2>
        <ul>
          <li>您可隨時登入「設定」頁面查看或修改個人資料</li>
          <li>您可隨時刪除任何寵物、紀錄、貼文</li>
          <li>若需完整刪除帳號，請來信至下方聯絡信箱</li>
        </ul>

        <h2>資料保留</h2>
        <p>
          您的資料保留至您主動刪除為止。停用的 FCM token 會在每次推播失敗後自動移除。
        </p>

        <h2>聯絡我們</h2>
        <p>
          有任何隱私相關問題，請來信至：
          <a href="mailto:jabir95tsai@gmail.com">jabir95tsai@gmail.com</a>
        </p>
      </article>
    </main>
  );
}
