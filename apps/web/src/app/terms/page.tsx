import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "服務條款 — Mango Pet",
  description: "Mango Pet 服務條款。",
};

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto p-6 py-12">
      <Link
        href="/"
        className="text-sm text-amber-600 hover:underline mb-6 inline-block"
      >
        ← 回首頁
      </Link>
      <article className="prose prose-sm prose-zinc dark:prose-invert max-w-none">
        <h1>服務條款 / Terms of Service</h1>
        <p>最後更新：2026-11-15</p>

        <h2>1. 接受條款</h2>
        <p>使用 Mango Pet 即代表您同意這些條款。</p>

        <h2>2. 使用條件</h2>
        <ul>
          <li>您需年滿 13 歲或在監護人同意下使用</li>
          <li>禁止發布暴力、色情、騷擾、違法或侵權內容</li>
          <li>禁止冒用他人身分或假裝代表他人寵物</li>
          <li>禁止濫用 API 或大量自動化請求</li>
        </ul>

        <h2>3. 使用者內容與社群守則（零容忍政策）</h2>
        <p>
          您保留對自己內容的所有權，但授權我們在本服務範圍內顯示、儲存、傳輸
          您的內容（例如把公開貼文顯示給其他使用者）。
        </p>
        <p>
          <strong>我們對違規內容與使用者採零容忍態度</strong>
          （暴力、色情、騷擾、仇恨言論、違法或侵權內容一律不允許），並透過三層機制執行審核：
        </p>
        <ul>
          <li>
            <strong>發文／留言前自動過濾</strong>：系統於送出貼文或留言前會自動攔截包含辱罵、仇恨言論、色情猥褻、暴力或違法招攬之不當字詞。
          </li>
          <li>
            <strong>使用者檢舉與即時封鎖</strong>：每則他人貼文與留言右上角「⋯」選單皆提供「檢舉」與「封鎖」功能。封鎖後雙向立即隱藏互動與內容（可於設定頁管理已封鎖清單）；同一內容達 3 人檢舉即自動隱藏下架。
          </li>
          <li>
            <strong>專人審核與 24 小時處置承諾</strong>：所有檢舉皆會通知社群審核負責人（蔡智博，
            <a href="mailto:jabir95tsai@gmail.com">jabir95tsai@gmail.com</a>
            ），我們承諾於 <strong>24 小時內</strong> 完成人工審核、移除違規內容並對違規帳號採取停權或終止服務處置。
          </li>
        </ul>

        <h2>4. 餐廳資訊免責</h2>
        <p>
          餐廳資訊（寵物友善程度、營業狀況）由使用者提供，本服務不保證準確性。
          請以餐廳實際營運為準。
        </p>

        <h2>5. 醫療免責</h2>
        <p>
          知識庫文章僅供參考，不構成獸醫專業建議。您的寵物若有健康問題，
          請務必諮詢合格獸醫。
        </p>

        <h2>6. 服務變更與終止</h2>
        <p>
          我們可能隨時修改、暫停或終止服務。如需停權或刪除您的帳號，
          會透過 email 通知。
        </p>

        <h2>7. 責任限制</h2>
        <p>
          本服務按「現況」提供，不對因使用本服務造成的任何直接或間接損失負責，
          包含但不限於資料遺失、無法使用、與第三方互動造成的損失。
        </p>

        <h2>8. 聯絡方式與客服</h2>
        <p>
          營運與社群審核負責人：蔡智博
          <br />
          有任何服務問題、帳號協助或違規內容申訴，請來信至：
          <a href="mailto:jabir95tsai@gmail.com">jabir95tsai@gmail.com</a>
        </p>
      </article>
    </main>
  );
}
