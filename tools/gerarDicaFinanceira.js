const db = require('../db');
const moment = require('moment');

async function gerarDicaFinanceira() {
  const inicioSemana = moment().startOf('isoWeek').format('YYYY-MM-DD 00:00:00');
  const fimSemana = moment().endOf('isoWeek').format('YYYY-MM-DD 23:59:59');

  try {
    const [dados] = await db.query(
      `SELECT produto, SUM(valor) as total, COUNT(*) as quantidade
       FROM registros
       WHERE tipo = 'saida' AND data BETWEEN ? AND ?
       GROUP BY produto
       ORDER BY total DESC
       LIMIT 3`,
      [inicioSemana, fimSemana]
    );

    if (!dados.length) {
      return "📭 Nenhuma despesa registrada essa semana para análise.";
    }

    const maior = dados[0];
    const totalGasto = dados.reduce((acc, item) => acc + parseFloat(item.total), 0);
    const porcentagem = ((maior.total / totalGasto) * 100).toFixed(1);
    const economiaSugerida = (maior.total * 0.5).toFixed(2);

    return `💡 *Dica Financeira da Semana*\n\n🔎 Seu maior gasto foi com *"${maior.produto}"*, somando *R$ ${parseFloat(maior.total).toFixed(2)}* (${porcentagem}% das suas saídas).\n\n📉 Se você reduzir isso pela metade, pode economizar cerca de *R$ ${economiaSugerida}* só nesta semana.`;
  } catch (err) {
    console.error("❌ Erro ao gerar dica financeira:", err.message);
    return "❌ Erro ao gerar sugestão de melhoria.";
  }
}

module.exports = gerarDicaFinanceira;
