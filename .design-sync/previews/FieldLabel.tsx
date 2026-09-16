import { FieldLabel, Input, Select, Textarea } from "@mango/web";

/** The label alone — text-xs, medium weight, muted. */
export const Basic = () => <FieldLabel>寵物名字</FieldLabel>;

/** Label above each field type — always in a `flex flex-col gap-1.5` column. */
export const WithFields = () => (
  <div className="flex w-80 flex-col gap-4">
    <div className="flex flex-col gap-1.5">
      <FieldLabel>名字</FieldLabel>
      <Input defaultValue="芒果" />
    </div>
    <div className="flex flex-col gap-1.5">
      <FieldLabel>種類</FieldLabel>
      <Select defaultValue="dog">
        <option value="dog">狗</option>
        <option value="cat">貓</option>
      </Select>
    </div>
    <div className="flex flex-col gap-1.5">
      <FieldLabel>備註</FieldLabel>
      <Textarea rows={2} placeholder="選填" />
    </div>
  </div>
);

/** Custom class — e.g. a brand-coloured label for required fields. */
export const CustomClass = () => (
  <div className="flex w-80 flex-col gap-1.5">
    <FieldLabel className="text-mango-brand-deep">生日（必填）</FieldLabel>
    <Input type="date" />
  </div>
);
