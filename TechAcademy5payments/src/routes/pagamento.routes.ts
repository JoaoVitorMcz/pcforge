import { Router } from "express";
import { autenticar } from "../config/auth.middleware";
import {
  confirmarPagamentoMercadoPago,
  gerarNovaPreferenciaMercadoPago,
} from "../controllers/pagamento.controller";

const router = Router();

router.use(autenticar);
router.post(
  "/mercado-pago/pedido/:id/preference",
  gerarNovaPreferenciaMercadoPago
);
router.post("/mercado-pago/confirmar", confirmarPagamentoMercadoPago);

export default router;
