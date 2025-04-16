const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MODEL = process.env.AI_MODEL || 'gpt-3.5-turbo';

async function detectarIntencaoViaIA(frase) {
  const prompt = `
Você é um classificador de comandos de um assistente financeiro via WhatsApp.

Sua função é ler a frase e classificar apenas a intenção principal. Retorne **exatamente** um JSON no formato:

{
  "acao": "nome_da_acao"
}

Escolha UMA das seguintes ações:
- "maior_gasto" → quando o usuário quer saber com o que mais gastou
- "resumo_semana" → quando o usuário quer saber quanto gastou ou recebeu na semana
- "entrada_mes" → quando o usuário quer saber quanto ganhou no mês
- "melhoria_financeira" → quando ele quer dicas ou melhorias no controle financeiro
- "registro_financeiro" → quando ele quer registrar entrada ou saída
- "duvida" → quando ele pergunta algo solto ou fora de contexto
- "comando_invalido" → se a frase não fizer sentido algum

Frase do usuário: "${frase}"
`;

  try {
    const resposta = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'Você é um classificador de intenção.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    });

    const conteudo = resposta.choices[0].message.content;

    const json = JSON.parse(conteudo);
    return json.acao || "comando_invalido";

  } catch (err) {
    console.error("❌ Erro ao detectar intenção via IA:", err.message);
    return "comando_invalido";
  }
}

module.exports = detectarIntencaoViaIA;
