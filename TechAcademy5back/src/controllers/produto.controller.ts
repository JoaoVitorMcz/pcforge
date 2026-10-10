import { Request, Response } from "express";
import Produto from "../models/Produto";
import { Op } from "sequelize";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination";
import { cacheAside, invalidarCachePorPrefixo } from "../utils/cache";

const TTL_PRODUTOS_SEGUNDOS = 5 * 60;

const chaveProdutos = (req: Request, destaque = false): string => {
  const { page, limit } = getPaginationParams(req);
  const paginado = req.query.page !== undefined || req.query.limit !== undefined;
  return `produtos:${destaque ? "destaque" : "lista"}:pagina=${page}:limite=${limit}:paginado=${paginado}`;
};

export const listarProdutos = async (req: Request, res: Response): Promise<void> => {
  try {
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
  } catch (error) {
    console.error("Erro ao listar produtos:", error);
    res.status(500).json({ mensagem: "Erro interno ao listar produtos." });
  }
};

export const buscarProdutoPorId = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const produto = await Produto.findOne({
      where: { id_produto: id, ativo: true },
    });

    if (!produto) {
      res.status(404).json({ mensagem: "Produto não encontrado." });
      return;
    }

    res.status(200).json(produto);
  } catch (error) {
    console.error("Erro ao buscar produto:", error);
    res.status(500).json({ mensagem: "Erro interno ao buscar produto." });
  }
};

export const criarProduto = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nome, descricao, valor, id_categoria, imagem, destaque, estoque } = req.body;

    if (!nome || !valor) {
      res.status(400).json({ mensagem: "Nome e valor são obrigatórios." });
      return;
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
  } catch (error) {
    console.error("Erro ao criar produto:", error);
    res.status(500).json({ mensagem: "Erro interno ao criar produto." });
  }
};

export const atualizarProduto = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const produto = await Produto.findOne({
      where: { id_produto: id, ativo: true },
    });

    if (!produto) {
      res.status(404).json({ mensagem: "Produto não encontrado." });
      return;
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
  } catch (error) {
    console.error("Erro ao atualizar produto:", error);
    res.status(500).json({ mensagem: "Erro interno ao atualizar produto." });
  }
};

export const desativarProduto = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const produto = await Produto.findOne({
      where: { id_produto: id, ativo: true },
    });

    if (!produto) {
      res.status(404).json({
        mensagem: "Produto não encontrado ou já desativado.",
      });
      return;
    }

    await produto.update({ ativo: false });
    await invalidarCachePorPrefixo("produtos:");

    res.status(200).json({
      mensagem: "Produto desativado com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao desativar produto:", error);
    res.status(500).json({
      mensagem: "Erro interno ao desativar produto.",
    });
  }
};

export const buscarProdutosPorNome = async (req: Request, res: Response): Promise<void> => {
  try {
    const nome = req.query.nome as string;
    const { page, limit, offset } = getPaginationParams(req);
    const shouldPaginate = req.query.page !== undefined || req.query.limit !== undefined;

    if (!nome) {
      res.status(400).json({ mensagem: "Informe um nome para buscar." });
      return;
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

    const resposta = await cacheAside(chaveProdutos(req, true), TTL_PRODUTOS_SEGUNDOS, async () => {
      const { rows: produtos, count } = await Produto.findAndCountAll({
        ...queryOptions,
      });
      return shouldPaginate ? buildPaginatedResponse(produtos, count, page, limit) : produtos;
    });

    res.status(200).json(resposta);
  } catch (error) {
    console.error("Erro ao buscar produtos:", error);
    res.status(500).json({ mensagem: "Erro interno ao buscar produtos." });
  }
};

export const listarProdutosDestaque = async (req: Request, res: Response): Promise<void> => {
  try {
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

    const { rows: produtos, count } = await Produto.findAndCountAll(queryOptions);

    res.status(200).json(shouldPaginate ? buildPaginatedResponse(produtos, count, page, limit) : produtos);
  } catch (error) {
    console.error("Erro ao listar produtos destaque:", error);
    res.status(500).json({
      mensagem: "Erro interno ao listar produtos destaque.",
    });
  }
};