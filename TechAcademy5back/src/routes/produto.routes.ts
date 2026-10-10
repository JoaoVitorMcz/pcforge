import { Router } from "express";
import * as ProdutoController from "../controllers/produto.controller";
import { authMiddleware, authorizeRole } from "../config/auth.middleware";
import { validarEntrada, validarCriacaoProduto, validarAtualizacaoProduto } from "../utils/dto";

const router = Router();

// Rotas públicas
router.get("/", ProdutoController.listarProdutos);
router.get("/destaque", ProdutoController.listarProdutosDestaque); // ← adicionar ANTES de /:id
router.get("/buscar", ProdutoController.buscarProdutosPorNome);   // ← se já usar essa
router.get("/:id", ProdutoController.buscarProdutoPorId);

// (somente admin)
router.post("/", authMiddleware, authorizeRole(["admin"]), validarEntrada(validarCriacaoProduto), ProdutoController.criarProduto);
router.put("/:id", authMiddleware, authorizeRole(["admin"]), validarEntrada(validarAtualizacaoProduto), ProdutoController.atualizarProduto);
router.delete("/:id", authMiddleware, authorizeRole(["admin"]), ProdutoController.desativarProduto);

export default router;