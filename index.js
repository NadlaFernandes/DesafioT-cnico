require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());
const tiposUsuario = ['vendedor', 'comprador'];
const responderErro = (res, status, erro, detalhes) => res.status(status).json(detalhes ? { erro, detalhes } : { erro });

const Usuario = mongoose.model('Usuario', new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  tipo: { type: String, enum: tiposUsuario, required: true },
}, { timestamps: true }));

const Produto = mongoose.model('Produto', new mongoose.Schema({
  vendedorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  nome: { type: String, required: true, trim: true },
  preco: { type: Number, required: true, min: 0.01 },
  estoque: { type: Number, required: true, min: 0, validate: Number.isInteger },
}, { timestamps: true }));

const Pedido = mongoose.model('Pedido', new mongoose.Schema({
  compradorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  produtoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Produto', required: true },
  quantidade: { type: Number, required: true, min: 1, validate: Number.isInteger },
  valorTotal: { type: Number, required: true, min: 0 },
  data: { type: Date, default: Date.now },
}, { timestamps: true }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.post('/usuarios', async (req, res) => {
  try {
    const { nome, tipo } = req.body ?? {};
    if (typeof nome !== 'string' || !nome.trim() || !tiposUsuario.includes(tipo)) return responderErro(res, 400, 'Informe nome e tipo válido (vendedor/comprador).');
    return res.status(201).json(await Usuario.create({ nome, tipo }));
  } catch (erro) { return responderErro(res, 400, 'Dados inválidos para cadastro.', erro.message); }
});
app.get('/usuarios', async (_req, res) => res.json(await Usuario.find()));

app.post('/produtos', async (req, res) => {
  try {
    const { vendedorId, nome, preco, estoque } = req.body ?? {};
    const vendedor = await Usuario.findOne({ _id: vendedorId, tipo: 'vendedor' });
    if (!vendedor) return responderErro(res, 403, 'Vendedor não encontrado ou sem permissão.');
    return res.status(201).json(await Produto.create({ vendedorId: vendedor._id, nome, preco, estoque }));
  } catch (erro) { return responderErro(res, 400, 'Erro ao cadastrar produto.', erro.message); }
});
app.get('/produtos', async (_req, res) => {
  try { return res.json(await Produto.find({ estoque: { $gt: 0 } }).populate('vendedorId', 'nome')); }
  catch (_erro) { return responderErro(res, 500, 'Erro ao buscar produtos.'); }
});

app.post('/pedidos', async (req, res) => {
  try {
    const { compradorId, produtoId, quantidade } = req.body ?? {};
    if (!Number.isInteger(Number(quantidade)) || Number(quantidade) <= 0) return responderErro(res, 400, 'A quantidade deve ser um inteiro maior que zero.');
    const comprador = await Usuario.findOne({ _id: compradorId, tipo: 'comprador' });
    if (!comprador) return responderErro(res, 403, 'Comprador inválido.');
    const produto = await Produto.findById(produtoId);
    if (!produto || produto.estoque < Number(quantidade)) return responderErro(res, 400, 'Produto indisponível ou estoque insuficiente.');
    produto.estoque -= Number(quantidade);
    await produto.save();
    const pedido = await Pedido.create({ compradorId: comprador._id, produtoId: produto._id, quantidade: Number(quantidade), valorTotal: produto.preco * Number(quantidade) });
    return res.status(201).json(pedido);
  } catch (erro) { return responderErro(res, 400, 'Erro ao processar pedido.', erro.message); }
});
app.get('/pedidos', async (_req, res) => res.json(await Pedido.find()));
app.use((req, res) => responderErro(res, 404, `Rota não encontrada: ${req.method} ${req.path}`));

async function iniciarServidor() {
  if (!process.env.MONGO_URI) throw new Error('A variável MONGO_URI não foi configurada no arquivo .env.');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Conectado ao MongoDB com sucesso!');
  const porta = Number(process.env.PORT) || 3000;
  app.listen(porta, () => console.log(`Marketplace rodando em http://localhost:${porta}`));
}
iniciarServidor().catch((erro) => { console.error('Erro ao conectar ao MongoDB:', erro.message); process.exit(1); });
