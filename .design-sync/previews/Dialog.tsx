import { useState } from "react";
import { Button, Dialog, FieldLabel, Input } from "@mango/web";

/** A titled bottom-sheet / centered dialog holding a short form. Closable via the X (label from next-intl "Common.close") and Escape. */
export const WithForm = () => {
  const [open, setOpen] = useState(true);
  return (
    <div className="h-[460px]">
      <Button onClick={() => setOpen(true)}>新增提醒</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="新增提醒">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>提醒名稱</FieldLabel>
            <Input placeholder="例如：狂犬病疫苗" defaultValue="心絲蟲藥" />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>日期</FieldLabel>
            <Input type="date" defaultValue="2026-10-01" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={() => setOpen(false)}>儲存</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

/** Untitled dialog — no header bar, content only (used for confirmations). */
export const Untitled = () => {
  const [open, setOpen] = useState(true);
  return (
    <div className="h-[460px]">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        打開
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <p className="text-sm text-zinc-700">要刪除「芒果」的這筆體重紀錄嗎？此動作無法復原。</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button variant="danger" onClick={() => setOpen(false)}>
            刪除
          </Button>
        </div>
      </Dialog>
    </div>
  );
};
