# Tarefa 1 — Modelagem e evolução de schema no MongoDB

## Decisões de modelagem

Para avaliações, usarei **referencing** na coleção completa de avaliações e **embedding limitado** no produto para guardar o resumo e as dez avaliações mais recentes. Assim, o documento do produto não cresce com todas as avaliações e a tela de detalhe não precisa calcular a média nem ordenar milhares de documentos a cada leitura.

Para auditoria, usarei **embedding** do histórico de status no pedido. O fluxo de status informado tem poucas transições conhecidas e cada evento pertence ao pedido. O usuário responsável será identificado por uma referência (`ObjectId`) à coleção `usuarios`.

## 1. Avaliações de produtos

### Coleção `produtos` — resumo e avaliações recentes embutidos

```json
{
  "_id": { "$oid": "665000000000000000000001" },
  "nome": "Teclado Mecânico",
  "preco": 250.0,
  "avaliacoesResumo": {
    "total": 24831,
    "somaNotas": 112486,
    "media": 4.53
  },
  "avaliacoesRecentes": [
    {
      "avaliacaoId": { "$oid": "665000000000000000000101" },
      "nota": 5,
      "comentario": "Ótimo produto.",
      "data": { "$date": "2026-11-23T18:30:00Z" },
      "autor": {
        "usuarioId": { "$oid": "665000000000000000000201" },
        "nome": "Ana Silva"
      }
    }
  ]
}
```

`avaliacoesResumo` e `avaliacoesRecentes` são **embedding** no documento do produto. O array guarda no máximo 10 elementos. O nome do autor é uma cópia (snapshot) para a tela não precisar consultar `usuarios`; `usuarioId` mantém a referência ao autor original. `avaliacaoId` aponta para o registro completo na coleção `avaliacoes`.

### Coleção `avaliacoes` — todas as avaliações referenciadas

```json
{
  "_id": { "$oid": "665000000000000000000101" },
  "produtoId": { "$oid": "665000000000000000000001" },
  "autorId": { "$oid": "665000000000000000000201" },
  "nota": 5,
  "comentario": "Ótimo produto.",
  "data": { "$date": "2026-11-23T18:30:00Z" }
}
```

`produtoId` e `autorId` são **referencing** para `produtos` e `usuarios`. Cada avaliação é um documento independente, permitindo que o produto receba dezenas de milhares de avaliações sem aumentar continuamente de tamanho. Para listar ou paginar o histórico completo de um produto, criar o índice composto `{ produtoId: 1, data: -1 }`.

### Atualização do resumo

Ao inserir uma avaliação, atualizar o produto atomicamente: incrementar `avaliacoesResumo.total` e `avaliacoesResumo.somaNotas`, recalcular `media` e adicionar a nova avaliação a `avaliacoesRecentes`, ordenando por data decrescente e mantendo apenas as 10 primeiras. Em termos de atualização MongoDB, a operação sobre o array pode usar `$push` com `$sort` e `$slice: 10`. O campo `somaNotas` permite calcular a média como `somaNotas / total` sem percorrer avaliações antigas.

Se for necessário garantir que o documento em `avaliacoes` e o resumo no produto sejam gravados juntos, executar as duas gravações em uma transação (em um replica set ou cluster Atlas). A operação de atualização do produto é atômica por documento.

## 2. Auditoria de pedidos

### Coleção `pedidos` — histórico de status embutido

```json
{
  "_id": { "$oid": "665000000000000000000301" },
  "compradorId": { "$oid": "665000000000000000000201" },
  "status": "Enviado",
  "historicoStatus": [
    {
      "status": "Pendente",
      "data": { "$date": "2026-11-22T10:00:00Z" },
      "usuarioId": { "$oid": "665000000000000000000201" }
    },
    {
      "status": "Pago",
      "data": { "$date": "2026-11-22T10:05:00Z" },
      "usuarioId": { "$oid": "665000000000000000000401" }
    },
    {
      "status": "Enviado",
      "data": { "$date": "2026-11-23T09:00:00Z" },
      "usuarioId": { "$oid": "665000000000000000000402" }
    }
  ]
}
```

`historicoStatus` usa **embedding** porque as poucas mudanças previstas (`Pendente -> Pago -> Enviado -> Entregue`) são parte do próprio pedido e normalmente são consultadas junto com ele. O campo `status` mantém o estado atual para consultas rápidas, sem precisar procurar o último evento do histórico. Cada `usuarioId` usa **referencing** para a coleção `usuarios`; opcionalmente, pode-se guardar no evento o nome do responsável como snapshot para preservar o nome exibido na época da mudança.

O evento inicial (`Pendente`) deve ser criado junto com o pedido. Em cada transição, atualizar `status` e acrescentar ao histórico um evento com o novo status, a data e o usuário responsável.

## Como a modelagem evita Unbounded Arrays

As dezenas de milhares de avaliações ficam em documentos separados na coleção `avaliacoes`; o documento `produtos` guarda somente as dez mais recentes. Portanto, o array de avaliações recentes tem limite explícito e não pode crescer sem controle.

O histórico de status fica no pedido porque o fluxo apresentado tem quatro estados e poucas transições por pedido. O tamanho do array é limitado pelo ciclo de vida definido. Se o negócio passar a permitir reaberturas ou alterações ilimitadas, ou exigir um log sem limite de retenção, os eventos devem migrar para uma coleção `eventosPedido` com referência `pedidoId` e índice `{ pedidoId: 1, data: 1 }`.

Essa separação evita acumular avaliações ou eventos ilimitados dentro de um único documento e ajuda a manter os documentos muito abaixo do limite BSON de 16 MB.

## Como a tela do produto fica rápida

Ao buscar o produto por `_id`, a tela recebe no próprio documento a média, o total e as dez avaliações mais recentes. Não precisa contar todas as avaliações, calcular uma média ou ordenar dezenas de milhares de registros durante a leitura. O índice padrão `_id_` atende à busca do produto. A coleção `avaliacoes` com índice `{ produtoId: 1, data: -1 }` fica disponível para a tela de histórico completo ou paginação, sem pesar a leitura inicial.

---

# Tarefa 3 — Diagnóstico e otimização de consulta

## Consulta analisada

```javascript
db.orders.find({
  shippingCity: "São Paulo",
  status: "DELIVERED",
  createdAt: { $gte: new Date(Date.now() - 30 * 86400000) }
}).sort({ createdAt: -1 })
```

O diagnóstico usa `explain("executionStats")` na coleção `orders` do banco `marketplace_tarefa2`, gerada pela seed da Tarefa 2. A janela de 30 dias é calculada uma vez e reutilizada nas medições antes e depois.

## Antes do índice

Sem índice secundário compatível, o plano esperado é `COLLSCAN`: o MongoDB lê os documentos da coleção para encontrar os pedidos que correspondem às condições e precisa ordenar os resultados.

| Indicador | Valor observado antes |
| --- | ---: |
| `executionTimeMillis` | 65 ms |
| Estágios do plano | `COLLSCAN` e `SORT` |
| `totalDocsExamined` | 100.000 |
| `totalKeysExamined` | 0 |
| `nReturned` | 536 |

## Índice composto — regra ESR

```javascript
db.orders.createIndex(
  { shippingCity: 1, status: 1, createdAt: -1 },
  { name: "idx_orders_city_status_createdAt" }
)
```

Os campos de igualdade (`shippingCity` e `status`) vêm primeiro. `createdAt` vem em seguida na direção descendente para atender à ordenação decrescente; o mesmo campo também delimita a janela temporal de 30 dias. A ordem do índice segue Equality, Sort, Range (ESR) para os predicados apresentados.

## Depois do índice

Preencher esta tabela com a segunda parte da saída do diagnóstico:

| Indicador | Valor observado depois |
| --- | ---: |
| `executionTimeMillis` | 9 ms |
| Estágios do plano | `IXSCAN` e `FETCH` |
| `totalDocsExamined` | 536 |
| `totalKeysExamined` | 536 |
| `nReturned` | 536 |

Na execução registrada, os documentos examinados caíram de 100.000 para 536 (redução de 99,46%) e o tempo medido caiu de 65 ms para 9 ms. O plano passou de `COLLSCAN` mais `SORT` para `IXSCAN` mais `FETCH`, sem estágio de ordenação. Os tempos são uma observação desta execução e podem variar entre execuções e máquinas; os estágios e a redução de documentos examinados demonstram o efeito do índice.

## Como reproduzir

Com MongoDB ativo e a seed da Tarefa 2 executada:

```powershell
npm.cmd run diagnostico:tarefa3
```

O script imprime os indicadores antes e depois e cria o índice em `marketplace_tarefa2.orders`. Ao repetir o comando, ele remove somente o índice de diagnóstico com o nome `idx_orders_city_status_createdAt`, refaz a medição sem ele e o cria novamente para repetir a comparação.
