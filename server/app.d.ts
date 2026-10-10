// Types for the mock backend core, so the browser build (src/mockServer.ts) can import it.
export type Dispatch = (req: { method: string; path: string; token?: string | null; body?: unknown }) => Promise<{ status: number; body: any }>
export function createCore(opts?: { devTools?: boolean; storageLimit?: number; load?: () => unknown; save?: (data: unknown) => void }): Dispatch
