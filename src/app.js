const express = require('express');
const { store } = require('./store');

const app = express();
app.use(express.json());

const tiposUsuario = ['vendedor', 'comprador'];
const respostaErro = (res, status, erro) => res.status(status).json({ erro });
const inteiroPositivo = (valor) => Number.isInteger(Number(valor)) && Number(valor) > 0;

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Usuários representam vendedores e compradores neste primeiro estágio.
app.post('/usuarios', (req, res) => {
  const { nome, tipo } = req.body ?? {};
  if (typeof nome !== 'string' || !nome.trim() || !tiposUsuario.includes(tipo)) {
    return respostaErro(res, 400, 'Informe nome e tipo válido (vendedor/comprador).');
  }

  const usuario = { id: store.proximoId('usuarios'), nome: nome.trim(), tipo };
  store.usuarios.push(usuario);
  return res.status(201).json(usuario);
});

app.get('/usuarios', (_req, res) => res.json(store.usuarios));

app.post('/produtos', (req, res) => {
  const { vendedorId, nome, preco, estoque } = req.body ?? {};
  const vendedor = store.usuarios.find((u) => u.id === Number(vendedorId) && u.tipo === 'vendedor');
  if (!vendedor) return respostaErro(res, 403, 'Vendedor não encontrado ou sem permissão.');
  if (typeof nome !== 'string' || !nome.trim()) return respostaErro(res, 400, 'Informe o nome do produto.');

  const precoNumerico = Number(preco);
  const estoqueNumerico = Number(estoque);
  if (!Number.isFinite(precoNumerico) || precoNumerico <= 0) {
    return respostaErro(res, 400, 'O preço deve ser um número maior que zero.');
  }
  if (!Number.isInteger(estoqueNumerico) || estoqueNumerico < 0) {
    return respostaErro(res, 400, 'O estoque deve ser um número inteiro igual ou maior que zero.');
  }

  const produto = {
    id: store.proximoId('produtos'),
    vendedorId: vendedor.id,
    nome: nome.trim(),
    preco: precoNumerico,
    estoque: estoqueNumerico,
  };
  store.produtos.push(produto);
  return res.status(201).json(produto);
});

app.get('/produtos', (req, res) => {
  const produtos = store.produtos.filter((produto) => produto.estoque > 0);
  return res.json(produtos);
});

app.post('/pedidos', (req, res) => {
  const { compradorId, produtoId, quantidade } = req.body ?? {};
  if (!inteiroPositivo(compradorId)) return respostaErro(res, 400, 'Informe um compradorId válido.');
  if (!inteiroPositivo(produtoId)) return respostaErro(res, 400, 'Informe um produtoId válido.');
  if (!inteiroPositivo(quantidade)) return respostaErro(res, 400, 'A quantidade deve ser um inteiro maior que zero.');

  const comprador = store.usuarios.find((u) => u.id === Number(compradorId) && u.tipo === 'comprador');
  if (!comprador) return respostaErro(res, 403, 'Comprador inválido.');
  const produto = store.produtos.find((p) => p.id === Number(produtoId));
  if (!produto || produto.estoque < Number(quantidade)) {
    return respostaErro(res, 400, 'Produto indisponível ou estoque insuficiente.');
  }

  const qtd = Number(quantidade);
  produto.estoque -= qtd;
  const pedido = {
    id: store.proximoId('pedidos'),
    compradorId: comprador.id,
    produtoId: produto.id,
    quantidade: qtd,
    valorTotal: Number((produto.preco * qtd).toFixed(2)),
    data: new Date().toISOString(),
  };
  store.pedidos.push(pedido);
  return res.status(201).json(pedido);
});

app.get('/pedidos', (_req, res) => res.json(store.pedidos));

app.use((req, res) => respostaErro(res, 404, `Rota não encontrada: ${req.method} ${req.path}`));

app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return respostaErro(res, 400, 'JSON inválido.');
  }
  console.error(err);
  return respostaErro(res, 500, 'Erro interno do servidor.');
});

module.exports = app;
