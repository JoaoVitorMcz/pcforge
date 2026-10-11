import { NextFunction, Request, RequestHandler, Response } from "express";
import AppError from "./app-error";

type Parser<T> = (body: unknown) => T;

export interface ProdutoCriacaoDTO {
  nome: string;
  descricao?: string | null;
  valor: number;
  id_categoria?: number | null;
  imagem?: string | null;
  destaque?: boolean;
  estoque?: number;
}

export type ProdutoAtualizacaoDTO = Partial<ProdutoCriacaoDTO>;

export interface ClienteCriacaoDTO {
  nome: string;
  email: string;
  senha: string;
  cpf: string;
  telefone?: string | null;
  admin?: boolean;
}

export interface ClienteAtualizacaoDTO {
  nome: string;
  telefone: string;
  cpf: string;
  email?: string;
  senha?: string;
  admin?: boolean;
  ativo?: boolean;
}

export interface ClienteRespostaDTO {
  id_cliente: number;
  nome: string;
  email: string;
  telefone: string | null;
  cpf: string | null;
  ativo: boolean;
  admin: boolean;
}

type ClienteRespostaOrigem = Omit<ClienteRespostaDTO, "telefone" | "cpf"> &
  Partial<Pick<ClienteRespostaDTO, "telefone" | "cpf">>;

export const mapearClienteResposta = (
  cliente: ClienteRespostaOrigem
): ClienteRespostaDTO => ({
  id_cliente: cliente.id_cliente,
  nome: cliente.nome,
  email: cliente.email,
  telefone: cliente.telefone ?? null,
  cpf: cliente.cpf ?? null,
  ativo: cliente.ativo,
  admin: cliente.admin,
});

export interface PedidoCriacaoDTO {
  id_endereco_entrega: number;
  itens: Array<{ id_produto: number; quantidade: number }>;
  id_cliente?: number;
  metodo?: string | null;
}

export interface PedidoAtualizacaoDTO {
  status: string;
  data_pagamento?: string | null;
}

const validarObjeto = (body: unknown): Record<string, unknown> => {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError(400, "O corpo da requisição deve ser um objeto JSON.");
  }
  return body as Record<string, unknown>;
};

const textoObrigatorio = (objeto: Record<string, unknown>, campo: string): void => {
  if (typeof objeto[campo] !== "string" || objeto[campo].trim().length === 0) {
    throw new AppError(400, `O campo ${campo} deve ser um texto não vazio.`);
  }
};

const numeroPositivo = (valor: unknown): boolean =>
  typeof valor === "number" && Number.isFinite(valor) && valor > 0;

const inteiroPositivo = (valor: unknown): boolean =>
  typeof valor === "number" && Number.isInteger(valor) && valor > 0;

export const validarCriacaoProduto: Parser<ProdutoCriacaoDTO> = (body) => {
  const entrada = validarObjeto(body);
  textoObrigatorio(entrada, "nome");
  const valor = Number(entrada.valor);
  if (!numeroPositivo(valor)) {
    throw new AppError(400, "O campo valor deve ser um número positivo.");
  }
  if (entrada.estoque !== undefined && (!Number.isInteger(Number(entrada.estoque)) || Number(entrada.estoque) < 0)) {
    throw new AppError(400, "O campo estoque deve ser um inteiro não negativo.");
  }
  if (entrada.destaque !== undefined && typeof entrada.destaque !== "boolean") {
    throw new AppError(400, "O campo destaque deve ser booleano.");
  }
  if (entrada.id_categoria !== undefined && entrada.id_categoria !== null && !inteiroPositivo(Number(entrada.id_categoria))) {
    throw new AppError(400, "O campo id_categoria deve ser um número positivo.");
  }
  if (entrada.descricao !== undefined && entrada.descricao !== null && typeof entrada.descricao !== "string") {
    throw new AppError(400, "O campo descricao deve ser texto.");
  }
  if (entrada.imagem !== undefined && entrada.imagem !== null && typeof entrada.imagem !== "string") {
    throw new AppError(400, "O campo imagem deve ser texto.");
  }

  return {
    nome: (entrada.nome as string).trim(),
    valor,
    ...(entrada.descricao !== undefined ? { descricao: entrada.descricao as string | null } : {}),
    ...(entrada.id_categoria !== undefined ? { id_categoria: entrada.id_categoria === null ? null : Number(entrada.id_categoria) } : {}),
    ...(entrada.imagem !== undefined ? { imagem: entrada.imagem as string | null } : {}),
    ...(entrada.destaque !== undefined ? { destaque: entrada.destaque as boolean } : {}),
    ...(entrada.estoque !== undefined ? { estoque: Number(entrada.estoque) } : {}),
  };
};

export const validarAtualizacaoProduto: Parser<ProdutoAtualizacaoDTO> = (body) => {
  const entrada = validarObjeto(body);
  if (Object.keys(entrada).length === 0) {
    throw new AppError(400, "Informe ao menos um campo para atualizar o produto.");
  }
  if (entrada.nome !== undefined && (typeof entrada.nome !== "string" || !entrada.nome.trim())) {
    throw new AppError(400, "O campo nome deve ser um texto não vazio.");
  }
  if (entrada.valor !== undefined && !numeroPositivo(Number(entrada.valor))) {
    throw new AppError(400, "O campo valor deve ser um número positivo.");
  }
  if (entrada.estoque !== undefined && (!Number.isInteger(Number(entrada.estoque)) || Number(entrada.estoque) < 0)) {
    throw new AppError(400, "O campo estoque deve ser um inteiro não negativo.");
  }
  if (entrada.destaque !== undefined && typeof entrada.destaque !== "boolean") {
    throw new AppError(400, "O campo destaque deve ser booleano.");
  }
  if (entrada.id_categoria !== undefined && entrada.id_categoria !== null && !inteiroPositivo(Number(entrada.id_categoria))) {
    throw new AppError(400, "O campo id_categoria deve ser um número positivo.");
  }
  if (entrada.descricao !== undefined && entrada.descricao !== null && typeof entrada.descricao !== "string") {
    throw new AppError(400, "O campo descricao deve ser texto.");
  }
  if (entrada.imagem !== undefined && entrada.imagem !== null && typeof entrada.imagem !== "string") {
    throw new AppError(400, "O campo imagem deve ser texto.");
  }

  return {
    ...(entrada.nome !== undefined ? { nome: (entrada.nome as string).trim() } : {}),
    ...(entrada.valor !== undefined ? { valor: Number(entrada.valor) } : {}),
    ...(entrada.descricao !== undefined ? { descricao: entrada.descricao as string | null } : {}),
    ...(entrada.id_categoria !== undefined ? { id_categoria: entrada.id_categoria === null ? null : Number(entrada.id_categoria) } : {}),
    ...(entrada.imagem !== undefined ? { imagem: entrada.imagem as string | null } : {}),
    ...(entrada.destaque !== undefined ? { destaque: entrada.destaque as boolean } : {}),
    ...(entrada.estoque !== undefined ? { estoque: Number(entrada.estoque) } : {}),
  };
};

export const validarCriacaoCliente: Parser<ClienteCriacaoDTO> = (body) => {
  const entrada = validarObjeto(body);
  for (const campo of ["nome", "email", "senha", "cpf"]) {
    textoObrigatorio(entrada, campo);
  }
  if (typeof entrada.email === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entrada.email)) {
    throw new AppError(400, "E-mail inválido.");
  }
  if (entrada.telefone !== undefined && entrada.telefone !== null && typeof entrada.telefone !== "string") {
    throw new AppError(400, "O campo telefone deve ser texto.");
  }
  if (entrada.admin !== undefined && typeof entrada.admin !== "boolean") {
    throw new AppError(400, "O campo admin deve ser booleano.");
  }

  return {
    nome: (entrada.nome as string).trim(),
    email: (entrada.email as string).trim(),
    senha: entrada.senha as string,
    cpf: entrada.cpf as string,
    ...(entrada.telefone !== undefined ? { telefone: entrada.telefone as string | null } : {}),
    ...(entrada.admin !== undefined ? { admin: entrada.admin as boolean } : {}),
  };
};

export const validarAtualizacaoCliente: Parser<ClienteAtualizacaoDTO> = (body) => {
  const entrada = validarObjeto(body);
  for (const campo of ["nome", "telefone", "cpf"]) {
    textoObrigatorio(entrada, campo);
  }
  if (entrada.email !== undefined && typeof entrada.email !== "string") {
    throw new AppError(400, "O campo email deve ser texto.");
  }
  if (entrada.senha !== undefined && typeof entrada.senha !== "string") {
    throw new AppError(400, "O campo senha deve ser texto.");
  }
  if (entrada.admin !== undefined && typeof entrada.admin !== "boolean") {
    throw new AppError(400, "O campo admin deve ser booleano.");
  }
  if (entrada.ativo !== undefined && typeof entrada.ativo !== "boolean") {
    throw new AppError(400, "O campo ativo deve ser booleano.");
  }

  return {
    nome: (entrada.nome as string).trim(),
    telefone: entrada.telefone as string,
    cpf: entrada.cpf as string,
    ...(entrada.email !== undefined ? { email: entrada.email as string } : {}),
    ...(entrada.senha !== undefined ? { senha: entrada.senha as string } : {}),
    ...(entrada.admin !== undefined ? { admin: entrada.admin as boolean } : {}),
    ...(entrada.ativo !== undefined ? { ativo: entrada.ativo as boolean } : {}),
  };
};

export const validarCriacaoPedido: Parser<PedidoCriacaoDTO> = (body) => {
  const entrada = validarObjeto(body);
  if (!inteiroPositivo(Number(entrada.id_endereco_entrega))) {
    throw new AppError(400, "O campo id_endereco_entrega deve ser um número positivo.");
  }
  if (!Array.isArray(entrada.itens) || entrada.itens.length === 0) {
    throw new AppError(400, "O pedido deve conter ao menos um item.");
  }
  for (const item of entrada.itens) {
    if (!item || typeof item !== "object") {
      throw new AppError(400, "Cada item do pedido deve ser um objeto.");
    }
    const entradaItem = item as Record<string, unknown>;
    if (!inteiroPositivo(Number(entradaItem.id_produto)) || !Number.isInteger(Number(entradaItem.quantidade)) || Number(entradaItem.quantidade) < 1) {
      throw new AppError(400, "Cada item deve informar id_produto e quantidade válida.");
    }
  }

  if (entrada.id_cliente !== undefined && !inteiroPositivo(Number(entrada.id_cliente))) {
    throw new AppError(400, "O campo id_cliente deve ser um número positivo.");
  }
  if (entrada.metodo !== undefined && entrada.metodo !== null && typeof entrada.metodo !== "string") {
    throw new AppError(400, "O campo metodo deve ser texto.");
  }

  return {
    id_endereco_entrega: Number(entrada.id_endereco_entrega),
    itens: entrada.itens.map((item) => {
      const entradaItem = item as Record<string, unknown>;
      return { id_produto: Number(entradaItem.id_produto), quantidade: Number(entradaItem.quantidade) };
    }),
    ...(entrada.id_cliente !== undefined ? { id_cliente: Number(entrada.id_cliente) } : {}),
    ...(entrada.metodo !== undefined ? { metodo: entrada.metodo as string | null } : {}),
  };
};

export const validarAtualizacaoPedido: Parser<PedidoAtualizacaoDTO> = (body) => {
  const entrada = validarObjeto(body);
  textoObrigatorio(entrada, "status");
  if (
    entrada.data_pagamento !== undefined &&
    entrada.data_pagamento !== null &&
    (typeof entrada.data_pagamento !== "string" || Number.isNaN(Date.parse(entrada.data_pagamento)))
  ) {
    throw new AppError(400, "O campo data_pagamento deve ser uma data válida.");
  }

  return {
    status: (entrada.status as string).trim(),
    ...(entrada.data_pagamento !== undefined
      ? { data_pagamento: entrada.data_pagamento as string | null }
      : {}),
  };
};

export const validarEntrada = <T>(validador: Parser<T>): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = validador(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
