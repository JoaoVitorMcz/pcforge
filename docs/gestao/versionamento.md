# Versionamento e releases

Como o PC Forge numera suas versões e quando uma release é publicada. Entrega da SCRUM-27.

## A política: SemVer

O projeto segue [Semantic Versioning](https://semver.org/lang/pt-BR/) — **MAJOR.MINOR.PATCH**:

| Parte | Quando sobe | Exemplo no projeto |
|---|---|---|
| **MAJOR** | Mudança **incompatível**: quem usava a versão anterior precisa se ajustar | A API saiu da porta 3000 para `:8080/api` |
| **MINOR** | Funcionalidade nova, **compatível** com o que existia | Cache de categorias, que não mudou nenhum contrato |
| **PATCH** | Correção de defeito, sem funcionalidade nova | Corrigir o tratamento de falha de login |

### O critério prático

Na dúvida entre MAJOR e MINOR, a pergunta é uma só:

> **Um cliente da versão anterior continua funcionando sem mudar nada?**

Se a resposta é não, é MAJOR. Não importa o tamanho da mudança no código — importa o que ela
exige de quem consome.

### Por que esta release é 2.0.0, e não 1.1.0

Foi a decisão real que o critério acima resolveu, e vale registrar.

A tentação era chamar de 1.1.0: "é a mesma loja, só reorganizada por dentro". Mas o app da
v1.0.0 apontava para `http://<ip>:3000` sem prefixo, e **essa porta não existe mais** — o
Compose deixou de publicá-la, e todo acesso passa pelo gateway em `:8080/api`. Um cliente da
v1 não fala mais com este sistema.

Isso é exatamente o que o MAJOR descreve. Chamar de MINOR seria prometer uma compatibilidade
que não existe — e a promessa é o que dá sentido ao número.

## Como a versão se forma

Os **Conventional Commits** que o projeto já usa carregam a informação:

| Prefixo do commit | Efeito na próxima versão |
|---|---|
| `fix:` | PATCH |
| `feat:` | MINOR |
| `BREAKING CHANGE:` no corpo, ou `!` depois do tipo | MAJOR |
| `docs:` `chore:` `ci:` `test:` `refactor:` | nenhum, sozinhos |

Por isso o commitlint no hook `commit-msg` não é burocracia: é o que torna possível olhar o
histórico e saber qual deve ser o próximo número.

O **CHANGELOG.md** é escrito **a cada release**, não a cada commit. Commits descrevem
mudanças técnicas; o changelog descreve o que mudou para quem usa.

## Quando publicar uma release

**Ao fim de cada sprint**, se houve entrega que valha marcar. Uma sprint só de documentação
interna pode não gerar release.

A ordem importa:

1. Todos os PRs da sprint mergeados na `dev`
2. CI verde na `dev`
3. `CHANGELOG.md` atualizado com a versão nova
4. Só então a tag — ela precisa cobrir tudo que a release anuncia

```bash
git checkout dev && git pull --ff-only
git tag -a v2.0.0 -m "Arquitetura em 3 microsservicos com bancos separados"
git push origin v2.0.0
gh release create v2.0.0 --title "v2.0.0 — Microsservicos" --notes-file CHANGELOG.md
```

A tag é **anotada** (`-a`), nunca leve: guarda autor, data e mensagem, e é o que o GitHub usa
para montar a página de Releases.

## Histórico

| Versão | Data | O que marca |
|---|---|---|
| [1.0.0](https://github.com/JoaoVitorMcz/pcforge/releases/tag/v1.0.0) | 21/10/2026 | Monólito entregue no módulo anterior |
| [2.0.0](https://github.com/JoaoVitorMcz/pcforge/releases/tag/v2.0.0) | 03/11/2026 | Decomposição em três microsserviços |

## Não confundir com o ID do card na branch

São duas coisas diferentes, e ambas usam a palavra "tag" em conversa:

- **Tag de versão** (`v2.0.0`) — marca um ponto do histórico que foi publicado. É o assunto
  deste documento.
- **ID do card na branch** (`feature/SCRUM-27-...`) — liga o trabalho ao requisito no Jira.
  É rastreabilidade, descrita em [fluxo-de-trabalho.md](fluxo-de-trabalho.md).

A primeira responde *"o que foi entregue e quando"*; a segunda, *"por que este código
existe"*.
