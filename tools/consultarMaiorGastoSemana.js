const db = require('../db');
const moment = require('moment');

async function consultarMaiorGastoSemana() {
  const hoje = moment();
  const inicioSemana = hoje.clone().startOf('isoWeek').format('YYYY-MM-DD 00:00:00');
  const fimSemana = hoje.clone().endOf('isoWeek').format('YYYY-MM-DD 23:59:59');

  try {
    const [dados] = await db.query(
      `SELECT produto, SUM(valor) as total, COUNT(*) as quantidade
       FROM registros
       WHERE tipo = 'saida' AND data BETWEEN ? AND ?
       GROUP BY produto
       ORDER BY total DESC
       LIMIT 1`,
      [inicioSemana, fimSemana]
    );

    if (!dados.length) {
      return "📭 Nenhum gasto registrado essa semana.";
    }

    const maior = dados[0];

    return `💸 Seu maior gasto da semana foi com *"${maior.produto}"*, totalizando *R$ ${parseFloat(maior.total).toFixed(2)}* em *${maior.quantidade} lançamento(s)*.`;
  } catch (err) {
    console.error("❌ Erro ao consultar maior gasto:", err.message);
    return "❌ Erro ao consultar o maior gasto da semana.";
  }
}

module.exports = consultarMaiorGastoSemana;
