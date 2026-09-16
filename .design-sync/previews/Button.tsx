import { Button } from "@mango/web";
import { Plus, Footprints } from "lucide-react";

/** The four variants side by side — `primary` is the raised mango gradient (.btn-mango, white text). */
export const Variants = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button variant="primary">新增寵物</Button>
    <Button variant="secondary">編輯</Button>
    <Button variant="ghost">取消</Button>
    <Button variant="danger">刪除</Button>
  </div>
);

/** Size axis on the primary variant. */
export const Sizes = () => (
  <div className="flex flex-wrap items-end gap-3">
    <Button size="sm">小按鈕</Button>
    <Button size="md">中按鈕</Button>
    <Button size="lg">大按鈕</Button>
  </div>
);

/** Leading icons — the gap-2 flex layout spaces a lucide icon and label. */
export const WithIcon = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button>
      <Plus className="size-4" />
      新增提醒
    </Button>
    <Button variant="secondary" size="lg">
      <Footprints className="size-5" />
      開始遛狗
    </Button>
  </div>
);

/** Disabled state (opacity-70, no press scale). */
export const Disabled = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button disabled>儲存中…</Button>
    <Button variant="secondary" disabled>編輯</Button>
    <Button variant="danger" disabled>刪除</Button>
  </div>
);

/** Full-width CTA as used at the bottom of forms (`className="w-full"`). */
export const FullWidth = () => (
  <div className="w-80">
    <Button size="lg" className="w-full">
      儲存
    </Button>
  </div>
);
