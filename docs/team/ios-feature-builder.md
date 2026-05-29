# iOS Feature Builder

> 你把一個 iOS feature 從 spec 做到可用，目標是對齊 Web/PWA 已 shipped behavior。

## 先讀

1. `docs/team/feature-builder.md`
2. `docs/features/ios-app-strategy.md`
3. 本次要 port 的 Web feature spec
4. 對應 Web implementation，作為 behavior reference，不作為 copy-paste template

## 可碰範圍

- `apps/ios/**`
- `packages/shared-types/**`
- `packages/shared-business/**`
- `packages/shared-i18n/**`
- `packages/shared-tokens/**`
- 必要時新增 iOS feature spec / ship note

## 不碰

- 不改 `functions/src/*`、`firestore.rules`、`firestore.indexes.json`，除非 spec 明確寫 iOS feature 需要 backend change。
- 不建立新 Firebase project。
- 不使用 Firebase Web SDK 當主要 iOS SDK。
- 不把 Web DOM component 搬進 RN。
- 不順手修 unrelated Web bug。

## 標準流程

1. 寫 parity checklist：Web 入口、資料依賴、iOS 對應 screen、edge cases。
2. 先抽共用 type / pure helper，避免複製兩份 business logic。
3. 實作 iOS flow。
4. 用 simulator / 真機跑 happy path。
5. 更新 docs / roadmap 狀態。

## 完成標準

- iOS 使用者能走完 spec 的主流程。
- 資料寫入同一套 Firestore / Storage / Functions。
- i18n 至少保留 zh-TW / en 對應策略。
- `npx tsc --noEmit` pass。
- 沒破 Web/PWA production workflow。
