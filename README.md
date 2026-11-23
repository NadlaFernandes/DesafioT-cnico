# Marketplace simples

> Estado atual (Parte 3): a aplicação usa MongoDB e os dados permanecem após reiniciar o servidor. A descrição de armazenamento em memória abaixo se aplica somente às partes 1 e 2 do desafio.

API monolítica em Node.js + Express para cadastrar vendedores e compradores, anunciar produtos e registrar compras. O armazenamento é em memória: todos os dados são apagados quando o processo é reiniciado.

## Requisitos

- Node.js 18 ou superior
- npm

## Executar

```bash
npm install
node index.js
```

No PowerShell em que `npm` estiver bloqueado, use `npm.cmd install`. Também é possível iniciar com `npm.cmd start`.

O servidor inicia em `http://localhost:3000`. Para desenvolvimento com reinício automático, use `npm run dev`.

## Endpoints

| Método | Caminho | Uso |
| --- | --- | --- |
| GET | `/health` | Verificar se a API está ativa |
| POST | `/usuarios` | Cadastrar usuário (`vendedor` ou `comprador`) |
| GET | `/usuarios` | Listar usuários |
| POST | `/produtos` | Cadastrar produto de um vendedor |
| GET | `/produtos` | Listar produtos com estoque disponível |
| POST | `/pedidos` | Comprar produto e atualizar estoque |
| GET | `/pedidos` | Listar pedidos |

Todas as requisições de escrita usam JSON. As respostas de criação usam HTTP 201; dados inválidos retornam 400 e papéis sem permissão retornam 403.

## Roteiro manual de teste

Use Postman, Insomnia ou `curl`. Execute as chamadas na ordem e use os IDs retornados nas chamadas seguintes.

1. `POST http://localhost:3000/usuarios`

```json
{ "nome": "Ana Vendedora", "tipo": "vendedor" }
```

2. `POST http://localhost:3000/usuarios`

```json
{ "nome": "Bruno Comprador", "tipo": "comprador" }
```

3. `POST http://localhost:3000/produtos`

```json
{ "vendedorId": 1, "nome": "Teclado", "preco": 150.9, "estoque": 5 }
```

4. `GET http://localhost:3000/produtos` para conferir a vitrine.

5. `POST http://localhost:3000/pedidos`

```json
{ "compradorId": 2, "produtoId": 1, "quantidade": 2 }
```

6. `GET http://localhost:3000/produtos` para confirmar que o estoque caiu para 3; `GET http://localhost:3000/pedidos` para consultar a compra.

Para testar validações, tente cadastrar produto com `vendedorId` de um comprador ou comprar quantidade maior que o estoque. A API deve responder com erro e manter o estoque inalterado.

## Roteiro de entrega — Parte 2

Inicie a API com `node index.js` (ou `npm.cmd start`) e execute em outro terminal os comandos abaixo. Eles reproduzem o fluxo solicitado no desafio. Ao terminar, registre capturas do terminal ou da ferramenta HTTP mostrando a criação dos dois usuários, do produto, a vitrine e o pedido.

```powershell
# 1. Vendedor — resposta esperada: id 1
Invoke-RestMethod -Method Post -Uri http://localhost:3000/usuarios -ContentType 'application/json' -Body '{"nome":"Loja Tech","tipo":"vendedor"}'

# 2. Comprador — resposta esperada: id 2
Invoke-RestMethod -Method Post -Uri http://localhost:3000/usuarios -ContentType 'application/json' -Body '{"nome":"João Silva","tipo":"comprador"}'

# 3. Produto — resposta esperada: estoque 5
Invoke-RestMethod -Method Post -Uri http://localhost:3000/produtos -ContentType 'application/json' -Body '{"vendedorId":1,"nome":"Teclado Mecânico","preco":250,"estoque":5}'

# 4. Vitrine — deve listar o Teclado Mecânico com estoque 5
Invoke-RestMethod http://localhost:3000/produtos

# 5. Compra — resposta esperada: valorTotal 500 e quantidade 2
Invoke-RestMethod -Method Post -Uri http://localhost:3000/pedidos -ContentType 'application/json' -Body '{"compradorId":2,"produtoId":1,"quantidade":2}'

# 6. Comprovação final — o estoque deve ser 3
Invoke-RestMethod http://localhost:3000/produtos
```

Se reiniciar o servidor, execute a sequência novamente desde o primeiro passo: os dados ficam somente em memória.

## Parte 3 — Persistência com MongoDB

Instale e inicie o MongoDB local, ou use um cluster do MongoDB Atlas. O projeto já possui `.env` com a conexão local padrão. Para Atlas, substitua o valor de `MONGO_URI` no arquivo `.env` pela URI do seu cluster. Não envie esse arquivo ao GitHub: ele está listado no `.gitignore`. Use `.env.example` como referência.

```env
MONGO_URI=mongodb://localhost:27017/marketplace
```

Depois, execute:

```powershell
npm.cmd install
node index.js
```

Ao iniciar corretamente, o terminal mostra `Conectado ao MongoDB com sucesso!` antes do endereço da API. Os dados passam a permanecer no banco após encerrar e iniciar o servidor.

O MongoDB gera `_id` próprios, parecidos com `692...`. Ao criar o vendedor, o comprador e o produto, copie os respectivos `_id` retornados e use-os como `vendedorId`, `compradorId` e `produtoId` nas requisições seguintes. Os exemplos numéricos `1` e `2` das partes anteriores não se aplicam à versão MongoDB.

## Parte 4 — Seed e índices

O script de seed gera 5.000 usuários (1.000 vendedores e 4.000 compradores), 1.000 produtos e 100.000 pedidos. Os documentos são inseridos em lotes de 1.000 com `insertMany`.

> Atenção: `npm run seed` remove os documentos e índices secundários existentes nas coleções `usuarios`, `produtos` e `pedidos` antes de inserir a massa de dados.

```powershell
npm.cmd run seed
npm.cmd run amostra
```

O primeiro comando deve exibir as contagens `5000`, `1000` e `100000`. O segundo mostra uma amostra de cada coleção e seus índices. Após o seed, haverá somente o índice padrão `_id_`, demonstrando o cenário sem índices secundários.

Para resolver os gargalos de buscas por tipo de usuário, vendedor, estoque, comprador e produto, execute:

```powershell
npm.cmd run criar-indices
npm.cmd run amostra
```
