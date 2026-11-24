require('dotenv').config();

const { MongoClient } = require('mongodb');

if (!process.env.MONGO_URI) {
  throw new Error('Defina MONGO_URI no arquivo .env antes de executar os relatórios.');
}

const pagina = Math.max(1, Number.parseInt(process.env.RELATORIO_PAGINA || '1', 10));
const tamanhoPagina = Math.max(1, Number.parseInt(process.env.RELATORIO_TAMANHO || '10', 10));
const inicioJanela = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

const pipelineFaturamentoCategoria = [
  {
    $match: {
      status: { $in: ['PAID', 'SHIPPED', 'DELIVERED'] },
      createdAt: { $gte: inicioJanela },
    },
  },
  { $unwind: '$items' },
  {
    $group: {
      _id: '$items.category',
      faturamentoTotal: {
        $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] },
      },
      quantidadeTotalItens: { $sum: '$items.quantity' },
    },
  },
  { $sort: { faturamentoTotal: -1, _id: 1 } },
  {
    $project: {
      _id: 0,
      categoria: '$_id',
      faturamentoTotal: { $round: ['$faturamentoTotal', 2] },
      quantidadeTotalItens: 1,
    },
  },
];

const pipelineClientesVip = [
  {
    $group: {
      _id: '$userId',
      totalGasto: { $sum: '$totalAmount' },
      quantidadePedidos: { $sum: 1 },
    },
  },
  {
    $lookup: {
      from: 'users',
      localField: '_id',
      foreignField: '_id',
      as: 'cliente',
    },
  },
  { $unwind: '$cliente' },
  { $match: { 'cliente.city': 'São Paulo' } },
  { $sort: { totalGasto: -1, _id: 1 } },
  {
    $facet: {
      dados: [
        { $skip: (pagina - 1) * tamanhoPagina },
        { $limit: tamanhoPagina },
        {
          $project: {
            _id: 0,
            nome: '$cliente.name',
            email: '$cliente.email',
            totalGasto: { $round: ['$totalGasto', 2] },
            quantidadePedidos: 1,
          },
        },
      ],
      total: [{ $count: 'clientesElegiveis' }],
    },
  },
  {
    $project: {
      _id: 0,
      pagina: { $literal: pagina },
      tamanhoPagina: { $literal: tamanhoPagina },
      totalClientesElegiveis: {
        $ifNull: [{ $arrayElemAt: ['$total.clientesElegiveis', 0] }, 0],
      },
      dados: 1,
    },
  },
];

async function executarRelatorios() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();

  try {
    const db = client.db(process.env.MONGO_DB_NAME_TAREFA2 || 'marketplace_tarefa2');

    // As agregações são executadas no servidor MongoDB; somente o resultado final é retornado.
    const faturamento = await db.collection('orders').aggregate(pipelineFaturamentoCategoria).toArray();
    const rankingVip = await db.collection('orders').aggregate(pipelineClientesVip).toArray();

    console.log(`Relatório 1 — faturamento por categoria (desde ${inicioJanela.toISOString()})`);
    console.dir(faturamento, { depth: null, colors: true });
    console.log(`Relatório 2 — clientes VIP de São Paulo (página ${pagina}, ${tamanhoPagina} por página)`);
    console.dir(rankingVip[0] || { pagina, tamanhoPagina, totalClientesElegiveis: 0, dados: [] }, { depth: null, colors: true });
  } finally {
    await client.close();
  }
}

executarRelatorios().catch((erro) => {
  console.error('Erro ao executar relatórios:', erro.message);
  process.exit(1);
});
