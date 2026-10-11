import { Request, Response } from "express";
import Categoria from "../models/Categoria";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination";
import { cacheAside, invalidarCachePorPrefixo } from "../utils/cache";
import AppError from "../utils/app-error";

const TTL_CATEGORIAS_SEGUNDOS = 30 * 60;

export const criarCategoria = async (req: Request, res: Response) => {

    const { nome, descricao, ativo } = req.body;

    const categoria = await Categoria.create({
      nome,
      descricao,
      ativo
    });
    await invalidarCachePorPrefixo("categorias:");

    return res.status(201).json(categoria);

};

export const listarCategorias = async (_req: Request, res: Response) => {

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

};

export const buscarCategoria = async (req: Request, res: Response) => {

    const id = Number(req.params.id);

    const categoria = await Categoria.findByPk(id);

    if (!categoria) {
      throw new AppError(404, "Categoria não encontrada", "NAO_ENCONTRADO");
    }

    return res.json(categoria);

};

export const atualizarCategoria = async (req: Request, res: Response) => {

    const id = Number(req.params.id);

    const categoria = await Categoria.findByPk(id);

    if (!categoria) {
      throw new AppError(404, "Categoria não encontrada", "NAO_ENCONTRADO");
    }

    await categoria.update(req.body);
    await invalidarCachePorPrefixo("categorias:");

    return res.json(categoria);

};

export const deletarCategoria = async (req: Request, res: Response) => {

    const id = Number(req.params.id);

    const categoria = await Categoria.findByPk(id);

    if (!categoria) {
      throw new AppError(404, "Categoria não encontrada", "NAO_ENCONTRADO");
    }

    await categoria.destroy();
    await invalidarCachePorPrefixo("categorias:");

    return res.json({ mensagem: "Categoria deletada com sucesso" });

};