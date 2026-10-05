// Shared query shape for the Web and native Firestore feed adapters.
export const FRIEND_POST_VISIBILITIES = ["friends", "public"] as const;

// Firestore expands the two `in` filters into authorCount * visibilityCount
// disjunctions, with a limit of 30 (not 30 values independently per filter).
// https://firebase.google.com/docs/firestore/query-data/queries#query_limitations
const FRIEND_AUTHORS_PER_QUERY = Math.floor(30 / FRIEND_POST_VISIBILITIES.length);

export function friendPostAuthorChunks(friendUids: readonly string[]): string[][] {
  const uniqueUids = [...new Set(friendUids)];
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueUids.length; i += FRIEND_AUTHORS_PER_QUERY) {
    chunks.push(uniqueUids.slice(i, i + FRIEND_AUTHORS_PER_QUERY));
  }
  return chunks;
}
