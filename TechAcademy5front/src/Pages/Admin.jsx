import React, { useEffect, useRef, useState } from "react";
import {
  buildAssetUrl,
  fetchJson,
  sendFormData,
  sendJson,
} from "../config/api";
import {
  FiShoppingCart,
  FiUser,
  FiRefreshCw,
  FiCheck,
  FiX,
  FiPlus,
  FiPackage,
  FiChevronDown,
  FiChevronUp,
  FiTag,
  FiStar,
} from "react-icons/fi";
import "./Admin.css";
import { useUsuario } from "../context/UsuarioContext";
import { useNavigate } from "react-router-dom";

const formatarCPF = (valor) => {
  if (!valor) return "";
  const apenasNumeros = valor.replace(/\D/g, "");
  if (apenasNumeros.length <= 3) return apenasNumeros;
  if (apenasNumeros.length <= 6) return `${apenasNumeros.slice(0, 3)}.${apenasNumeros.slice(3)}`;
  if (apenasNumeros.length <= 9) return `${apenasNumeros.slice(0, 3)}.${apenasNumeros.slice(3, 6)}.${apenasNumeros.slice(6)}`;
  return `${apenasNumeros.slice(0, 3)}.${apenasNumeros.slice(3, 6)}.${apenasNumeros.slice(6, 9)}-${apenasNumeros.slice(9, 11)}`;
};

const formatarTelefone = (valor) => {
  if (!valor) return "";
  const apenasNumeros = valor.replace(/\D/g, "");
  if (apenasNumeros.length <= 2) return `(${apenasNumeros}`;
  if (apenasNumeros.length <= 7) return `(${apenasNumeros.slice(0, 2)}) ${apenasNumeros.slice(2)}`;
  return `(${apenasNumeros.slice(0, 2)}) ${apenasNumeros.slice(2, 7)}-${apenasNumeros.slice(7, 11)}`;
};

const initialProductForm = {
  nome: "", descricao: "", preco: "", id_categoria: "", estoque: "", imagem: "", destaque: false,
};

const initialUserForm = {
  nome: "", email: "", telefone: "", cpf: "", senha: "", ativo: "true", admin: "false",
};

const initialCategoryForm = {
  nome: "", descricao: "",
};

function formatarPreco(valor) {
  const apenasNumeros = valor.replace(/\D/g, "");
  if (!apenasNumeros) return "";
  const numero = (Number(apenasNumeros) / 100).toFixed(2);
  return numero.replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function desformatarPreco(valor) {
  return parseFloat(valor.replace(/\./g, "").replace(",", ".")) || 0;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data) {
  if (!data) return "—";
  return new Date(data).toLocaleString("pt-BR");
}

const STATUS_CORES = {
  pendente: { bg: "#1a2a45", color: "#7a8fa6", label: "Pendente" },
  pago: { bg: "rgba(0,212,255,0.1)", color: "#00d4ff", label: "Pago" },
  em_preparacao: { bg: "rgba(255,193,7,0.1)", color: "#ffc107", label: "Em preparação" },
  enviado: { bg: "rgba(13,202,240,0.1)", color: "#0dcaf0", label: "Enviado" },
  entregue: { bg: "rgba(25,135,84,0.1)", color: "#198754", label: "Entregue" },
  cancelado: { bg: "rgba(255,77,109,0.1)", color: "#ff4d6d", label: "Cancelado" },
};

// Estilo "visualmente escondido": o input continua no DOM e funcional,
// mas não aparece. NÃO use display:none aqui.
const hiddenFileInputStyle = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
  opacity: 0,
  pointerEvents: "none",
};

// ─────────────────────────────────────────
// ABA PRODUTOS
// ─────────────────────────────────────────
function AbaProdutos() {
  const PRODUTOS_POR_PAGINA = 5;
  const [categorias, setCategorias] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [form, setForm] = useState(initialProductForm);
  const [editandoId, setEditandoId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const [status, setStatus] = useState("");
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [erroPreview, setErroPreview] = useState(false);
  const imagemInputRef = useRef(null);

  useEffect(() => { carregarDados(); }, []);
  useEffect(() => { setPaginaAtual(1); }, [busca]);
  useEffect(() => { setErroPreview(false); }, [form.imagem]);

  const carregarDados = async () => {
    try {
      setLoading(true); setErro("");
      const [cats, prods] = await Promise.all([fetchJson("/categorias"), fetchJson("/produtos")]);
      setCategorias(Array.isArray(cats) ? cats : []);
      setProdutos(Array.isArray(prods) ? prods : []);
    } catch (err) {
      setErro("Não foi possível carregar os produtos da API.");
    } finally { setLoading(false); }
  };

  const limparFormulario = () => { setForm(initialProductForm); setEditandoId(null); setStatus(""); setErro(""); };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") { setForm((prev) => ({ ...prev, [name]: checked })); return; }
    if (name === "preco") { setForm((prev) => ({ ...prev, preco: formatarPreco(value) })); return; }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImagemUpload = async (e) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("imagem", file);
    try {
      setEnviandoImagem(true); setErro(""); setStatus("");
      const data = await sendFormData("/upload/imagem", "POST", formData);
      console.log("Resposta do upload:", data);
      if (!data?.url) throw new Error("A API nao retornou a URL da imagem.");
      const urlFinal = buildAssetUrl(data.url);
      console.log("URL final da imagem:", urlFinal);
      setForm((prev) => ({ ...prev, imagem: urlFinal }));
      setStatus("Imagem enviada com sucesso.");
    } catch (err) {
      console.error("Erro no upload:", err);
      setErro(err.message || "Erro ao fazer upload da imagem.");
    } finally {
      setEnviandoImagem(false);
      input.value = "";
    }
  };

  const handleEditar = (produto) => {
    const precoFormatado = produto.preco ? formatarPreco(String(Math.round(produto.preco * 100))) : "";
    setForm({
      nome: produto.nome || "",
      descricao: produto.descricao || "",
      preco: precoFormatado,
      id_categoria: String(produto.id_categoria ?? ""),
      estoque: String(produto.estoque ?? produto.tag ?? ""),
      imagem: produto.imagem || "",
      destaque: produto.destaque === true,
    });
    setEditandoId(produto.id_produto); setStatus(""); setErro("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setErro(""); setStatus("");
    if (!form.nome.trim() || !form.preco || !form.id_categoria) { setErro("Preencha nome, preço e categoria."); return; }
    const precoNumerico = desformatarPreco(form.preco);
    if (!Number.isFinite(precoNumerico) || precoNumerico <= 0) { setErro("Informe um preço válido."); return; }
    const payload = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      valor: precoNumerico,
      id_categoria: Number(form.id_categoria),
      estoque: form.estoque.trim() || null,
      imagem: form.imagem.trim() || null,
      destaque: form.destaque,
    };
    try {
      setSalvando(true);
      const mensagemSucesso = editandoId ? "Produto atualizado com sucesso." : "Produto criado com sucesso.";
      if (editandoId) { await sendJson(`/produtos/${editandoId}`, "PUT", payload); }
      else { await sendJson("/produtos", "POST", payload); }
      limparFormulario(); setStatus(mensagemSucesso); await carregarDados();
    } catch (err) { setErro(err.message || "Não foi possível salvar na API."); }
    finally { setSalvando(false); }
  };

  const handleExcluir = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir este produto?")) return;
    try {
      setErro(""); setStatus("");
      await sendJson(`/produtos/${id}`, "DELETE");
      setStatus("Produto excluído com sucesso.");
      if (editandoId === id) limparFormulario();
      await carregarDados();
    } catch (err) { setErro(err.message || "Não foi possível excluir na API."); }
  };

  const handleToggleDestaque = async (produto) => {
    try {
      setErro(""); setStatus("");
      await sendJson(`/produtos/${produto.id_produto}`, "PUT", { destaque: !produto.destaque });
      setStatus(`Produto ${!produto.destaque ? "adicionado ao" : "removido do"} destaque.`);
      await carregarDados();
    } catch (err) { setErro("Erro ao atualizar destaque."); }
  };

  const getCategoriaNome = (idCategoria) => {
    const cat = categorias.find((item) => String(item.id_categoria) === String(idCategoria));
    return cat ? cat.nome : `ID ${idCategoria}`;
  };

  const produtosFiltrados = produtos.filter((p) => p.nome?.toLowerCase().includes(busca.trim().toLowerCase()));
  const totalPaginas = Math.max(1, Math.ceil(produtosFiltrados.length / PRODUTOS_POR_PAGINA));
  useEffect(() => { if (paginaAtual > totalPaginas) setPaginaAtual(totalPaginas); }, [paginaAtual, totalPaginas]);
  const indiceInicial = (paginaAtual - 1) * PRODUTOS_POR_PAGINA;
  const produtosPaginados = produtosFiltrados.slice(indiceInicial, indiceInicial + PRODUTOS_POR_PAGINA);

  return (
    <section className="admin-grid">
      <section className="admin-card admin-form-card">
        <div className="admin-section-head">
          <h2>{editandoId ? "Editar produto" : "Novo produto"}</h2>
          <p>{editandoId ? "Altere os campos e salve as mudanças." : "Preencha os dados para cadastrar um novo produto."}</p>
          {editandoId && <button type="button" className="admin-novo-btn" onClick={limparFormulario}><FiPlus /> Novo produto</button>}
        </div>
        <form className="admin-form" onSubmit={handleSubmit}>
          <label>Nome do produto<input name="nome" type="text" placeholder="Ex: RTX 4070 Super" value={form.nome} onChange={handleChange} /></label>
          <label>Descrição<textarea name="descricao" placeholder="Descreva o produto..." value={form.descricao} onChange={handleChange} rows={3} /></label>
          <label>Preço<input name="preco" type="text" placeholder="0,00" value={form.preco} onChange={handleChange} /></label>
          <label>
            Categoria
            <select name="id_categoria" value={form.id_categoria} onChange={handleChange}>
              <option value="">Selecione uma categoria</option>
              {categorias.map((cat) => (<option key={cat.id_categoria} value={cat.id_categoria}>{cat.nome}</option>))}
            </select>
          </label>
          <label>Estoque<input name="estoque" type="text" placeholder="Ex: 15" value={form.estoque} onChange={handleChange} /></label>

          {/* ── Destaque ── */}
          <label style={{ flexDirection: "row", alignItems: "center", gap: "12px", cursor: "pointer", userSelect: "none" }}>
            <input
              name="destaque"
              type="checkbox"
              checked={form.destaque}
              onChange={handleChange}
              style={{ width: "18px", height: "18px", accentColor: "#ffc107", cursor: "pointer", flexShrink: 0 }}
            />
            Produto em destaque
          </label>

          {/* ── Imagem ── */}
          <div className="admin-image-field" style={{ position: "relative" }}>
            <span className="admin-image-label">Imagem do produto</span>
            <div className="admin-image-picker">
              <label
                htmlFor="admin-imagem-input"
                className="admin-image-picker-button"
                style={{
                  cursor: enviandoImagem ? "not-allowed" : "pointer",
                  opacity: enviandoImagem ? 0.6 : 1,
                }}
              >
                {enviandoImagem ? "Enviando..." : "Escolher arquivo"}
              </label>
              <span>{form.imagem ? "Imagem definida" : "Nenhum arquivo escolhido"}</span>
            </div>
            <input
              id="admin-imagem-input"
              ref={imagemInputRef}
              type="file"
              name="imagem"
              accept="image/*"
              aria-label="Imagem do produto"
              onChange={handleImagemUpload}
              disabled={enviandoImagem}
              style={hiddenFileInputStyle}
            />
          </div>
          {enviandoImagem && <p className="admin-message admin-success">Enviando imagem...</p>}
          {form.imagem && (
            <div className="admin-img-preview">
              {!erroPreview ? (
                <img
                  src={form.imagem}
                  alt="Preview"
                  style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, display: "block" }}
                  onError={() => {
                    console.error("Falha ao carregar imagem:", form.imagem);
                    setErroPreview(true);
                  }}
                />
              ) : (
                <p className="admin-message admin-error">
                  Não foi possível carregar a imagem. Verifique a URL: {form.imagem}
                </p>
              )}
              <button type="button" className="admin-clear-img-btn" onClick={() => setForm(prev => ({ ...prev, imagem: "" }))}>✕ Remover</button>
            </div>
          )}
          {erro && <p className="admin-message admin-error">{erro}</p>}
          {status && <p className="admin-message admin-success">{status}</p>}
          <div className="admin-form-actions">
            <button type="submit" disabled={salvando || enviandoImagem}>{salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Criar produto"}</button>
            {editandoId && <button type="button" className="admin-secondary-btn" onClick={limparFormulario}>Cancelar edição</button>}
          </div>
        </form>
      </section>

      <section className="admin-card admin-list-card">
        <div className="admin-section-head">
          <h2>Produtos cadastrados</h2>
          <p>Total atual: {produtos.length}. Mostrando {produtosPaginados.length} de {produtosFiltrados.length}.</p>
        </div>
        <input type="text" className="admin-busca-input" placeholder="Buscar produto pelo nome..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        {loading ? <p className="admin-empty">Carregando produtos...</p> : produtosFiltrados.length === 0 ? (
          <p className="admin-empty">{busca ? "Nenhum produto encontrado para esta busca." : "Nenhum produto encontrado."}</p>
        ) : (
          <>
            <div className="admin-products">
              {produtosPaginados.map((produto) => (
                <article key={produto.id_produto} className="admin-product-row">
                  <div className="admin-product-info">
                    {produto.imagem && <img src={produto.imagem} alt={produto.nome} className="admin-product-thumb" onError={(e) => (e.target.style.display = "none")} />}
                    <div>
                      <h3>
                        {produto.nome}
                        {produto.destaque && (
                          <span style={{
                            fontSize: "10px", fontWeight: 700, padding: "2px 7px",
                            borderRadius: "999px", background: "rgba(255,193,7,0.15)",
                            color: "#ffc107", border: "1px solid rgba(255,193,7,0.3)",
                            letterSpacing: "0.05em", textTransform: "uppercase", marginLeft: "6px",
                          }}>
                            ⭐ Destaque
                          </span>
                        )}
                      </h3>
                      {produto.descricao && <p className="admin-product-desc">{produto.descricao}</p>}
                      <p>R$ {Number(produto.preco || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      <span>Categoria: {getCategoriaNome(produto.id_categoria)}{produto.estoque ? ` | Estoque: ${produto.estoque}` : ""}</span>
                    </div>
                  </div>
                  <div className="admin-product-actions">
                    <button
                      type="button"
                      className="admin-secondary-btn"
                      title={produto.destaque ? "Remover destaque" : "Colocar em destaque"}
                      onClick={() => handleToggleDestaque(produto)}
                      style={produto.destaque ? { color: "#ffc107", borderColor: "rgba(255,193,7,0.4)" } : {}}
                    >
                      <FiStar style={{ marginRight: "4px" }} />
                      {produto.destaque ? "Remover" : "Destacar"}
                    </button>
                    <button type="button" className="admin-secondary-btn" onClick={() => handleEditar(produto)}>Editar</button>
                    <button type="button" className="admin-danger-btn" onClick={() => handleExcluir(produto.id_produto)}>Excluir</button>
                  </div>
                </article>
              ))}
            </div>
            <div className="admin-pagination">
              <button type="button" className="admin-pagination-btn" onClick={() => setPaginaAtual((p) => Math.max(p - 1, 1))} disabled={paginaAtual === 1}>Anterior</button>
              <div className="admin-pagination-pages">
                {Array.from({ length: totalPaginas }, (_, i) => (
                  <button key={i + 1} type="button" className={`admin-pagination-btn ${i + 1 === paginaAtual ? "active" : ""}`} onClick={() => setPaginaAtual(i + 1)}>{i + 1}</button>
                ))}
              </div>
              <button type="button" className="admin-pagination-btn" onClick={() => setPaginaAtual((p) => Math.min(p + 1, totalPaginas))} disabled={paginaAtual === totalPaginas}>Proxima</button>
            </div>
          </>
        )}
      </section>
    </section>
  );
}

// ─────────────────────────────────────────
// ABA CATEGORIAS
// ─────────────────────────────────────────
function AbaCategorias() {
  const CATEGORIAS_POR_PAGINA = 5;
  const [categorias, setCategorias] = useState([]);
  const [form, setForm] = useState(initialCategoryForm);
  const [editandoId, setEditandoId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [status, setStatus] = useState("");
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(1);

  useEffect(() => { carregarCategorias(); }, []);
  useEffect(() => { setPaginaAtual(1); }, [busca]);

  const carregarCategorias = async () => {
    try {
      setLoading(true); setErro("");
      const data = await fetchJson("/categorias");
      setCategorias(Array.isArray(data) ? data : []);
    } catch (err) { setErro("Não foi possível carregar as categorias."); }
    finally { setLoading(false); }
  };

  const limparFormulario = () => { setForm(initialCategoryForm); setEditandoId(null); setStatus(""); setErro(""); };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditar = (categoria) => {
    setForm({ nome: categoria.nome || "", descricao: categoria.descricao || "" });
    setEditandoId(categoria.id_categoria); setStatus(""); setErro("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setErro(""); setStatus("");
    if (!form.nome.trim()) { setErro("Informe o nome da categoria."); return; }
    const payload = { nome: form.nome.trim(), descricao: form.descricao.trim() || null };
    try {
      setSalvando(true);
      const mensagemSucesso = editandoId ? "Categoria atualizada com sucesso." : "Categoria criada com sucesso.";
      if (editandoId) { await sendJson(`/categorias/${editandoId}`, "PUT", payload); }
      else { await sendJson("/categorias", "POST", payload); }
      limparFormulario(); setStatus(mensagemSucesso); await carregarCategorias();
    } catch (err) { setErro(err.message || "Não foi possível salvar a categoria."); }
    finally { setSalvando(false); }
  };

  const handleExcluir = async (id) => {
    if (!window.confirm("Excluir esta categoria? Produtos vinculados podem ser afetados.")) return;
    try {
      setErro(""); setStatus("");
      await sendJson(`/categorias/${id}`, "DELETE");
      setStatus("Categoria excluída com sucesso.");
      if (editandoId === id) limparFormulario();
      await carregarCategorias();
    } catch (err) { setErro(err.message || "Não foi possível excluir a categoria."); }
  };

  const categoriasFiltradas = categorias.filter((c) => c.nome?.toLowerCase().includes(busca.trim().toLowerCase()));
  const totalPaginas = Math.max(1, Math.ceil(categoriasFiltradas.length / CATEGORIAS_POR_PAGINA));
  useEffect(() => { if (paginaAtual > totalPaginas) setPaginaAtual(totalPaginas); }, [paginaAtual, totalPaginas]);
  const indiceInicial = (paginaAtual - 1) * CATEGORIAS_POR_PAGINA;
  const categoriasPaginadas = categoriasFiltradas.slice(indiceInicial, indiceInicial + CATEGORIAS_POR_PAGINA);

  return (
    <section className="admin-grid">
      <section className="admin-card admin-form-card">
        <div className="admin-section-head">
          <h2>{editandoId ? "Editar categoria" : "Nova categoria"}</h2>
          <p>{editandoId ? "Altere os campos e salve as mudanças." : "Preencha os dados para cadastrar uma nova categoria."}</p>
          {editandoId && <button type="button" className="admin-novo-btn" onClick={limparFormulario}><FiPlus /> Nova categoria</button>}
        </div>
        <form className="admin-form" onSubmit={handleSubmit}>
          <label>Nome da categoria<input name="nome" type="text" placeholder="Ex: Placas de Vídeo" value={form.nome} onChange={handleChange} /></label>
          <label>Descrição<textarea name="descricao" placeholder="Descreva a categoria..." value={form.descricao} onChange={handleChange} rows={3} /></label>
          {erro && <p className="admin-message admin-error">{erro}</p>}
          {status && <p className="admin-message admin-success">{status}</p>}
          <div className="admin-form-actions">
            <button type="submit" disabled={salvando}>{salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Criar categoria"}</button>
            {editandoId && <button type="button" className="admin-secondary-btn" onClick={limparFormulario}>Cancelar edição</button>}
          </div>
        </form>
      </section>

      <section className="admin-card admin-list-card">
        <div className="admin-section-head">
          <h2>Categorias cadastradas</h2>
          <p>Total: {categorias.length}. Mostrando {categoriasPaginadas.length} de {categoriasFiltradas.length}.</p>
          <button type="button" className="admin-novo-btn" onClick={carregarCategorias}><FiRefreshCw /> Recarregar</button>
        </div>
        <input type="text" className="admin-busca-input" placeholder="Buscar categoria pelo nome..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        {loading ? <p className="admin-empty">Carregando categorias...</p> : categoriasFiltradas.length === 0 ? (
          <p className="admin-empty">{busca ? "Nenhuma categoria encontrada." : "Nenhuma categoria cadastrada."}</p>
        ) : (
          <>
            <div className="admin-products">
              {categoriasPaginadas.map((categoria) => (
                <article key={categoria.id_categoria} className="admin-product-row">
                  <div className="admin-product-info">
                    <div className="admin-user-avatar" style={{ borderRadius: "10px" }}><FiTag /></div>
                    <div>
                      <h3>{categoria.nome}</h3>
                      {categoria.descricao && <p className="admin-product-desc">{categoria.descricao}</p>}
                      <span>ID: {categoria.id_categoria}</span>
                    </div>
                  </div>
                  <div className="admin-product-actions">
                    <button type="button" className="admin-secondary-btn" onClick={() => handleEditar(categoria)}>Editar</button>
                    <button type="button" className="admin-danger-btn" onClick={() => handleExcluir(categoria.id_categoria)}>Excluir</button>
                  </div>
                </article>
              ))}
            </div>
            <div className="admin-pagination">
              <button type="button" className="admin-pagination-btn" onClick={() => setPaginaAtual((p) => Math.max(p - 1, 1))} disabled={paginaAtual === 1}>Anterior</button>
              <div className="admin-pagination-pages">
                {Array.from({ length: totalPaginas }, (_, i) => (
                  <button key={i + 1} type="button" className={`admin-pagination-btn ${i + 1 === paginaAtual ? "active" : ""}`} onClick={() => setPaginaAtual(i + 1)}>{i + 1}</button>
                ))}
              </div>
              <button type="button" className="admin-pagination-btn" onClick={() => setPaginaAtual((p) => Math.min(p + 1, totalPaginas))} disabled={paginaAtual === totalPaginas}>Proxima</button>
            </div>
          </>
        )}
      </section>
    </section>
  );
}

// ─────────────────────────────────────────
// ABA USUÁRIOS
// ─────────────────────────────────────────
function AbaUsuarios() {
  const USUARIOS_POR_PAGINA = 5;
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState(initialUserForm);
  const [editandoId, setEditandoId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [status, setStatus] = useState("");
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState("todos");
  const [paginaAtual, setPaginaAtual] = useState(1);

  useEffect(() => { carregarClientes(); }, []);
  useEffect(() => { setPaginaAtual(1); }, [busca, filtroAtivo]);

  const carregarClientes = async () => {
    try {
      setLoading(true); setErro("");
      let data;
      try { data = await fetchJson("/clientes?incluir_inativos=true"); }
      catch { try { data = await fetchJson("/clientes/all"); } catch { data = await fetchJson("/clientes"); } }
      setClientes(Array.isArray(data) ? data : data?.dados || []);
    } catch (err) { setErro("Não foi possível carregar os usuários."); }
    finally { setLoading(false); }
  };

  const limparFormulario = () => { setForm(initialUserForm); setEditandoId(null); setStatus(""); setErro(""); };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let novoValor = value;
    if (name === "cpf") novoValor = formatarCPF(value);
    else if (name === "telefone") novoValor = formatarTelefone(value);
    setForm((prev) => ({ ...prev, [name]: novoValor }));
  };

  const handleEditar = (cliente) => {
    setForm({
      nome: cliente.nome || "", email: cliente.email || "",
      telefone: formatarTelefone(cliente.telefone || ""), cpf: formatarCPF(cliente.cpf || ""),
      senha: "", ativo: String(cliente.ativo ?? "true"), admin: String(cliente.admin ?? "false"),
    });
    setEditandoId(cliente.id_cliente); setStatus(""); setErro("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setErro(""); setStatus("");
    if (!form.nome.trim() || !form.email.trim()) { setErro("Nome e e-mail são obrigatórios."); return; }
    if (!editandoId && !form.senha) { setErro("Senha é obrigatória para criar um usuário."); return; }
    if (form.senha) {
      const senhaForteRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!senhaForteRegex.test(form.senha)) { setErro("Senha deve ter no mínimo 8 caracteres, letra maiúscula, minúscula e número."); return; }
    }
    const payload = {
      nome: form.nome.trim(), email: form.email.trim(),
      telefone: form.telefone.replace(/\D/g, "") || null,
      cpf: form.cpf.replace(/\D/g, "") || null,
      ativo: form.ativo === "true", admin: form.admin === "true",
    };
    if (form.senha) payload.senha = form.senha;
    try {
      setSalvando(true);
      const mensagemSucesso = editandoId ? "Usuário atualizado com sucesso." : "Usuário criado com sucesso.";
      if (editandoId) { await sendJson(`/clientes/${editandoId}`, "PUT", payload); }
      else { await sendJson("/clientes", "POST", payload); }
      limparFormulario(); setStatus(mensagemSucesso); await carregarClientes();
    } catch (err) {
      if (err.message.includes("409")) setErro("E-mail ou CPF já cadastrado.");
      else if (err.message.includes("400")) setErro(err.message.split(" - ")[1] || "Dados inválidos.");
      else setErro(err.message || "Erro ao salvar usuário.");
    } finally { setSalvando(false); }
  };

  const handleDesativar = async (cliente) => {
    const acao = cliente.ativo ? "desativar" : "reativar";
    if (!window.confirm(`Deseja ${acao} o usuário ${cliente.nome}?`)) return;
    try {
      setErro(""); setStatus("");
      await sendJson(`/clientes/${cliente.id_cliente}`, "PUT", {
        nome: cliente.nome, email: cliente.email,
        telefone: cliente.telefone || null, cpf: cliente.cpf || null,
        senha: "Placeholder1", ativo: !cliente.ativo, admin: cliente.admin,
      });
      setStatus(`Usuário ${acao === "desativar" ? "desativado" : "reativado"} com sucesso.`);
      await carregarClientes();
    } catch (err) { setErro(err.message || `Erro ao ${acao} usuário.`); }
  };

  const clientesFiltrados = clientes.filter((c) => {
    const q = busca.toLowerCase();
    const matchTexto = c.nome?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.cpf?.includes(q);
    const matchStatus = filtroAtivo === "ativos" ? c.ativo === true : filtroAtivo === "inativos" ? c.ativo === false : true;
    return matchTexto && matchStatus;
  });

  const totalPaginas = Math.max(1, Math.ceil(clientesFiltrados.length / USUARIOS_POR_PAGINA));
  useEffect(() => { if (paginaAtual > totalPaginas) setPaginaAtual(totalPaginas); }, [paginaAtual, totalPaginas]);
  const indiceInicial = (paginaAtual - 1) * USUARIOS_POR_PAGINA;
  const clientesPaginados = clientesFiltrados.slice(indiceInicial, indiceInicial + USUARIOS_POR_PAGINA);

  return (
    <section className="admin-grid">
      <section className="admin-card admin-form-card">
        <div className="admin-section-head">
          <h2>{editandoId ? "Editar usuário" : "Novo usuário"}</h2>
          <p>{editandoId ? "Altere os dados e salve as mudanças." : "Preencha os dados para cadastrar um novo usuário."}</p>
          {editandoId && <button type="button" className="admin-novo-btn" onClick={limparFormulario}><FiPlus /> Novo usuário</button>}
        </div>
        <form className="admin-form" onSubmit={handleSubmit}>
          <label>Nome completo<input name="nome" type="text" placeholder="Nome do usuário" value={form.nome} onChange={handleChange} /></label>
          <label>E-mail<input name="email" type="email" placeholder="email@exemplo.com" value={form.email} onChange={handleChange} disabled={!!editandoId} style={editandoId ? { opacity: 0.5, cursor: "not-allowed" } : {}} /></label>
          <label>CPF<input name="cpf" type="text" placeholder="000.000.000-00" value={form.cpf} onChange={handleChange} maxLength={14} /></label>
          <label>Telefone<input name="telefone" type="text" placeholder="(00) 00000-0000" value={form.telefone} onChange={handleChange} maxLength={15} /></label>
          <label>{editandoId ? "Nova senha (deixe em branco para não alterar)" : "Senha"}<input name="senha" type="password" placeholder="Mín. 8 car., maiúscula, minúscula e número" value={form.senha} onChange={handleChange} /></label>
          <label>Status<select name="ativo" value={form.ativo} onChange={handleChange}><option value="true">Ativo</option><option value="false">Inativo</option></select></label>
          <label>Nível de acesso<select name="admin" value={form.admin} onChange={handleChange}><option value="false">Usuário comum</option><option value="true">Administrador</option></select></label>
          {erro && <p className="admin-message admin-error">{erro}</p>}
          {status && <p className="admin-message admin-success">{status}</p>}
          <div className="admin-form-actions">
            <button type="submit" disabled={salvando}>{salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Criar usuário"}</button>
            {editandoId && <button type="button" className="admin-secondary-btn" onClick={limparFormulario}>Cancelar edição</button>}
          </div>
        </form>
      </section>

      <section className="admin-card admin-list-card">
        <div className="admin-section-head">
          <h2>Usuários cadastrados</h2>
          <p>Total: {clientes.length} usuário(s). Mostrando {clientesPaginados.length} de {clientesFiltrados.length}.</p>
          <button type="button" className="admin-novo-btn" onClick={carregarClientes}><FiRefreshCw /> Recarregar</button>
        </div>
        <input type="text" className="admin-busca-input" placeholder="Buscar por nome, e-mail ou CPF..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
          <button type="button" className={`admin-filter-btn ${filtroAtivo === "todos" ? "active" : ""}`} onClick={() => setFiltroAtivo("todos")}>Todos ({clientes.length})</button>
          <button type="button" className={`admin-filter-btn ${filtroAtivo === "ativos" ? "active" : ""}`} onClick={() => setFiltroAtivo("ativos")}><FiCheck style={{ marginRight: "4px" }} /> Ativos ({clientes.filter(c => c.ativo).length})</button>
          <button type="button" className={`admin-filter-btn ${filtroAtivo === "inativos" ? "active" : ""}`} onClick={() => setFiltroAtivo("inativos")}><FiX style={{ marginRight: "4px" }} /> Inativos ({clientes.filter(c => !c.ativo).length})</button>
        </div>
        {loading ? <p className="admin-empty">Carregando usuários...</p> : clientesFiltrados.length === 0 ? (
          <p className="admin-empty">{busca ? "Nenhum usuário encontrado." : filtroAtivo === "inativos" ? "Nenhum usuário inativo." : filtroAtivo === "ativos" ? "Nenhum usuário ativo." : "Nenhum usuário cadastrado."}</p>
        ) : (
          <>
            <div className="admin-products">
              {clientesPaginados.map((cliente) => (
                <article key={cliente.id_cliente} className={`admin-product-row ${!cliente.ativo ? "admin-row-inativo" : ""}`}>
                  <div className="admin-product-info">
                    <div className="admin-user-avatar">{cliente.nome?.charAt(0).toUpperCase()}</div>
                    <div>
                      <h3>{cliente.nome}{cliente.admin && <span className="admin-badge-admin">Admin</span>}{!cliente.ativo && <span className="admin-badge-inativo">Inativo</span>}</h3>
                      <p className="admin-product-desc">{cliente.email}</p>
                      <span>CPF: {cliente.cpf || "—"}{cliente.telefone ? ` | Tel: ${cliente.telefone}` : ""}</span>
                    </div>
                  </div>
                  <div className="admin-product-actions">
                    <button type="button" className="admin-secondary-btn" onClick={() => handleEditar(cliente)}>Editar</button>
                    <button type="button" className={cliente.ativo ? "admin-danger-btn" : "admin-secondary-btn"} onClick={() => handleDesativar(cliente)}>{cliente.ativo ? "Desativar" : "Reativar"}</button>
                  </div>
                </article>
              ))}
            </div>
            <div className="admin-pagination">
              <button type="button" className="admin-pagination-btn" onClick={() => setPaginaAtual((p) => Math.max(p - 1, 1))} disabled={paginaAtual === 1}>Anterior</button>
              <div className="admin-pagination-pages">
                {Array.from({ length: totalPaginas }, (_, i) => (
                  <button key={i + 1} type="button" className={`admin-pagination-btn ${i + 1 === paginaAtual ? "active" : ""}`} onClick={() => setPaginaAtual(i + 1)}>{i + 1}</button>
                ))}
              </div>
              <button type="button" className="admin-pagination-btn" onClick={() => setPaginaAtual((p) => Math.min(p + 1, totalPaginas))} disabled={paginaAtual === totalPaginas}>Proxima</button>
            </div>
          </>
        )}
      </section>
    </section>
  );
}

// ─────────────────────────────────────────
// ABA PEDIDOS
// ─────────────────────────────────────────
function AbaPedidos() {
  const PEDIDOS_POR_PAGINA = 5;
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [status, setStatus] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [pedidoAberto, setPedidoAberto] = useState(null);

  useEffect(() => { carregarPedidos(); }, []);
  useEffect(() => { setPaginaAtual(1); }, [filtroStatus]);

  const carregarPedidos = async () => {
    try {
      setLoading(true); setErro("");
      const data = await fetchJson("/pedidos");
      setPedidos(Array.isArray(data) ? data : data?.dados || []);
    } catch (err) { setErro("Não foi possível carregar os pedidos."); }
    finally { setLoading(false); }
  };

  const handleCancelar = async (pedido) => {
    if (!window.confirm(`Cancelar o pedido #${pedido.id_pedido} de ${pedido.cliente?.nome}?`)) return;
    try {
      setErro(""); setStatus("");
      await sendJson(`/pedidos/${pedido.id_pedido}/cancelar`, "PATCH");
      setStatus(`Pedido #${pedido.id_pedido} cancelado com sucesso.`);
      await carregarPedidos();
    } catch (err) { setErro(err.message || "Não foi possível cancelar o pedido."); }
  };

  const pedidosFiltrados = pedidos.filter((p) => filtroStatus === "todos" ? true : p.status === filtroStatus);
  const totalPaginas = Math.max(1, Math.ceil(pedidosFiltrados.length / PEDIDOS_POR_PAGINA));
  useEffect(() => { if (paginaAtual > totalPaginas) setPaginaAtual(totalPaginas); }, [paginaAtual, totalPaginas]);
  const indiceInicial = (paginaAtual - 1) * PEDIDOS_POR_PAGINA;
  const pedidosPaginados = pedidosFiltrados.slice(indiceInicial, indiceInicial + PEDIDOS_POR_PAGINA);
  const contarPorStatus = (s) => pedidos.filter((p) => p.status === s).length;

  return (
    <section className="admin-pedidos-section">
      <div className="admin-pedidos-resumo">
        {Object.entries(STATUS_CORES).map(([key, val]) => (
          <button key={key} type="button" className={`admin-status-card ${filtroStatus === key ? "active" : ""}`}
            style={{ "--status-color": val.color, "--status-bg": val.bg }}
            onClick={() => setFiltroStatus(filtroStatus === key ? "todos" : key)}>
            <span className="admin-status-count">{contarPorStatus(key)}</span>
            <span className="admin-status-label">{val.label}</span>
          </button>
        ))}
      </div>

      <div className="admin-card admin-list-card">
        <div className="admin-section-head">
          <h2>Pedidos</h2>
          <p>Total: {pedidos.length} pedido(s).{filtroStatus !== "todos" && ` Filtrando: ${STATUS_CORES[filtroStatus]?.label}`}</p>
          <button type="button" className="admin-novo-btn" onClick={carregarPedidos}><FiRefreshCw /> Recarregar</button>
        </div>
        {erro && <p className="admin-message admin-error">{erro}</p>}
        {status && <p className="admin-message admin-success">{status}</p>}
        {loading ? <p className="admin-empty">Carregando pedidos...</p> : pedidosFiltrados.length === 0 ? (
          <p className="admin-empty">Nenhum pedido encontrado.</p>
        ) : (
          <>
            <div className="admin-products">
              {pedidosPaginados.map((pedido) => {
                const statusInfo = STATUS_CORES[pedido.status] || STATUS_CORES.pendente;
                const aberto = pedidoAberto === pedido.id_pedido;
                const cancelavel = !["enviado", "entregue", "cancelado"].includes(pedido.status);
                return (
                  <article key={pedido.id_pedido} className="admin-product-row admin-pedido-row">
                    <div className="admin-pedido-header">
                      <div className="admin-pedido-info">
                        <div className="admin-pedido-id">
                          <span>Pedido <strong>#{pedido.id_pedido}</strong></span>
                          <span className="admin-pedido-status" style={{ background: statusInfo.bg, color: statusInfo.color }}>{statusInfo.label}</span>
                        </div>
                        <p className="admin-product-desc"><strong>{pedido.cliente?.nome || "—"}</strong> · {pedido.cliente?.email || "—"}</p>
                        <span>{formatarData(pedido.data_pedido)} · Total: <strong>{formatCurrency(pedido.valor)}</strong></span>
                      </div>
                      <div className="admin-product-actions">
                        {cancelavel && <button type="button" className="admin-danger-btn" onClick={() => handleCancelar(pedido)}>Cancelar</button>}
                        <button type="button" className="admin-secondary-btn" onClick={() => setPedidoAberto(aberto ? null : pedido.id_pedido)}>
                          {aberto ? <FiChevronUp /> : <FiChevronDown />} {aberto ? "Fechar" : "Ver itens"}
                        </button>
                      </div>
                    </div>
                    {aberto && (
                      <div className="admin-pedido-detalhes">
                        <div className="admin-pedido-endereco">
                          <strong>Endereço de entrega:</strong>
                          <span>{[pedido.endereco_entrega?.numero, pedido.endereco_entrega?.bairro, pedido.endereco_entrega?.cidade, pedido.endereco_entrega?.estado, pedido.endereco_entrega?.cep].filter(Boolean).join(" - ") || "Não informado"}</span>
                        </div>
                        <div className="admin-pedido-itens">
                          <strong>Itens do pedido:</strong>
                          {Array.isArray(pedido.itens) && pedido.itens.length > 0 ? (
                            <div className="admin-pedido-itens-lista">
                              {pedido.itens.map((item, i) => (
                                <div key={i} className="admin-pedido-item">
                                  {item.produto?.imagem && <img src={item.produto.imagem} alt={item.produto?.nome} className="admin-pedido-item-img" onError={(e) => (e.target.style.display = "none")} />}
                                  <div>
                                    <span className="admin-pedido-item-nome">{item.produto?.nome || "Produto"}</span>
                                    <span className="admin-pedido-item-detalhe">{item.quantidade}x · {formatCurrency(item.preco_unitario)} un. · Subtotal: {formatCurrency(item.quantidade * item.preco_unitario)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : <p className="admin-empty">Nenhum item encontrado.</p>}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            <div className="admin-pagination">
              <button type="button" className="admin-pagination-btn" onClick={() => setPaginaAtual((p) => Math.max(p - 1, 1))} disabled={paginaAtual === 1}>Anterior</button>
              <div className="admin-pagination-pages">
                {Array.from({ length: totalPaginas }, (_, i) => (
                  <button key={i + 1} type="button" className={`admin-pagination-btn ${i + 1 === paginaAtual ? "active" : ""}`} onClick={() => setPaginaAtual(i + 1)}>{i + 1}</button>
                ))}
              </div>
              <button type="button" className="admin-pagination-btn" onClick={() => setPaginaAtual((p) => Math.min(p + 1, totalPaginas))} disabled={paginaAtual === totalPaginas}>Proxima</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────
function Admin() {
  const { isAdmin, isAuthenticated } = useUsuario();
  const navigate = useNavigate();
  const [abaAtiva, setAbaAtiva] = useState("produtos");

  if (!isAuthenticated) {
    return (
      <main className="admin-page">
        <section className="admin-hero">
          <h1>Acesso <span>Negado</span></h1>
          <p className="admin-description">Você precisa estar logado para acessar esta área.</p>
          <button type="button" className="admin-novo-btn" style={{ marginTop: "1rem" }} onClick={() => navigate("/Login")}>Ir para o Login</button>
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="admin-page">
        <section className="admin-hero">
          <h1>Acesso <span>Negado</span></h1>
          <p className="admin-description">Você não tem permissão para acessar esta área.</p>
          <button type="button" className="admin-novo-btn" style={{ marginTop: "1rem" }} onClick={() => navigate("/")}>Voltar para Home</button>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <section className="admin-hero">
        <p className="admin-badge">Área administrativa</p>
        <h1>Painel <span>Admin</span></h1>
        <p className="admin-description">Gerencie produtos, categorias, usuários e pedidos da loja em um único lugar.</p>
      </section>

      <div className="admin-tabs">
        <button type="button" className={`admin-tab ${abaAtiva === "produtos" ? "active" : ""}`} onClick={() => setAbaAtiva("produtos")}>
          <FiShoppingCart style={{ marginRight: "6px" }} /> Produtos
        </button>
        <button type="button" className={`admin-tab ${abaAtiva === "categorias" ? "active" : ""}`} onClick={() => setAbaAtiva("categorias")}>
          <FiTag style={{ marginRight: "6px" }} /> Categorias
        </button>
        <button type="button" className={`admin-tab ${abaAtiva === "usuarios" ? "active" : ""}`} onClick={() => setAbaAtiva("usuarios")}>
          <FiUser style={{ marginRight: "6px" }} /> Usuários
        </button>
        <button type="button" className={`admin-tab ${abaAtiva === "pedidos" ? "active" : ""}`} onClick={() => setAbaAtiva("pedidos")}>
          <FiPackage style={{ marginRight: "6px" }} /> Pedidos
        </button>
      </div>

      {abaAtiva === "produtos" && <AbaProdutos />}
      {abaAtiva === "categorias" && <AbaCategorias />}
      {abaAtiva === "usuarios" && <AbaUsuarios />}
      {abaAtiva === "pedidos" && <AbaPedidos />}
    </main>
  );
}

export default Admin;
