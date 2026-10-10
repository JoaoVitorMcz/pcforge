import { Request, Response } from "express";
import Categoria from "../models/Categoria";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination";
import { cacheAside, invalidarCachePorPrefixo } from "../utils/cache";

const TTL_CATEGORIAS_SEGUNDOS = 30 * 60;

export const criarCategoria = async (req: Request, res: Response) => {
  try {
    const { nome, descricao, ativo } = req.body;

    const categoria = await Categoria.create({
      nome,
      descricao,
      ativo
    });
    await invalidarCachePorPrefixo("categorias:");

    return res.status(201).json(categoria);
  } catch (error) {
    console.error("Erro ao criar categoria:", error);
    return res.status(500).json({ erro: "Erro ao criar categoria" });
  }
};

export const listarCategorias = async (_req: Request, res: Response) => {
  try {
    const req = _req;
    const { page, limit, offset } = getPaginationParams(req);
    const shouldPaginate = req.query.page !== undefined || req.query.limit !== undefined;
    const queryOptions: {
      order: [["id_categoria", "ASC"]],
      limit?: number;
      offset?: number;
    } = {
      order: [["id_categoria", "ASC"]],
    };

    if (shouldPaginate) {
      queryOptions.limit = limit;
      queryOptions.offset = offset;
    }

    const paginado = req.query.page !== undefined || req.query.limit !== undefined;
    const chave = `categorias:lista:pagina=${page}:limite=${limit}:paginado=${paginado}`;
    const resposta = await cacheAside(chave, TTL_CATEGORIAS_SEGUNDOS, async () => {
      const { rows: categorias, count } = await Categoria.findAndCountAll(queryOptions);
      return paginado ? buildPaginatedResponse(categorias, count, page, limit) : categorias;
    });
    return res.json(resposta);
  } catch (error) {
    console.error("Erro ao listar categorias:", error);
    return res.status(500).json({ erro: "Erro ao listar categorias" });
  }
};

export const buscarCategoria = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const categoria = await Categoria.findByPk(id);

    if (!categoria) {
      return res.status(404).json({ erro: "Categoria não encontrada" });
    }

    return res.json(categoria);
  } catch (error) {
    console.error("Erro ao buscar categoria:", error);
    return res.status(500).json({ erro: "Erro ao buscar categoria" });
  }
};

export const atualizarCategoria = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const categoria = await Categoria.findByPk(id);

    if (!categoria) {
      return res.status(404).json({ erro: "Categoria não encontrada" });
    }

    await categoria.update(req.body);
    await invalidarCachePorPrefixo("categorias:");

    return res.json(categoria);
  } catch (error) {
    console.error("Erro ao atualizar categoria:", error);
    return res.status(500).json({ erro: "Erro ao atualizar categoria" });
  }
};

export const deletarCategoria = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const categoria = await Categoria.findByPk(id);

    if (!categoria) {
      return res.status(404).json({ erro: "Categoria não encontrada" });
    }

    await categoria.destroy();
    await invalidarCachePorPrefixo("categorias:");

    return res.json({ mensagem: "Categoria deletada com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar categoria:", error);
    return res.status(500).json({ erro: "Erro ao deletar categoria" });
  }
};