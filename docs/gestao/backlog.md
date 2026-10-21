# Product Backlog estimado

Backlog do módulo de Microsserviços, estimado em story points. Entrega da SCRUM-16.

## A escala

Fibonacci: **1, 2, 3, 5, 8**. Story point mede **complexidade relativa**, não horas — o
ponto de comparação é outro card, não o relógio.

A Sprint 1 já foi entregue, então as estimativas não são chute: usam o trabalho real como
âncora.

| Pontos | Significa | Âncora real |
|---|---|---|
| **1** | Um arquivo, nenhuma decisão | SCRUM-20, o ADR-001 |
| **2** | Repetir um padrão que já existe | SCRUM-19, cache de categorias depois do de produtos |
| **3** | Um componente novo, caminho conhecido | SCRUM-17, Redis no Compose |
| **5** | Atravessa várias camadas ou exige decisão | SCRUM-21, erros centralizados em 8 controllers |
| **8** | Serviço novo ou mudança de contrato entre partes | SCRUM-41, extrair Pagamentos |

Acima de 8, o card é grande demais e deve ser quebrado.

## Sprint 1 — Fundação · 07/10 a 21/10 · 38 pontos

| Card | Resumo | Pts | Quem | Estado |
|---|---|---|---|---|
| SCRUM-43 | Repositório `pcforge` com histórico | 3 | João | ✅ |
| SCRUM-17 | Redis no Docker Compose | 3 | Henrique | ✅ |
| SCRUM-18 | Cache-aside em produtos e destaques | 5 | Henrique | ✅ |
| SCRUM-19 | Cache-aside em categorias | 2 | Henrique | ✅ |
| SCRUM-20 | ADR-001 Redis | 1 | Henrique | ✅ |
| SCRUM-21 | Tratamento de erros centralizado | 5 | Henrique | ✅ |
| SCRUM-22 | DTOs e validação de entrada | 5 | Henrique | ✅ |
| SCRUM-44 | Padronizar diagramas | 2 | João | ✅ |
| SCRUM-13 | Fluxo do board e DoD | 2 | João | ✅ |
| SCRUM-40 | ADR-002 corte em microsserviços | 3 | João | ✅ |
| SCRUM-14 | Análise Cynefin | 2 | João | ✅ |
| SCRUM-15 | PM Canvas | 3 | João | ✅ |
| SCRUM-16 | Refinar e estimar o backlog | 2 | João | ✅ |

**Velocidade medida da Sprint 1: 38 pontos** — a única medida real que a dupla tem.

## Sprint 2 — Mensageria · 20/10 a 02/11 · 36 pontos

| Card | Resumo | Pts | Quem |
|---|---|---|---|
| SCRUM-41 | Extrair Pagamentos com banco próprio | **8** | Henrique |
| SCRUM-24 | Serviço de Notificações com banco próprio | 5 | Henrique |
| SCRUM-23 | Loja publica eventos e consome `pagamento.aprovado` | 5 | Henrique |
| SCRUM-42 | Nginx como gateway e mobile pelo gateway | 5 | Henrique |
| SCRUM-26 | Logs estruturados com id por requisição | 3 | Henrique |
| SCRUM-28 | Diagramas C4 (Contexto e Containers) | 3 | João |
| SCRUM-29 | Context Map e Bounded Contexts | 3 | João |
| SCRUM-25 | Invalidar cache via evento | 2 | Henrique |
| SCRUM-27 | Releases versionadas | 2 | João |

**SCRUM-41 é o card mais arriscado do projeto inteiro.** São 8 pontos porque não é só mover
código: cria serviço, cria banco, inverte o fluxo de confirmação de pagamento e obriga a
mexer na tela de retorno do checkout — detalhado no
[ADR-002](../adr/002-corte-microsservicos.md). Se algum card desta sprint escorregar, é
este, e ele bloqueia a SCRUM-23.

A carga do Henrique nesta sprint é 28 dos 36 pontos. Vale observar na metade da sprint.

## Sprint 3 — Arquitetura · 03/11 a 16/11 · 33 pontos

| Card | Resumo | Pts | Quem |
|---|---|---|---|
| SCRUM-33 | OpenAPI/Swagger da API | 5 | a definir |
| SCRUM-35 | Resiliência no Pagamentos (timeout, retry, circuit breaker) | 5 | a definir |
| SCRUM-36 | Pipeline CI/CD com deploy | 5 | a definir |
| SCRUM-37 | Blue/green com Nginx e rollback | 5 | a definir |
| SCRUM-30 | Entities, Value Objects e Aggregates | 3 | a definir |
| SCRUM-31 | ADRs principais (inclui ADR do banco) | 3 | a definir |
| SCRUM-34 | SLOs/SLIs e observabilidade | 3 | a definir |
| SCRUM-32 | Quality Scenarios | 2 | a definir |
| SCRUM-38 | Runbook de incidentes | 2 | a definir |

**Nove cards sem responsável.** Precisa ser dividido antes da sprint começar.

## Leitura do plano

| Sprint | Pontos | Observação |
|---|---|---|
| 1 | 38 | entregue |
| 2 | 36 | a maior parte no Henrique |
| 3 | 33 | ninguém atribuído |
| **Total** | **107** | |

As três sprints ficam entre 33 e 38 pontos, abaixo da velocidade já comprovada de 38. O plano
é viável **se** a Sprint 2 não escorregar: ela concentra o risco técnico, e a Sprint 3 é
quase toda documentação, que não pode ser comprimida no fim sem perder rubrica.

## Pendências de organização do board

- **SCRUM-4 "Subtarefa 2.1"** é card de exemplo do Jira, sem responsável nem conteúdo.
  Apagar — ele polui o board que o avaliador vai olhar.
- **Nove cards da Sprint 3 sem responsável** (SCRUM-30 a 38). Dividir antes de 03/11.
