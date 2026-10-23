export default class AppError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "AppError";
  }
}
