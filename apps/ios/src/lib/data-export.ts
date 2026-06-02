/**
 * Data export (P5b) — calls the exportUserData callable, writes the JSON to the
 * app Documents dir (expo-file-system), and opens the native share sheet
 * (expo-sharing). The iOS take on web's Blob-download. Same callable + payload
 * (UserDataExport) as web.
 */
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

import { exportUserData } from "./account";

/** Fetch the export, persist it as a JSON file, and share it. Returns the
 *  file uri. Throws on failure so the caller can surface a message. */
export async function exportAndShareUserData(uid: string): Promise<string> {
  const data = await exportUserData();
  const json = JSON.stringify(data, null, 2);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileUri = `${FileSystem.documentDirectory}mango-pet-data-${uid}-${stamp}.json`;
  await FileSystem.writeAsStringAsync(fileUri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: "application/json",
      dialogTitle: "Mango Pet 資料",
      UTI: "public.json",
    });
  }
  return fileUri;
}
