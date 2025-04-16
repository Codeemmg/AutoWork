const db = require('../db');
const moment = require('moment');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const fs = require('fs');
const path = require('path');

const largura = 700;
const altura = 400;

const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: largura, height: altura });

async function gerarGraficosResumo() {
  const inicioSemana = moment().startOf('isoWeek').format('YYYY-MM-DD');
  const fimSemana = moment().endOf('isoWeek').format('YYYY-MM-DD');

  try {
    const [dados] = await db.query(
      `SELECT produto, DATE(data) as dia, SUM(valor) as total
       FROM registros
       WHERE tipo = 'saida' AND data BETWEEN ? AND ?
       GROUP BY produto, dia
       ORDER BY dia ASC`,
      [inicioSemana, fimSemana]
    );

    if (!dados.length) {
      return null;
    }

    // Organizar dados por dia e por produto
    const dias = [...new Set(dados.map(d => moment(d.dia).format('ddd')))];
    const porDia = dias.map(d => {
      const total = dados
        .filter(r => moment(r.dia).format('ddd') === d)
        .reduce((soma, item) => soma + parseFloat(item.total), 0);
      return total;
    });

    // Gráfico de barras: gastos por dia
    const configBar = {
      type: 'bar',
      data: {
        labels: dias,
        datasets: [{
          label: 'Gastos por Dia',
          data: porDia,
          backgroundColor: 'rgba(255, 99, 132, 0.7)'
        }]
      },
      options: { responsive: true }
    };

    const bufferBar = await chartJSNodeCanvas.renderToBuffer(configBar);
    const pathBar = path.join(__dirname, '../graficos/grafico_semana.png');
    fs.writeFileSync(pathBar, bufferBar);

    // Gráfico de pizza: por produto
    const porProduto = {};
    for (let item of dados) {
      porProduto[item.produto] = (porProduto[item.produto] || 0) + parseFloat(item.total);
    }

    const configPie = {
      type: 'pie',
      data: {
        labels: Object.keys(porProduto),
        datasets: [{
          data: Object.values(porProduto),
          backgroundColor: ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff']
        }]
      },
      options: { responsive: true }
    };

    const bufferPie = await chartJSNodeCanvas.renderToBuffer(configPie);
    const pathPie = path.join(__dirname, '../graficos/grafico_pizza.png');
    fs.writeFileSync(pathPie, bufferPie);

    return {
      graficoBar: pathBar,
      graficoPizza: pathPie
    };
  } catch (err) {
    console.error('❌ Erro ao gerar gráficos:', err.message);
    return null;
  }
}

module.exports = gerarGraficosResumo;
