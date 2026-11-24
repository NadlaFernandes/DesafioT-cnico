require('dotenv').config();

const { MongoClient } = require('mongodb');

if (!process.env.MONGO_URI) {
  throw new Error('Defina MONGO_URI no arquivo .env antes de executar o diagnóstico.');
}

const NOME_INDICE = 'idx_orders_city_status_createdAt';
const dbName = process.env.MONGO_DB_NAME_TAREFA2 || 'marketplace_tarefa2';
const dataLimite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const filtro = {
  shippingCity: 'São Paulo',
  status: 'DELIVERED',
  createdAt: { $gte: dataLimite },
};
const ordenacao = { createdAt: -1 };

function coletarStages(no, stages = new Set()) {
  if (!no || typeof no !== 'object') return stages;
  if (typeof no.stage === 'string') stages.add(no.stage);
  for (const valor of Object.values(no)) {
    if (Array.isArray(valor)) valor.forEach((item) => coletarStages(item, stages));
    else if (valor && typeof valor === 'object') coletarStages(valor, stages);
  }
  return stages;
}

function resumirExplain(explain) {
  const winningPlan = explain.queryPlanner?.winningPlan;
  const executionStats = explain.executionStats ?? {};
  return {
    executionTimeMillis: executionStats.executionTimeMillis,
    totalDocsExamined: executionStats.totalDocsExamined,
    totalKeysExamined: executionStats.totalKeysExamined,
    nReturned: executionStats.nReturned,
    winningPlanStages: [...coletarStages(winningPlan)],
    executionStages: [...coletarStages(executionStats.executionStages)],
  };
}

async function executarDiagnostico() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();

  try {
    const db = client.db(dbName);
    const orders = db.collection('orders');
    const indices = await orders.listIndexes().toArray();

    // Permite repetir a demonstração: remove somente o índice nomeado por este script.
    if (indices.some((indice) => indice.name === NOME_INDICE)) {
      await orders.dropIndex(NOME_INDICE);
    }

    const explainAntes = await orders.find(filtro).sort(ordenacao).explain('executionStats');
    console.log('ANTES DO ÍNDICE');
    console.log(`Filtro: ${JSON.stringify({ ...filtro, createdAt: { $gte: dataLimite.toISOString() } })}`);
    console.dir(resumirExplain(explainAntes), { depth: null, colors: true });

    const definicaoIndice = { shippingCity: 1, status: 1, createdAt: -1 };
    await orders.createIndex(definicaoIndice, { name: NOME_INDICE });
    const explainDepois = await orders.find(filtro).sort(ordenacao).explain('executionStats');

    console.log('\nDEPOIS DO ÍNDICE');
    console.log(`Índice: ${JSON.stringify(definicaoIndice)}`);
    console.dir(resumirExplain(explainDepois), { depth: null, colors: true });
  } finally {
    await client.close();
  }
}

executarDiagnostico().catch((erro) => {
  console.error('Erro ao executar diagnóstico:', erro.message);
  process.exit(1);
});
