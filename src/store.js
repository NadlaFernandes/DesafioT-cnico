// Estado compartilhado do processo. Os dados são perdidos ao reiniciar o servidor.
const store = {
  usuarios: [],
  produtos: [],
  pedidos: [],
  sequencias: { usuarios: 0, produtos: 0, pedidos: 0 },
  proximoId(colecao) {
    this.sequencias[colecao] += 1;
    return this.sequencias[colecao];
  },
};

module.exports = { store };
