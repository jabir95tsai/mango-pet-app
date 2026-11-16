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
        <p>最後更新：2026-11-15</p>

        <p>
          Mango Pet (「本服務」) 重視您的隱私。本政策說明我們如何收集、使用、保護
          您的個人資料。使用本服務代表您同意本政策。
        </p>

        <h2>我們收集的資料</h2>
        <ul>
          <li>
            <strong>帳號資料</strong>：透過 Google、Apple 或 Email
            帳號登入時取得的姓名、Email 與頭像（若有提供）；亦提供免註冊「訪客模式（匿名登入）」，僅於本機儲存個人裝置識別與寵物／遛狗資料，綁定正式帳號後可保留資料並解鎖社群功能。
          </li>
          <li>
            <strong>寵物與健康資料</strong>：您主動輸入的寵物名字、品種、體重、健康紀錄、疫苗提醒、開銷明細等。
          </li>
          <li>
            <strong>照片或影片</strong>：您上傳的寵物頭像、散步照片、動態貼文照片及消費收據辨識圖片。
          </li>
          <li>
            <strong>使用者內容與安全紀錄</strong>：您在社群發布的動態貼文、留言、表情回應，以及檢舉或封鎖操作紀錄。
          </li>
          <li>
            <strong>位置資料</strong>：Web 版僅在您主動開啟「遛狗追蹤」或瀏覽／新增餐廳地圖時從瀏覽器取得當前位置；iOS App 版僅在您主動按下「開始遛狗」且散步進行中時使用前景與背景定位以記錄路線與距離（鎖屏時會顯示系統定位指示），一旦按下「結束」完成或取消散步即立即停止定位，我們不會在非遛狗期間於背景追蹤您的位置。
          </li>
          <li>
            <strong>裝置與推播權杖（FCM Token）</strong>：您啟用推播提醒或社群通知時自動產生的推播識別權杖。
          </li>
        </ul>

        <h2>資料用途</h2>
        <ul>
          <li>提供您要求的服務（寵物紀錄、遛狗追蹤、推播提醒、地圖等）</li>
          <li>計算家庭與好友遛狗排行榜分數</li>
          <li>顯示給您指定為「公開」、「好友」或「僅自己」可見的貼文</li>
          <li>執行不當內容自動過濾與社群檢舉審核，維護社群安全</li>
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

        <h2>您的權利與帳號刪除</h2>
        <ul>
          <li>您可隨時登入「設定」頁面查看、匯出（JSON 資料副本）或修改個人資料</li>
          <li>您可隨時刪除任何寵物、紀錄、貼文或留言</li>
          <li>
            <strong>App 內立即刪除帳號</strong>：您可隨時於「設定 → 危險區 → 刪除我的帳號」直接永久刪除帳號與所有關聯資料，無需額外來信申請；亦可來信由營運人員協助處理。
          </li>
        </ul>

        <h2>資料保留</h2>
        <p>
          您的資料保留至您主動刪除帳號或個別內容為止。停用的 FCM token 會在登出或推播失效後自動移除。
        </p>

        <h2>聯絡我們</h2>
        <p>
          維運與資料保護負責人：蔡智博
          <br />
          有任何隱私或帳號相關問題，請來信至：
          <a href="mailto:jabir95tsai@gmail.com">jabir95tsai@gmail.com</a>
        </p>
      </article>
    </main>
  );
}
