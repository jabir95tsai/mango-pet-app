import { FieldLabel, Input } from "@mango/web";

/** Empty with placeholder, and filled. */
export const Basic = () => (
  <div className="flex w-80 flex-col gap-3">
    <Input placeholder="寵物名字" />
    <Input defaultValue="芒果" />
  </div>
);

/** Labelled fields — FieldLabel above the input, the standard form row. */
export const WithLabel = () => (
  <div className="flex w-80 flex-col gap-4">
    <div className="flex flex-col gap-1.5">
      <FieldLabel>名字</FieldLabel>
      <Input placeholder="例如：芒果" />
    </div>
    <div className="flex flex-col gap-1.5">
      <FieldLabel>體重（公斤）</FieldLabel>
      <Input type="number" inputMode="decimal" step="0.1" defaultValue="9.4" />
    </div>
  </div>
);

/** Native input types keep the same chrome. */
export const Types = () => (
  <div className="flex w-80 flex-col gap-3">
    <Input type="date" defaultValue="2026-09-16" />
    <Input type="email" placeholder="you@example.com" />
    <Input type="search" placeholder="搜尋寵物餐廳" />
  </div>
);

/** Disabled. */
export const Disabled = () => (
  <div className="w-80">
    <Input disabled defaultValue="無法編輯" />
  </div>
);
