import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendJson } from "../config/api";
import { useUsuario } from "../context/UsuarioContext";
import { useCarrinho } from "../context/CarrinhoContext";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const { login } = useUsuario();
  const { recarregarCarrinho } = useCarrinho();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState("");
  const [loading, setLoading] = useState(false);

  const validar = () => {
    const novosErros = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) novosErros.email = "Email é obrigatório.";
    else if (!emailRegex.test(email)) novosErros.email = "Email inválido.";
    if (!senha) novosErros.senha = "Senha é obrigatória.";
    else if (senha.length < 6) novosErros.senha = "Senha deve ter pelo menos 6 caracteres.";
    return novosErros;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErroGeral("");

    const errosEncontrados = validar();
    if (Object.keys(errosEncontrados).length > 0) {
      setErros(errosEncontrados);
      return;
    }

    setLoading(true);

    try {
      const data = await sendJson("/clientes/login", "POST", { email, senha });
      login(data);            // ← salva no context + localStorage
      recarregarCarrinho();   // ← carrega carrinho do cliente
      navigate("/");
    } catch (err) {
      if (err.status === 401) {
        setErroGeral("Email ou senha incorretos.");
      } else {
        setErroGeral("Erro ao conectar com o servidor.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>PC <span>FORGE</span></h1>
        <p className="login-subtitulo">Acesse sua conta</p>

        <form onSubmit={handleLogin} noValidate>
          <div className="login-campo">
            <label>E-mail</label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErros((prev) => ({ ...prev, email: "" })); }}
            />
            {erros.email && <span className="erro">{erros.email}</span>}
          </div>

          <div className="login-campo">
            <label>Senha</label>
            <input
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={senha}
              onChange={(e) => { setSenha(e.target.value); setErros((prev) => ({ ...prev, senha: "" })); }}
            />
            {erros.senha && <span className="erro">{erros.senha}</span>}
          </div>

          {erroGeral && <span className="erro erro-geral">{erroGeral}</span>}

          <button type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p>Não tem conta? <a href="/cadastro">Criar conta</a></p>
      </div>
    </div>
  );
}

export default Login;