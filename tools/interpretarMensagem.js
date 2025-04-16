function interpretarMensagem(frase) {
    frase = frase.toLowerCase();
  
    // Palavras-chave para classificar tipo
    const palavrasEntrada = ['recebi', 'ganhei', 'salário', 'freela', 'aluguel', 'pix', 'depositaram'];
    const palavrasSaida = ['gastei', 'paguei', 'comprei', 'ifood', 'gasolina', 'uber', 'mercado', 'loja', 'pix'];
  
    // Regex para extrair o valor
    const matchValor = frase.match(/(\d+[,.]?\d*)/);
    const valor = matchValor ? parseFloat(matchValor[1].replace(',', '.')) : null;
  
    // Determinar tipo
    let tipo = null;
    for (let palavra of palavrasEntrada) {
      if (frase.includes(palavra)) {
        tipo = 'entrada';
        break;
      }
    }
  
    for (let palavra of palavrasSaida) {
      if (frase.includes(palavra)) {
        tipo = 'saida';
        break;
      }
    }
  
    // Se não tiver tipo mas valor estiver presente, assume saída como padrão
    if (!tipo && valor) tipo = 'saida';
  
    // Descrição: remover valor da frase
    let descricao = frase;
    if (matchValor) {
      descricao = frase.replace(matchValor[1], '').trim();
    }
  
    return {
      frase_original: frase,
      valor: valor,
      tipo: tipo,
      descricao: descricao
    };
  }
  
  module.exports = interpretarMensagem;
  