# Fluxo de trabalho e Definição de Pronto

Como a dupla usa o board do Jira e quando um card pode ser considerado pronto. Combinado na
SCRUM-13, válido a partir da **Sprint 2**.

Projeto Jira: **SCRUM** · board 1 · https://pcforge.atlassian.net

## As quatro colunas

O board tem quatro colunas. A regra de cada uma é o **evento** que faz o card mudar, não a
sensação de progresso.

| Coluna | Quando o card entra aqui |
|---|---|
| **A fazer** | Card criado e priorizado. Ninguém começou. |
| **Em andamento** | A branch foi criada e o primeiro commit existe. |
| **Em análise** | O PR está aberto contra a `dev` e o CI rodou. |
| **Concluído** | O PR foi mergeado e a Definição de Pronto está cumprida. |

Um card em "Em andamento" sem branch é um card que ninguém começou de fato. Se o trabalho
parar, o card volta para "A fazer" — manter em andamento o que está parado faz o board
mentir, e o board é justamente o que a rubrica avalia.

**Um card por vez, por pessoa.** Dois cards em "Em andamento" com o mesmo responsável
significam que nenhum dos dois está recebendo atenção.

## Definição de Pronto

Um card só vai para **Concluído** quando **todos** os itens abaixo valem:

1. **O código está na `dev`**, via PR mergeado — não em branch parada nem só na máquina.
2. **O CI passou**: os cinco checks verdes (Backend Tests, Frontend Tests, E2E Playwright,
   Mobile Checks, GitGuardian). CI vermelho não vira Concluído, por mais simples que pareça
   a mudança.
3. **A outra pessoa revisou o PR** e aprovou.
4. **A documentação acompanhou**, quando a mudança a afeta: decisão de arquitetura vira ADR
   em `docs/adr/`; armadilha nova entra no `CLAUDE.md`; diagrama entra pelo padrão de
   [docs/diagramas/README.md](../diagramas/README.md).
5. **O card foi movido no Jira** e tem a branch ou o PR referenciado.

Sem essa lista, "pronto" vira opinião — e duas pessoas têm duas opiniões.

## Branches e commits

Ramificar **sempre da `dev`**, nunca da `main`, com `git pull` antes:

```
feature/SCRUM-<n>-descricao-curta
fix/SCRUM-<n>-descricao-curta
```

Exemplos reais do projeto: `feature/SCRUM-44-padronizar-diagramas`,
`fix/habilitar-actions-no-pcforge`.

Commits seguem **Conventional Commits** em português — há commitlint no hook `commit-msg`,
então uma mensagem fora do padrão é recusada na hora do commit. Tipos em uso: `feat`, `fix`,
`docs`, `chore`, `test`, `ci`, `refactor`, `build`.

O número do card vai no **nome da branch**, não em cada commit. A branch aparece no PR, e o
PR fica ligado ao card.

## Pull request

O PR é o que faz a coluna "Em análise" existir. Descrição curta dizendo **qual card** e **o
que muda**. Esperar o CI antes de pedir revisão: pedir revisão de código que o CI vai
reprovar gasta o tempo da outra pessoa.

Quem abre o PR não o mergeia sozinho quando a mudança é de código. Documentação pode seguir
com um aviso no grupo.

## Quando esta regra passou a valer

A **Sprint 1 não seguiu este fluxo** e isso está visível no histórico: os dez commits do
back-end entraram direto na `dev`, sem PR, e antes de o GitHub Actions estar funcionando no
repositório novo. O código está verde hoje — o pipeline passou nos quatro jobs depois que
foi destravado —, mas nada daquilo foi revisado por outra pessoa.

O registro fica aqui de propósito. O histórico do repositório mostra a ausência de PRs de
qualquer forma; um documento que finge que a regra sempre valeu é menos defensável do que um
que diz quando ela começou.

**A partir da Sprint 2, a regra vale para os dois.**
