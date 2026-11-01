import { AsyncLocalStorage } from "node:async_hooks";

const requestIdContext = new AsyncLocalStorage<string>();

export const runWithRequestId = <T>(
  requestId: string,
  callback: () => T
): T => requestIdContext.run(requestId, callback);

export const getRequestId = (): string | undefined =>
  requestIdContext.getStore();
