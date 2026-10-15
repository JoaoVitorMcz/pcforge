# Diagramas

Onde os diagramas do PC Forge moram, com o que são feitos e como se chamam. Combinado na
SCRUM-44, antes de os nove diagramas do módulo de microsserviços começarem a ser produzidos.

Esta pasta guarda os arquivos do draw.io. Os diagramas em Mermaid ficam dentro dos `.md` que
os explicam, em `docs/` — o índice no fim deste documento aponta para todos.

## Por que todo diagrama vive no repositório

Diagrama solto no Drive, no Figma ou num print colado no slide desatualiza e some. No
repositório ele tem histórico, aparece no diff do pull request e é encontrado junto do código
que descreve.

**A regra:** ferramenta online pode ser usada, desde que o arquivo-fonte seja salvo aqui. Um
link para um diagrama que mora fora do repositório não vale como entrega.

## Qual ferramenta para quê

**Mermaid é o padrão.** O diagrama é texto dentro do `.md`, o GitHub renderiza sozinho e o
diff mostra o que mudou linha a linha. Serve para sequência, fluxo, classes, estados e
entidade-relacionamento.

**draw.io só quando o layout carrega significado.** É o caso do C4 e do Context Map: ali a
posição das caixas, o agrupamento e a fronteira entre contextos são parte da mensagem, e o
Mermaid não dá esse controle — ele decide o layout por conta.

Na dúvida, Mermaid. Um diagrama que vira texto é mais fácil de revisar, corrigir num PR e
manter vivo.

## Como editar

### Mermaid

Escrever direto no `.md`, dentro de um bloco de código marcado como `mermaid`. O GitHub
renderiza ao abrir o arquivo. O VS Code mostra no preview do markdown.

### draw.io

Os arquivos são salvos como **`.drawio.png`**: um PNG comum que carrega o XML do diagrama
embutido. É imagem e fonte ao mesmo tempo — o GitHub exibe como figura e o draw.io reabre
para editar.

Isso é de propósito. Com um `.drawio` e um `.png` separados, é questão de tempo até alguém
editar a fonte e esquecer de reexportar a imagem; aí a figura que todo mundo vê passa a
mostrar uma versão antiga, sem avisar ninguém.

**No VS Code** (recomendado): instale a extensão **Draw.io Integration**
(`hediet.vscode-drawio`) — o projeto já a sugere ao abrir. Abrir o `.drawio.png` abre o editor
gráfico; salvar regrava o XML dentro do PNG.

**No draw.io web**: desenhe normalmente e exporte com
`File → Export as → PNG`, deixando **"Include a copy of my diagram"** marcado. É essa opção
que embute a fonte. Sem ela, o arquivo vira só uma imagem e deixa de ser editável.

Para embutir num documento: `![C4 nível 1](diagramas/c4-contexto.drawio.png)`.

## Convenção de nomes

Kebab-case, em português, nomeando o que o diagrama mostra:

```
c4-contexto.drawio.png
c4-containers.drawio.png
context-map.drawio.png
```

Sem números de versão no nome e sem data. O histórico do git já guarda isso.

## Índice

### Prontos — módulo anterior

| Diagrama | Tipo | Arquivo |
|---|---|---|
| Entidade-relacionamento | Mermaid `erDiagram` | [der.md](../der.md) |
| Caso de uso 1 — cliente compra pelo app | Mermaid `flowchart` | [casos-de-uso.md](../casos-de-uso.md) |
| Caso de uso 2 — admin gerencia a loja | Mermaid `flowchart` | [casos-de-uso.md](../casos-de-uso.md) |
| Atividade 1 — checkout do pedido | Mermaid `flowchart` | [diagramas-atividade.md](../diagramas-atividade.md) |
| Atividade 2 — cancelamento de pedido | Mermaid `flowchart` | [diagramas-atividade.md](../diagramas-atividade.md) |
| Atividade 3 — upload de imagem | Mermaid `flowchart` | [diagramas-atividade.md](../diagramas-atividade.md) |
| Sequência 1 — login com JWT e RBAC (2 diagramas) | Mermaid `sequenceDiagram` | [diagramas-sequencia.md](../diagramas-sequencia.md) |
| Sequência 2 — criar pedido: app, API e MySQL | Mermaid `sequenceDiagram` | [diagramas-sequencia.md](../diagramas-sequencia.md) |
| Sequência 3 — admin muda o status do pedido | Mermaid `sequenceDiagram` | [diagramas-sequencia.md](../diagramas-sequencia.md) |
| Modelo de dados do RBAC | Mermaid `erDiagram` | [rbac.md](../rbac.md) |
| Fluxo completo de autorização | Mermaid `sequenceDiagram` | [rbac.md](../rbac.md) |
| Arquitetura do monólito | Mermaid `flowchart` | [contextualizacao.md](../contextualizacao.md) |
| Domínios Cynefin com o projeto posicionado | Mermaid `flowchart` | [gestao/cynefin.md](../gestao/cynefin.md) |

### Previstos — módulo de microsserviços

O arquivo de destino já está definido. O card que produzir o diagrama escreve nele.

| Diagrama | Ferramenta | Arquivo | Card |
|---|---|---|---|
| C4 nível 1 — Contexto | draw.io | `docs/diagramas/c4-contexto.drawio.png` | SCRUM-28 |
| C4 nível 2 — Containers | draw.io | `docs/diagramas/c4-containers.drawio.png` | SCRUM-28 |
| Context Map — Loja, Pagamentos, Notificações e Mercado Pago com ACL | draw.io | `docs/diagramas/context-map.drawio.png` | SCRUM-29 |
| Aggregates — Pedido com ItemPedido | Mermaid `classDiagram` | `docs/ddd-aggregates.md` | SCRUM-30 |
| Sequência — cache-aside: hit, miss e invalidação | Mermaid `sequenceDiagram` | `docs/diagramas-sequencia.md` | SCRUM-18 |
| Sequência — checkout entre serviços via eventos | Mermaid `sequenceDiagram` | `docs/diagramas-sequencia.md` | SCRUM-41 |
| Pipeline de CI/CD | Mermaid `flowchart` | `docs/entrega-continua.md` | SCRUM-36 |
| Blue/green com rollback | Mermaid `flowchart` | `docs/entrega-continua.md` | SCRUM-37 |

Ao concluir um card, mova a linha para a tabela de prontos e troque o caminho pelo link.
