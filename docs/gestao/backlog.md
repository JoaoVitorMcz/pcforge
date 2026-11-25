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

## Sprint 1 — Fundação · 07/10 a 21/10 (encerrada no Jira em 23/10) · 43 pontos

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
| SCRUM-45 | Regra das 24h e ID do card nas branches | 2 | João | ✅ |
| SCRUM-46 | Loja consome `pagamento.aprovado` e marca o pedido como pago | 3 | Henrique | ✅ |

O planejamento previa os 13 primeiros cards, com 38 pontos. A SCRUM-45 (2) e a SCRUM-46 (3)
entraram durante a sprint: o Jira fechou a Sprint 1 com **15 cards e 43 pontos**.

**Velocidade medida da Sprint 1: 43 pontos.**

## Sprint 2 — Mensageria · 23/10 a 02/11 (encerrada no Jira em 05/11) · 36 pontos

| Card | Resumo | Pts | Quem | Estado |
|---|---|---|---|---|
| SCRUM-41 | Extrair Pagamentos com banco próprio | **8** | Henrique | ✅ |
| SCRUM-24 | Serviço de Notificações com banco próprio | 5 | Henrique | ✅ |
| SCRUM-42 | Nginx como gateway e mobile pelo gateway | 5 | Henrique | ✅ |
| SCRUM-26 | Logs estruturados com id por requisição | 3 | Henrique | ✅ |
| SCRUM-28 | Diagramas C4 (Contexto e Containers) | 3 | João | ✅ |
| SCRUM-29 | Context Map e Bounded Contexts | 3 | João | ✅ |
| SCRUM-30 | Entities, Value Objects e Aggregates | 3 | João | ✅ |
| SCRUM-23 | Loja publica eventos de pedido | 2 | Henrique | ✅ |
| SCRUM-25 | Invalidar cache via evento | 2 | Henrique | ✅ |
| SCRUM-27 | Releases versionadas | 2 | João | ✅ |

**SCRUM-41 é o card mais arriscado do projeto inteiro.** São 8 pontos porque não é só mover
código: cria serviço, cria banco, inverte o fluxo de confirmação de pagamento e obriga a
mexer na tela de retorno do checkout — detalhado no
[ADR-002](../adr/002-corte-microsservicos.md). A SCRUM-23 publica `pedido.criado.v1`, que
é a entrada de dados necessária para a SCRUM-41 persistir os pedidos recebidos.

A carga do Henrique nesta sprint foi de 25 dos 36 pontos.

## Sprint 3 — Arquitetura · 05/11 a 21/11 (encerrada no Jira em 24/11) · 32 pontos

| Card | Resumo | Pts | Quem | Estado |
|---|---|---|---|---|
| SCRUM-33 | OpenAPI/Swagger da API | 5 | Henrique | ✅ |
| SCRUM-35 | Resiliência no Pagamentos (timeout, retry, circuit breaker) | 5 | Henrique | ✅ |
| SCRUM-36 | Pipeline CI/CD com deploy | 5 | Henrique | ✅ |
| SCRUM-37 | Blue/green com Nginx e rollback | 5 | Henrique | ✅ |
| SCRUM-31 | ADRs principais (inclui ADR do banco) | 3 | João | ✅ |
| SCRUM-34 | SLOs/SLIs e observabilidade | 3 | João | ✅ |
| SCRUM-32 | Quality Scenarios | 2 | João | ✅ |
| SCRUM-38 | Runbook de incidentes | 2 | João | ✅ |
| SCRUM-47 | Desenhar C4 e Context Map no draw.io | 2 | João | ✅ |

## Resultado

| Sprint | Cards | Pontos no Jira | Observação |
|---|---|---|---|
| 1 | 15 | 43 | SCRUM-45 e SCRUM-46 entraram durante a sprint |
| 2 | 10 | 36 | concentrou o risco técnico (SCRUM-41) |
| 3 | 9 | 32 | quase toda documentação, dividida entre os dois |
| **Total** | **34** | **111** | 17 cards para cada um |

Fora das sprints há a **SCRUM-48**, do tipo Erro: registro retroativo do estoque que não era
debitado, corrigido em 29/08 (commit `9ce98d0`), antes de o board existir.

O plano original somava 107 pontos. A diferença vem dos cards que entraram no meio do
caminho, registrados acima. A Sprint 2 não escorregou, e a Sprint 3 fechou na entrega
interna de 21/11.
