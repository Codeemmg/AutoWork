
// Módulo de memória conversacional por número de telefone

const memoriaPorUsuario = {};

function getMemoria(numero) {
  if (!memoriaPorUsuario[numero]) {
    memoriaPorUsuario[numero] = {};
  }
  return memoriaPorUsuario[numero];
}

function atualizarMemoria(numero, chave, valor) {
  const memoria = getMemoria(numero);
  memoria[chave] = valor;
}

function limparMemoria(numero) {
  delete memoriaPorUsuario[numero];
}

function getTudo(numero) {
  return memoriaPorUsuario[numero] || {};
}

module.exports = {
  getMemoria,
  atualizarMemoria,
  limparMemoria,
  getTudo
};
