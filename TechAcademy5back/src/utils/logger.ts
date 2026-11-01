import { getRequestId } from "./request-context";

type LogContext = Record<string, string | number | boolean | undefined>;

export const logError = (
  message: string,
  context: LogContext = {},
  error?: unknown
): void => {
  const errorName =
    error instanceof Error ? error.name : error === undefined ? undefined : "UnknownError";

  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      message,
      requestId: getRequestId(),
      ...context,
      ...(errorName ? { error: { name: errorName } } : {}),
    })
  );
};
