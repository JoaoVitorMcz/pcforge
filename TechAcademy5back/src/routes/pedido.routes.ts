import { Router } from "express";
import {
  listarPedidos,
  listarPedidosPorCliente,
  buscarPedidoPorId,
  criarPedido,
  atualizarStatusPedido,
  cancelarPedido
} from "../controllers/pedido.controller";
import {
  authMiddleware,
  authorizeRole,
  authorizePermission,
  selfOrAdminMiddleware,
} from "../config/auth.middleware";
import { validarEntrada, validarCriacaoPedido, validarAtualizacaoPedido } from "../utils/dto";

const router = Router();

router.get("/", authMiddleware, authorizeRole(["admin"]), listarPedidos);
router.get("/cliente/:id_cliente", authMiddleware, selfOrAdminMiddleware("id_cliente"), listarPedidosPorCliente);
router.get("/:id", authMiddleware, buscarPedidoPorId);
router.post("/", authMiddleware, authorizePermission(["pedido:criar"]), validarEntrada(validarCriacaoPedido), criarPedido);
router.patch("/:id/status", authMiddleware, authorizeRole(["admin"]), validarEntrada(validarAtualizacaoPedido), atualizarStatusPedido);
router.patch("/:id/cancelar", authMiddleware, authorizePermission(["pedido:atualizar"]), cancelarPedido);

export default router;
