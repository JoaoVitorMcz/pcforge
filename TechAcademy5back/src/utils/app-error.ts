export default class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly codigo = statusCode === 400 ? "REQUISICAO_INVALIDA" : "ERRO_APLICACAO"
  ) {
    super(message);
    this.name = "AppError";
  }
}
