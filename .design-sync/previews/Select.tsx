import { FieldLabel, Select } from "@mango/web";

/** Native select with the app's chrome — pet species picker. */
export const Basic = () => (
  <div className="w-80">
    <Select defaultValue="dog">
      <option value="dog">狗</option>
      <option value="cat">貓</option>
      <option value="other">其他</option>
    </Select>
  </div>
);

/** Labelled select pair, as used in the add-pet form. */
export const WithLabel = () => (
  <div className="flex w-80 flex-col gap-4">
    <div className="flex flex-col gap-1.5">
      <FieldLabel>種類</FieldLabel>
      <Select defaultValue="dog">
        <option value="dog">狗</option>
        <option value="cat">貓</option>
      </Select>
    </div>
    <div className="flex flex-col gap-1.5">
      <FieldLabel>提醒週期</FieldLabel>
      <Select defaultValue="monthly">
        <option value="once">一次</option>
        <option value="weekly">每週</option>
        <option value="monthly">每月</option>
        <option value="yearly">每年</option>
      </Select>
    </div>
  </div>
);

/** Disabled. */
export const Disabled = () => (
  <div className="w-80">
    <Select disabled defaultValue="dog">
      <option value="dog">狗</option>
    </Select>
  </div>
);
