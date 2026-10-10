import { Router } from "express";
import * as ClienteController from "../controllers/cliente.controller";
import {
  authMiddleware,
  authorizeRole,
  selfOrAdminMiddleware,
} from "../config/auth.middleware";
import { validarEntrada, validarCriacaoCliente, validarAtualizacaoCliente } from "../utils/dto";

const router = Router();

// Rotas públicas
router.post("/", validarEntrada(validarCriacaoCliente), ClienteController.criarCliente);
router.post("/login", ClienteController.loginCliente);

//  (cliente autenticado)
router.get("/:id", authMiddleware, selfOrAdminMiddleware(), ClienteController.buscarClientePorId);
router.put("/:id", authMiddleware, selfOrAdminMiddleware(), validarEntrada(validarAtualizacaoCliente), ClienteController.atualizarCliente);
router.delete("/:id", authMiddleware, selfOrAdminMiddleware(), ClienteController.desativarCliente);

//  (só admin)
router.get("/", authMiddleware, authorizeRole(["admin"]), ClienteController.listarClientes);

export default router;
