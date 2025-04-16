const { OpenAI } = require('openai');
require('dotenv').config();
const registerSale = require('../tools/registerSale');
const interpretarMensagem = require('../tools/interpretarMensagem');
const { registrarUsoDeTokens } = require('../tools/tokenCounter');
const consultarResumoSemana = require('../tools/consultarResumoSemana');
const detectarIntencaoViaIA = require('../tools/detectarIntencaoViaIA');
const consultarMaiorGastoSemana = require('../tools/consultarMaiorGastoSemana');
const consultarEntradasDoMes = require('../tools/consultarEntradasDoMes');
const gerarDicaFinanceira = require('../tools/gerarDicaFinanceira');
const gerarGraficosResumo = require('../tools/gerarGraficosResumo'); // novo
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MODEL = process.env.AI_MODEL || 'gpt-3.5-turbo';

async function agent(message, memory = []) {
  const resultado = interpretarMensagem(message);

  if (resultado.valor && resultado.tipo) {
    await registerSale('Pessoal', resultado.descricao, resultado.valor, resultado.tipo);
    return `✅ ${resultado.tipo === 'entrada' ? 'Entrada' : 'Saída'} registrada: R$ ${resultado.valor} - ${resultado.descricao}`;
  }

  const intencao = await detectarIntencaoViaIA(message);

  switch (intencao) {
    case 'maior_gasto':
      return await consultarMaiorGastoSemana();
    case 'resumo_semana':
      return await consultarResumoSemana();
    case 'entrada_mes':
      return await consultarEntradasDoMes();
    case 'melhoria_financeira':
      return await gerarDicaFinanceira();
    case 'grafico_semana': {
      const graficos = await gerarGraficosResumo();
      if (!graficos) {
        return { tipo: 'texto', conteudo: '📭 Nenhum dado para gerar gráfico esta semana.' };
      }
      return {
        tipo: 'imagem',
        imagens: [
          { caminho: graficos.graficoBar, legenda: '📊 Gastos por Dia da Semana' },
          { caminho: graficos.graficoPizza, legenda: '🥧 Distribuição por Categoria' }
        ]
      };
    }
    case 'registro_financeiro':
      break;
    case 'duvida':
      return "🤔 Ainda estou aprendendo! Você pode tentar perguntar de outro jeito?";
    case 'comando_invalido':
    default:
      return "❌ Não entendi o que você quis dizer. Pode tentar de outra forma?";
  }

  const prompt = `
Você é um assistente empresarial inteligente chamado AutoWork.
Seu papel é entender comandos do usuário e decidir qual ação executar, retornando uma resposta no seguinte formato JSON:

{
  "acao": "registrar_venda",
  "parametros": {
    "cliente": "nome do cliente",
    "produto": "nome do produto",
    "valor": 100.00
  }
}

Se não tiver certeza, retorne:
{
  "acao": "pergunta",
  "pergunta": "Qual o nome do cliente?"
}

Mensagem recebida: "${message}"
`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'Você é um assistente empresarial inteligente.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4
    });

    const totalTokens = response.usage?.total_tokens || 0;
    registrarUsoDeTokens({
      totalTokens,
      modelo: MODEL,
      origem: 'agent'
    });

    const content = response.choices[0].message.content;
    let json;
    try {
      json = JSON.parse(content);
    } catch (err) {
      return "❌ Não consegui entender sua solicitação.";
    }

    if (json.acao === 'registrar_venda') {
      const { cliente, produto, valor } = json.parametros;
      if (!cliente || !produto || !valor) {
        return "⚠️ Dados incompletos para registrar venda.";
      }

      await registerSale(cliente, produto, valor);
      return `✅ Venda registrada:\n👤 Cliente: ${cliente}\n📦 Produto: ${produto}\n💰 Valor: R$ ${parseFloat(valor).toFixed(2)}`;
    }

    if (json.acao === 'pergunta') {
      return `❓ ${json.pergunta}`;
    }

    return "🤖 Ação não reconhecida.";
  } catch (error) {
    console.error("Erro no agente:", error.message);
    return "❌ Erro ao processar a solicitação.";
  }
}

module.exports = agent;
