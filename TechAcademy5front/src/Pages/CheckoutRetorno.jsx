import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FiAlertCircle, FiCheckCircle, FiClock, FiRefreshCw } from "react-icons/fi";
import { fetchJson, sendJson } from "../config/api";
import { useCarrinho } from "../context/CarrinhoContext";
import "./Checkout.css";

function resolveVisualState(paymentStatus, pedidoStatus) {
  if (pedidoStatus === "pago") {
    return {
      icon: FiCheckCircle,
      className: "checkout-result-success",
      title: "Pagamento aprovado",
      description:
        "Seu pedido foi confirmado e ja esta registrado como pago no sistema.",
    };
  }

  if (
    paymentStatus === "approved" ||
    ["pending", "in_process", "in_mediation"].includes(paymentStatus)
  ) {
    return {
      icon: FiClock,
      className: "checkout-result-pending",
      title:
        paymentStatus === "approved"
          ? "Pagamento aprovado; atualizando pedido"
          : "Pagamento em analise",
      description:
        paymentStatus === "approved"
          ? "O pagamento foi aprovado e estamos atualizando seu pedido. Esta etapa pode levar alguns instantes."
          : "O Mercado Pago ainda esta processando o pagamento. Voce pode acompanhar novamente em alguns instantes.",
    };
  }

  return {
    icon: FiAlertCircle,
    className: "checkout-result-error",
    title: "Pagamento nao concluido",
    description:
      "O pagamento nao foi aprovado. Voce pode gerar um novo link para tentar novamente.",
  };
}

function aguardar(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function CheckoutRetorno() {
  const [searchParams] = useSearchParams();
  const { limparCarrinho } = useCarrinho();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [result, setResult] = useState(null);
  const limparCarrinhoRef = useRef(limparCarrinho);
  limparCarrinhoRef.current = limparCarrinho;

  const pedidoId = useMemo(
    () =>
      searchParams.get("pedido") ||
      searchParams.get("external_reference") ||
      "",
    [searchParams]
  );
  const paymentId = useMemo(
    () =>
      searchParams.get("payment_id") ||
      searchParams.get("collection_id") ||
      "",
    [searchParams]
  );
  const status = useMemo(
    () =>
      searchParams.get("status") ||
      searchParams.get("collection_status") ||
      "",
    [searchParams]
  );

  const atualizarResultado = useCallback((response) => {
    setResult(response);

    if (response?.pedido?.status === "pago") {
      limparCarrinhoRef.current();
      window.localStorage.removeItem("checkout_pedido_aberto");
    }
  }, []);

  const confirmarPagamento = useCallback(
    () =>
      sendJson("/pagamentos/mercado-pago/confirmar", "POST", {
        pedido_id: Number(pedidoId),
        payment_id: paymentId ? Number(paymentId) : null,
        status,
      }),
    [paymentId, pedidoId, status]
  );

  useEffect(() => {
    let cancelled = false;

    const confirmarRetorno = async () => {
      if (!pedidoId) {
        setError("Nao foi possivel identificar o pedido retornado pelo Mercado Pago.");
        setLoading(false);
        return;
      }

      try {
        let response = await confirmarPagamento();
        if (cancelled) return;
        atualizarResultado(response);
        setLoading(false);

        for (
          let tentativa = 0;
          tentativa < 5 &&
          response?.paymentStatus === "approved" &&
          response?.pedido?.status !== "pago";
          tentativa += 1
        ) {
          await aguardar(1500);
          if (cancelled) return;

          try {
            const pedidoAtualizado = await fetchJson(`/pedidos/${pedidoId}`);
            if (cancelled) return;
            response = {
              ...response,
              pedido: pedidoAtualizado,
            };
            atualizarResultado(response);
          } catch (erro) {
            console.error("Erro ao consultar o pedido durante a sincronizacao:", erro);
            setError(erro.message || "Nao foi possivel consultar o pedido.");
            break;
          }
        }
      } catch (err) {
        if (cancelled) return;

        if (err.status === 503 && status === "approved") {
          try {
            const pedidoAtualizado = await fetchJson(`/pedidos/${pedidoId}`);
            if (cancelled) return;
            atualizarResultado({ paymentStatus: status, pedido: pedidoAtualizado });
          } catch (erro) {
            if (cancelled) return;
            console.error("Erro ao carregar o pedido durante a sincronizacao:", erro);
            setError(erro.message || "Nao foi possivel carregar o pedido.");
          }
          return;
        }

        console.error("Erro ao confirmar retorno do Mercado Pago:", err);
        setError(err.message || "Nao foi possivel validar o status do pagamento.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void confirmarRetorno();
    return () => {
      cancelled = true;
    };
  }, [atualizarResultado, confirmarPagamento, paymentId, pedidoId, status]);

  const handleVerifyPayment = async () => {
    try {
      setRetrying(true);
      setError("");
      let response = await confirmarPagamento();
      atualizarResultado(response);

      for (
        let tentativa = 0;
        tentativa < 5 &&
        response?.paymentStatus === "approved" &&
        response?.pedido?.status !== "pago";
        tentativa += 1
      ) {
        await aguardar(1500);
        const pedidoAtualizado = await fetchJson(`/pedidos/${pedidoId}`);
        response = {
          ...response,
          pedido: pedidoAtualizado,
        };
        atualizarResultado(response);
      }
    } catch (err) {
      console.error("Erro ao verificar novamente o pagamento:", err);
      setError(err.message || "Nao foi possivel verificar o status do pagamento.");
    } finally {
      setRetrying(false);
    }
  };

  const handleRetryPayment = async () => {
    if (!pedidoId) {
      return;
    }

    try {
      setRetrying(true);
      setError("");

      const response = await sendJson(
        `/pagamentos/mercado-pago/pedido/${pedidoId}/preference`,
        "POST",
        {
          frontend_url: window.location.origin,
        }
      );

      const initPoint = response?.init_point || response?.sandbox_init_point;

      if (!initPoint) {
        throw new Error("A API nao retornou um novo link de pagamento.");
      }

      window.location.assign(initPoint);
    } catch (err) {
      console.error("Erro ao gerar novo link do Mercado Pago:", err);
      setError(err.message || "Nao foi possivel gerar um novo link de pagamento.");
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <main className="checkout-page">
        <section className="checkout-shell checkout-loading">
          <p>Validando o retorno do Mercado Pago...</p>
        </section>
      </main>
    );
  }

  const paymentStatus = result?.paymentStatus || status || "desconhecido";
  const pedidoStatus = result?.pedido?.status || "pendente";
  const visualState = resolveVisualState(paymentStatus, pedidoStatus);
  const Icon = visualState.icon;

  return (
    <main className="checkout-page">
      <section className="checkout-shell">
        <div className={`checkout-result-card ${visualState.className}`}>
          <div className="checkout-result-icon">
            <Icon aria-hidden="true" />
          </div>

          <h1>{visualState.title}</h1>
          <p>{visualState.description}</p>

          <div className="checkout-result-meta">
            <span>Pedido: #{result?.pedido?.id_pedido || pedidoId || "--"}</span>
            <span>Status do pedido: {pedidoStatus}</span>
            <span>Status do pagamento: {paymentStatus}</span>
          </div>

          {error && <p className="checkout-feedback checkout-feedback-error">{error}</p>}

          <div className="checkout-result-actions">
            {pedidoStatus !== "pago" &&
              ["approved", "pending", "in_process", "in_mediation"].includes(paymentStatus) && (
                <button
                  type="button"
                  className="checkout-primary-button"
                  onClick={handleVerifyPayment}
                  disabled={retrying}
                >
                  <FiRefreshCw aria-hidden="true" />
                  {retrying ? "Verificando..." : "Verificar pagamento"}
                </button>
              )}

            {pedidoStatus !== "pago" &&
              !["approved", "pending", "in_process", "in_mediation"].includes(paymentStatus) && (
              <button
                type="button"
                className="checkout-primary-button"
                onClick={handleRetryPayment}
                disabled={retrying}
              >
                <FiRefreshCw aria-hidden="true" />
                {retrying ? "Gerando novo link..." : "Tentar pagamento novamente"}
              </button>
              )}

            <Link to="/pecas" className="checkout-ghost-link">
              Continuar comprando
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default CheckoutRetorno;
