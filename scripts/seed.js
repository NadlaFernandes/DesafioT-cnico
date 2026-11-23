require('dotenv').config();

const { MongoClient, ObjectId } = require('mongodb');

const TOTAL_USUARIOS = 5000;
const TOTAL_PRODUTOS = 1000;
const TOTAL_PEDIDOS = 100000;
const TAMANHO_LOTE = 1000;

if (!process.env.MONGO_URI) {
  throw new Error('Defina MONGO_URI no arquivo .env antes de executar o seed.');
}

const aleatorio = (itens) => itens[Math.floor(Math.random() * itens.length)];
const executarEmLotes = async (colecao, documentos) => {
  for (let inicio = 0; inicio < documentos.length; inicio += TAMANHO_LOTE) {
    await colecao.insertMany(documentos.slice(inicio, inicio + TAMANHO_LOTE), { ordered: false });
  }
};
const removerIndicesSecundarios = async (colecao) => {
  const indices = await colecao.listIndexes().toArray();
  await Promise.all(indices.filter((indice) => indice.name !== '_id_').map((indice) => colecao.dropIndex(indice.name)));
};

async function executarSeed() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();

  try {
    const db = client.db(process.env.MONGO_DB_NAME || 'marketplace');
    const usuarios = db.collection('usuarios');
    const produtos = db.collection('produtos');
    const pedidos = db.collection('pedidos');

    // Garante uma execução reproduzível, sem misturar dados ou índices de seeds anteriores.
    await Promise.all([removerIndicesSecundarios(usuarios), removerIndicesSecundarios(produtos), removerIndicesSecundarios(pedidos)]);
    await Promise.all([usuarios.deleteMany({}), produtos.deleteMany({}), pedidos.deleteMany({})]);

    const vendedores = [];
    const compradores = [];
    const documentosUsuarios = Array.from({ length: TOTAL_USUARIOS }, (_, indice) => {
      const tipo = indice < 1000 ? 'vendedor' : 'comprador';
      const usuario = {
        _id: new ObjectId(),
        nome: tipo === 'vendedor' ? `Loja ${indice + 1}` : `Comprador ${indice - 999}`,
        tipo,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (tipo === 'vendedor' ? vendedores : compradores).push(usuario);
      return usuario;
    });
    await executarEmLotes(usuarios, documentosUsuarios);

    const documentosProdutos = Array.from({ length: TOTAL_PRODUTOS }, (_, indice) => ({
      _id: new ObjectId(),
      vendedorId: vendedores[indice % vendedores.length]._id,
      nome: `Produto ${indice + 1}`,
      preco: Number((Math.random() * 990 + 10).toFixed(2)),
      estoque: Math.floor(Math.random() * 91) + 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await executarEmLotes(produtos, documentosProdutos);

    const agora = Date.now();
    const documentosPedidos = Array.from({ length: TOTAL_PEDIDOS }, () => {
      const produto = aleatorio(documentosProdutos);
      const quantidade = Math.floor(Math.random() * 3) + 1;
      return {
        _id: new ObjectId(),
        compradorId: aleatorio(compradores)._id,
        produtoId: produto._id,
        quantidade,
        valorTotal: Number((produto.preco * quantidade).toFixed(2)),
        data: new Date(agora - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000)),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
    await executarEmLotes(pedidos, documentosPedidos);

    console.table({
      usuarios: await usuarios.countDocuments(),
      produtos: await produtos.countDocuments(),
      pedidos: await pedidos.countDocuments(),
    });
    console.log('Seed concluído sem criar índices secundários.');
  } finally {
    await client.close();
  }
}

executarSeed().catch((erro) => {
  console.error('Erro ao executar seed:', erro.message);
  process.exit(1);
});
