import { Request, Response } from "express";
import Produto from "../models/Produto";
import { Op } from "sequelize";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination";
import { cacheAside, invalidarCachePorPrefixo } from "../utils/cache";
import AppError from "../utils/app-error";

const TTL_PRODUTOS_SEGUNDOS = 5 * 60;

const chaveProdutos = (
  req: Request,
  tipo: "lista" | "destaque" | "busca" = "lista"
): string => {
  const { page, limit } = getPaginationParams(req);
  const paginado = req.query.page !== undefined || req.query.limit !== undefined;
  const termo = tipo === "busca"
    ? `:termo=${encodeURIComponent(String(req.query.nome ?? "").trim())}`
    : "";
  return `produtos:${tipo}:pagina=${page}:limite=${limit}:paginado=${paginado}${termo}`;
};

export const listarProdutos = async (req: Request, res: Response): Promise<void> => {
  
    const { page, limit, offset } = getPaginationParams(req);
    const shouldPaginate = req.query.page !== undefined || req.query.limit !== undefined;

    const queryOptions: {
      where: { ativo: boolean };
      order: [string, string][];
      limit?: number;
      offset?: number;
    } = {
      where: { ativo: true },
      order: [["id_produto", "ASC"]],
    };

    if (shouldPaginate) {
      queryOptions.limit = limit;
      queryOptions.offset = offset;
    }

    const resposta = await cacheAside(chaveProdutos(req), TTL_PRODUTOS_SEGUNDOS, async () => {
      const { rows: produtos, count } = await Produto.findAndCountAll(queryOptions);
      return shouldPaginate ? buildPaginatedResponse(produtos, count, page, limit) : produtos;
    });

    res.status(200).json(resposta);
  
};

export const buscarProdutoPorId = async (req: Request, res: Response): Promise<void> => {
  
    const id = Number(req.params.id);

    const produto = await Produto.findOne({
      where: { id_produto: id, ativo: true },
    });

    if (!produto) {
      throw new AppError(404, "Produto não encontrado.", "NAO_ENCONTRADO");
      
    }

    res.status(200).json(produto);
  
};

export const criarProduto = async (req: Request, res: Response): Promise<void> => {
  
    const { nome, descricao, valor, id_categoria, imagem, destaque, estoque } = req.body;

    if (!nome || !valor) {
      throw new AppError(400, "Nome e valor são obrigatórios.", "REQUISICAO_INVALIDA");
      
    }

    const novoProduto = await Produto.create({
      nome,
      descricao: descricao || null,
      valor,
      id_categoria: id_categoria || null,
      imagem: imagem || null,
      destaque: destaque || false,
      estoque: estoque || 0,
      ativo: true,
    });
    await invalidarCachePorPrefixo("produtos:");

    res.status(201).json({
      mensagem: "Produto criado com sucesso.",
      produto: novoProduto,
    });
  
};

export const atualizarProduto = async (req: Request, res: Response): Promise<void> => {
  
    const id = Number(req.params.id);

    const produto = await Produto.findOne({
      where: { id_produto: id, ativo: true },
    });

    if (!produto) {
      throw new AppError(404, "Produto não encontrado.", "NAO_ENCONTRADO");
      
    }

    const { nome, descricao, valor, id_categoria, imagem, destaque, estoque } = req.body;

    const dadosAtualizados: Partial<{
      nome: string;
      descricao: string | null;
      valor: number;
      id_categoria: number | null;
      imagem: string | null;
      destaque: boolean;
      estoque: number;
    }> = {};

    if (nome) dadosAtualizados.nome = nome;
    if (descricao !== undefined) dadosAtualizados.descricao = descricao;
    if (valor !== undefined) dadosAtualizados.valor = valor;
    if (id_categoria !== undefined) dadosAtualizados.id_categoria = id_categoria;
    if (imagem !== undefined) dadosAtualizados.imagem = imagem;
    if (destaque !== undefined) dadosAtualizados.destaque = destaque;
    if (estoque !== undefined) dadosAtualizados.estoque = estoque;

    await produto.update(dadosAtualizados);
    await invalidarCachePorPrefixo("produtos:");

    res.status(200).json({
      mensagem: "Produto atualizado com sucesso.",
      produto,
    });
  
};

export const desativarProduto = async (req: Request, res: Response): Promise<void> => {
  
    const id = Number(req.params.id);

    const produto = await Produto.findOne({
      where: { id_produto: id, ativo: true },
    });

    if (!produto) {
      throw new AppError(404, "Produto não encontrado ou já desativado.", "NAO_ENCONTRADO");
      
    }

    await produto.update({ ativo: false });
    await invalidarCachePorPrefixo("produtos:");

    res.status(200).json({
      mensagem: "Produto desativado com sucesso.",
    });
  
};

export const buscarProdutosPorNome = async (req: Request, res: Response): Promise<void> => {
  
    const nome = req.query.nome as string;
    const { page, limit, offset } = getPaginationParams(req);
    const shouldPaginate = req.query.page !== undefined || req.query.limit !== undefined;

    if (!nome) {
      throw new AppError(400, "Informe um nome para buscar.", "REQUISICAO_INVALIDA");
      
    }

    const queryOptions: {
      where: {
        nome: { [Op.like]: string };
        ativo: boolean;
      };
      limit?: number;
      offset?: number;
    } = {
      where: {
        nome: { [Op.like]: `%${nome}%` },
        ativo: true,
      },
    };

    if (shouldPaginate) {
      queryOptions.limit = limit;
      queryOptions.offset = offset;
    }

    const resposta = await cacheAside(chaveProdutos(req, "busca"), TTL_PRODUTOS_SEGUNDOS, async () => {
      const { rows: produtos, count } = await Produto.findAndCountAll({
        ...queryOptions,
      });
      return shouldPaginate ? buildPaginatedResponse(produtos, count, page, limit) : produtos;
    });

    res.status(200).json(resposta);
  
};

export const listarProdutosDestaque = async (req: Request, res: Response): Promise<void> => {
  
    const { page, limit, offset } = getPaginationParams(req);
    const shouldPaginate = req.query.page !== undefined || req.query.limit !== undefined;

    const queryOptions: {
      where: { destaque: boolean; ativo: boolean };
      limit?: number;
      offset?: number;
    } = {
      where: { destaque: true, ativo: true },
    };

    if (shouldPaginate) {
      queryOptions.limit = limit;
      queryOptions.offset = offset;
    }

    const resposta = await cacheAside(chaveProdutos(req, "destaque"), TTL_PRODUTOS_SEGUNDOS, async () => {
      const { rows: produtos, count } = await Produto.findAndCountAll(queryOptions);
      return shouldPaginate ? buildPaginatedResponse(produtos, count, page, limit) : produtos;
    });

    res.status(200).json(resposta);
  
};