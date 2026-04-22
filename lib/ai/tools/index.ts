import { makeSearchDocsTool } from "./search-docs";

export function buildTools(userId: string) {
  return {
    searchDocs: makeSearchDocsTool(userId),
  };
}

export type AppTools = ReturnType<typeof buildTools>;
