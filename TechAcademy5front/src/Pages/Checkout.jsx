import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiCheckCircle, FiMapPin, FiShoppingBag, FiTruck } from "react-icons/fi";
import { fetchJson, sendJson } from "../config/api";
import { useCarrinho } from "../context/CarrinhoContext";
import { useUsuario } from "../context/UsuarioContext";
import "./Checkout.css";

const initialAddressForm = {
  numero: "", complemento: "", bairro: "", cidade: "", estado: "", cep: "",
};

async function solicitarPreferencia(pedidoId, frontendUrl) {
  const maxTentativas = 4;

  for (let tentativa = 0; tentativa < maxTentativas; tentativa += 1) {
    try {
      return await sendJson(
        `/pagamentos/mercado-pago/pedido/${pedidoId}/preference`,
        "POST",
        { frontend_url: frontendUrl }
      );
    } catch (error) {
      const podeTentarNovamente =
        error.status === 409 &&
        error.codigo === "PEDIDO_AINDA_NAO_RECEBIDO" &&
        tentativa < maxTentativas - 1;

      if (!podeTentarNovamente) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 250 * (tentativa + 1)));
    }
  }

  throw new Error("Nao foi possivel iniciar o pagamento.");
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCep(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

async function fetchAddressByCep(cep, signal) {
  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal });
  if (!response.ok) throw new Error("Nao foi possivel consultar o CEP agora.");
  const data = await response.json();
  if (data?.erro) throw new Error("CEP nao encontrado.");
  return { bairro: data?.bairro || "", cidade: data?.localidade || "", estado: data?.uf || "" };
}

function sanitizeAddressPayload(address) {
  return {
    numero: address.numero.trim() || null,
    complemento: address.complemento.trim() || null,
    bairro: address.bairro.trim() || null,
    cidade: address.cidade.trim() || null,
    estado: address.estado.trim() || null,
    cep: address.cep.replace(/\D/g, "") || null,
  };
}

function validateAddress(address) {
  if (!address.numero.trim()) return "Informe o numero do endereco.";
  if (!address.bairro.trim()) return "Informe o bairro.";
  if (!address.cidade.trim()) return "Informe a cidade.";
  if (!address.estado.trim()) return "Informe o estado.";
  if (address.cep.replace(/\D/g, "").length !== 8) return "Informe um CEP valido com 8 digitos.";
  return "";
}

function Checkout() {
  const navigate = useNavigate();
  const { itens, total } = useCarrinho();
  const { cliente, isAuthenticated } = useUsuario();

  const [enderecos, setEnderecos] = useState([]);
  const [enderecoSelecionado, setEnderecoSelecionado] = useState("");
  const [usarNovoEndereco, setUsarNovoEndereco] = useState(false);
  const [novoEndereco, setNovoEndereco] = useState(initialAddressForm);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [status, setStatus] = useState("");
  const [statusCep, setStatusCep] = useState("");
  const [consultandoCep, setConsultandoCep] = useState(false);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { navigate("/Login"); return; }

    const carregarEnderecos = async () => {
      try {
        const response = await fetchJson(`/enderecos/cliente/${cliente.id_cliente}`);
        const enderecosCarregados = Array.isArray(response)
          ? response
          : Array.isArray(response?.dados) ? response.dados : [];
        setEnderecos(enderecosCarregados);
        if (enderecosCarregados.length > 0) {
          setEnderecoSelecionado(String(enderecosCarregados[0].id_endereco));
          setUsarNovoEndereco(false);
        } else {
          setUsarNovoEndereco(true);
        }
      } catch (err) {
        setErro("Nao foi possivel carregar seus enderecos.");
      } finally {
        setLoading(false);
      }
    };

    if (cliente?.id_cliente) carregarEnderecos();
  }, [cliente, isAuthenticated, navigate]);

  const handleAddressInputChange = (event) => {
    const { name, value } = event.target;
    const nextValue = name === "cep" ? formatCep(value) : name === "estado" ? value.toUpperCase().slice(0, 2) : value;
    setNovoEndereco((prev) => ({ ...prev, [name]: nextValue }));
    if (name === "cep") setStatusCep("");
    setErro(""); setStatus("");
  };

  useEffect(() => {
    const cep = novoEndereco.cep.replace(/\D/g, "");
    if (cep.length !== 8) { setConsultandoCep(false); return; }

    let isActive = true;
    const controller = new AbortController();

    const carregarEndereco = async () => {
      try {
        setConsultandoCep(true);
        setStatusCep("Buscando dados do CEP...");
        const enderecoCep = await fetchAddressByCep(cep, controller.signal);
        if (!isActive) return;
        setNovoEndereco((prev) => ({ ...prev, ...enderecoCep }));
        setStatusCep("Endereco preenchido automaticamente pelo CEP.");
      } catch (err) {
        if (err.name === "AbortError") return;
        setStatusCep("");
        setErro(err.message || "Nao foi possivel buscar o CEP.");
      } finally {
        if (isActive) setConsultandoCep(false);
      }
    };

    carregarEndereco();
    return () => { isActive = false; controller.abort(); };
  }, [novoEndereco.cep]);

  const salvarNovoEndereco = async () => {
    const validationMessage = validateAddress(novoEndereco);
    if (validationMessage) throw new Error(validationMessage);

    const response = await sendJson("/enderecos", "POST", {
      id_cliente: cliente.id_cliente,
      ...sanitizeAddressPayload(novoEndereco),
    });

    const enderecoCriado = response?.endereco;
    if (!enderecoCriado?.id_endereco) throw new Error("A API nao retornou o endereco criado.");

    setEnderecos((prev) => [enderecoCriado, ...prev]);
    setEnderecoSelecionado(String(enderecoCriado.id_endereco));
    setUsarNovoEndereco(false);
    setNovoEndereco(initialAddressForm);
    setStatus("Endereco salvo com sucesso.");
    return enderecoCriado.id_endereco;
  };

  const obterEnderecoEntrega = async () => {
    if (usarNovoEndereco || !enderecoSelecionado) return salvarNovoEndereco();
    return Number(enderecoSelecionado);
  };

  const handleFinalizarCompra = async () => {
    if (!cliente) { navigate("/Login"); return; }
    if (itens.length === 0) { setErro("Seu carrinho esta vazio."); return; }

    try {
      setProcessando(true); setErro(""); setStatus("");

      const idEnderecoEntrega = await obterEnderecoEntrega();

      const pedidoResponse = await sendJson("/pedidos", "POST", {
        id_cliente: cliente.id_cliente,
        id_endereco_entrega: idEnderecoEntrega,
        itens: itens.map((item) => ({
          id_produto: Number(item.id_produto),
          quantidade: Number(item.quantidade),
          preco_unitario: Number(item.valor || item.preco || 0),
        })),
      });

      const pedidoId = pedidoResponse?.pedido?.id_pedido;
      if (!pedidoId) throw new Error("Nao foi possivel criar o pedido.");

      const pagamentoResponse = await solicitarPreferencia(
        pedidoId,
        window.location.origin
      );

      const initPoint = pagamentoResponse?.init_point || pagamentoResponse?.sandbox_init_point;
      if (!initPoint) throw new Error("O Mercado Pago nao retornou uma URL valida.");

      window.location.assign(initPoint);
    } catch (err) {
      setErro(err.message || "Nao foi possivel iniciar o pagamento.");
    } finally {
      setProcessando(false);
    }
  };

  if (loading) {
    return (
      <main className="checkout-page">
        <section className="checkout-shell checkout-loading">
          <p>Carregando checkout...</p>
        </section>
      </main>
    );
  }

  if (itens.length === 0) {
    return (
      <main className="checkout-page">
        <section className="checkout-shell checkout-empty">
          <FiShoppingBag className="checkout-empty-icon" aria-hidden="true" />
          <h1>Nenhum item para finalizar</h1>
          <p>Adicione produtos ao carrinho antes de seguir para o pagamento.</p>
          <Link to="/pecas" className="checkout-primary-link">Escolher produtos</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="checkout-page">
      <section className="checkout-shell">
        <div className="checkout-hero">
          <p className="checkout-kicker">Fechamento do pedido</p>
          <h1>Checkout com <span>Mercado Pago</span></h1>
          <p>Informe o endereço de entrega e finalize o pagamento com segurança.</p>
        </div>

        <div className="checkout-grid">
          <section className="checkout-card">
            <div className="checkout-card-header">
              <div>
                <h2><FiMapPin aria-hidden="true" /> Endereço de entrega</h2>
                <p>Selecione um endereço salvo ou cadastre um novo agora.</p>
              </div>
              {enderecos.length > 0 && (
                <button type="button" className="checkout-secondary-button"
                  onClick={() => { setUsarNovoEndereco((prev) => !prev); setErro(""); setStatus(""); }}>
                  {usarNovoEndereco ? "Usar endereço salvo" : "Novo endereço"}
                </button>
              )}
            </div>

            {!usarNovoEndereco && enderecos.length > 0 && (
              <div className="checkout-address-list">
                {enderecos.map((endereco) => {
                  const isSelected = String(endereco.id_endereco) === String(enderecoSelecionado);
                  return (
                    <label key={endereco.id_endereco} className={`checkout-address-card ${isSelected ? "selected" : ""}`}>
                      <input type="radio" name="endereco" value={endereco.id_endereco} checked={isSelected}
                        onChange={(event) => { setEnderecoSelecionado(event.target.value); setErro(""); setStatus(""); }} />
                      <div>
                        <strong>Endereço #{endereco.id_endereco}</strong>
                        <span>{[endereco.numero, endereco.bairro, endereco.cidade, endereco.estado, endereco.cep].filter(Boolean).join(" - ")}</span>
                        {endereco.complemento && <small>{endereco.complemento}</small>}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {(usarNovoEndereco || enderecos.length === 0) && (
              <div className="checkout-address-form">
                <div className="checkout-form-grid">
                  <label>Número<input name="numero" type="text" value={novoEndereco.numero} onChange={handleAddressInputChange} placeholder="Ex: 250" /></label>
                  <label>CEP<input name="cep" type="text" value={novoEndereco.cep} onChange={handleAddressInputChange} placeholder="00000-000" /></label>
                  <label>Bairro<input name="bairro" type="text" value={novoEndereco.bairro} onChange={handleAddressInputChange} placeholder="Seu bairro" /></label>
                  <label>Cidade<input name="cidade" type="text" value={novoEndereco.cidade} onChange={handleAddressInputChange} placeholder="Sua cidade" /></label>
                  <label>Estado<input name="estado" type="text" value={novoEndereco.estado} onChange={handleAddressInputChange} placeholder="UF" maxLength={2} /></label>
                  <label className="checkout-form-grid-wide">
                    Complemento
                    <input name="complemento" type="text" value={novoEndereco.complemento} onChange={handleAddressInputChange} placeholder="Apartamento, bloco, referencia..." />
                  </label>
                </div>
                <p className="checkout-inline-note">Este endereço será criado na sua conta e usado para o pedido atual.</p>
                {consultandoCep && <p className="checkout-inline-note">Buscando dados do CEP...</p>}
                {!consultandoCep && statusCep && <p className="checkout-inline-note">{statusCep}</p>}
              </div>
            )}

            {erro && <p className="checkout-feedback checkout-feedback-error">{erro}</p>}
            {status && <p className="checkout-feedback checkout-feedback-success">{status}</p>}
          </section>

          <aside className="checkout-card checkout-summary-card">
            <div className="checkout-card-header">
              <div>
                <h2><FiTruck aria-hidden="true" /> Resumo do pedido</h2>
                <p>Confira os itens antes de seguir para o Mercado Pago.</p>
              </div>
              <span className="checkout-badge">
                <FiCheckCircle aria-hidden="true" />
                {cliente?.nome || "Cliente"}
              </span>
            </div>

            <div className="checkout-items">
              {itens.map((item) => {
                const precoUnitario = Number(item.valor || item.preco || 0);
                const subtotal = precoUnitario * Number(item.quantidade || 0);
                return (
                  <div key={item.id_produto} className="checkout-item-row">
                    <div>
                      <strong>{item.nome}</strong>
                      <span>{item.quantidade} x {formatCurrency(precoUnitario)}</span>
                    </div>
                    <strong>{formatCurrency(subtotal)}</strong>
                  </div>
                );
              })}
            </div>

            <div className="checkout-total-row">
              <span>Total</span>
              <strong>{formatCurrency(total)}</strong>
            </div>

            <button type="button" className="checkout-primary-button" onClick={handleFinalizarCompra} disabled={processando}>
              {processando ? "Processando..." : "Pagar com Mercado Pago"}
            </button>

            <button type="button" className="checkout-ghost-button" onClick={() => navigate("/carrinho")} disabled={processando}>
              Voltar ao carrinho
            </button>

            <p className="checkout-disclaimer">
              O pagamento abre no ambiente seguro do Mercado Pago. Depois do retorno, o sistema confirma o status do pedido automaticamente.
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}

export default Checkout;