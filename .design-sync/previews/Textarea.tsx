import { FieldLabel, Textarea } from "@mango/web";

/** Empty with placeholder. */
export const Basic = () => (
  <div className="w-80">
    <Textarea rows={3} placeholder="備註（選填）" />
  </div>
);

/** Labelled, with content — the health-record notes field. */
export const WithLabel = () => (
  <div className="flex w-80 flex-col gap-1.5">
    <FieldLabel>看診紀錄</FieldLabel>
    <Textarea
      rows={4}
      defaultValue="打了狂犬病疫苗，醫生說體重維持得很好。下次回診 12 月。"
    />
  </div>
);

/** Disabled. */
export const Disabled = () => (
  <div className="w-80">
    <Textarea rows={3} disabled defaultValue="無法編輯" />
  </div>
);
