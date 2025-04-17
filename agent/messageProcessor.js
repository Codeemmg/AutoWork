// messageProcessor.js

const { Configuration, OpenAIApi } = require("openai");
const { categorizeTransaction } = require("./transactionCategorizer");
const { saveTransaction } = require("../database/transactionRepository");
const { getUserContext } = require("./userContextManager");
const { generateResponse } = require("./responseGenerator");

// Configuração da OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

/**
 * Processa mensagens recebidas do WhatsApp
 * @param {Object} message - Mensagem recebida
 * @param {Object} sock - Socket do WhatsApp
 * @returns {Promise<Object>} - Resultado do processamento
 */
async function processMessage(message, sock) {
  try {
    // Extrair informações essenciais da mensagem
    const sender = message.key.remoteJid;
    const messageContent = message.message?.conversation || 
                           message.message?.extendedTextMessage?.text || 
                           "";
    
    if (!messageContent) {
      console.log("Mensagem sem conteúdo de texto");
      return null;
    }

    // Obter contexto do usuário (histórico, preferências, etc)
    const userContext = await getUserContext(sender);
    
    // Identificar a intenção da mensagem
    const intent = await identifyMessageIntent(messageContent, userContext);
    
    // Processar conforme a intenção identificada
    let result;
    switch (intent.type) {
      case "TRANSACTION_RECORD":
        result = await processTransactionRecord(messageContent, sender, userContext);
        break;
        
      case "BALANCE_QUERY":
        result = await processBalanceQuery(sender, userContext);
        break;
        
      case "EXPENSE_SUMMARY":
        result = await processExpenseSummary(messageContent, sender, userContext);
        break;
        
      case "HELP_REQUEST":
        result = await processHelpRequest(userContext);
        break;
        
      case "GENERAL_QUESTION":
        result = await processGeneralQuestion(messageContent, userContext);
        break;
        
      default:
        result = {
          response: "Desculpe, não consegui entender. Pode reformular ou digitar 'ajuda' para ver os comandos disponíveis?",
          success: false
        };
    }
    
    // Enviar resposta
    await sock.sendMessage(sender, { text: result.response });
    
    // Atualizar contexto do usuário com esta interação
    await updateUserContext(sender, messageContent, intent, result);
    
    return result;
    
  } catch (error) {
    console.error("Erro no processamento da mensagem:", error);
    await sock.sendMessage(message.key.remoteJid, { 
      text: "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente."
    });
    return { success: false, error: error.message };
  }
}

/**
 * Identifica a intenção da mensagem do usuário
 * @param {string} messageContent - Conteúdo da mensagem
 * @param {Object} userContext - Contexto do usuário
 * @returns {Promise<Object>} - Intenção identificada
 */
async function identifyMessageIntent(messageContent, userContext) {
  // Implementação otimizada usando OpenAI
  const prompt = `
    Analise a seguinte mensagem e identifique a intenção principal do usuário:
    
    Mensagem: "${messageContent}"
    
    Contexto do usuário: ${JSON.stringify(userContext.recentInteractions || {})}
    
    Categorize em UMA das seguintes intenções:
    - TRANSACTION_RECORD: Registrar uma despesa ou receita
    - BALANCE_QUERY: Consultar saldo ou situação financeira
    - EXPENSE_SUMMARY: Solicitar resumo de despesas (por período ou categoria)
    - HELP_REQUEST: Pedido de ajuda ou instruções
    - GENERAL_QUESTION: Pergunta geral sobre finanças
    - UNKNOWN: Não foi possível identificar a intenção
    
    Retorne apenas a intenção identificada e os parâmetros relevantes em formato JSON.
  `;

  try {
    const response = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: prompt,
      max_tokens: 150,
      temperature: 0.3,
    });

    const intentText = response.data.choices[0].text.trim();
    
    // Parse do resultado (assumindo que o GPT retornou JSON válido)
    try {
      const intentData = JSON.parse(intentText);
      return intentData;
    } catch (e) {
      // Fallback para caso o GPT não retorne um JSON válido
      if (intentText.includes("TRANSACTION_RECORD")) {
        return { type: "TRANSACTION_RECORD" };
      } else if (intentText.includes("BALANCE_QUERY")) {
        return { type: "BALANCE_QUERY" };
      } else if (intentText.includes("EXPENSE_SUMMARY")) {
        return { type: "EXPENSE_SUMMARY" };
      } else if (intentText.includes("HELP_REQUEST")) {
        return { type: "HELP_REQUEST" };
      } else if (intentText.includes("GENERAL_QUESTION")) {
        return { type: "GENERAL_QUESTION" };
      } else {
        return { type: "UNKNOWN" };
      }
    }
  } catch (error) {
    console.error("Erro ao identificar intenção:", error);
    
    // Fallback: análise simples baseada em palavras-chave
    const lowerMessage = messageContent.toLowerCase();
    
    if (lowerMessage.includes("gastei") || 
        lowerMessage.includes("gasto") || 
        lowerMessage.includes("comprei") || 
        lowerMessage.includes("paguei") || 
        lowerMessage.includes("recebi") || 
        lowerMessage.includes("recebimento")) {
      return { type: "TRANSACTION_RECORD" };
    } else if (lowerMessage.includes("saldo") || 
               lowerMessage.includes("quanto tenho") || 
               lowerMessage.includes("situação")) {
      return { type: "BALANCE_QUERY" };
    } else if (lowerMessage.includes("resumo") || 
               lowerMessage.includes("relatório") || 
               lowerMessage.includes("gastos com")) {
      return { type: "EXPENSE_SUMMARY" };
    } else if (lowerMessage.includes("ajuda") || 
               lowerMessage.includes("como usar") || 
               lowerMessage.includes("comandos")) {
      return { type: "HELP_REQUEST" };
    } else {
      return { type: "GENERAL_QUESTION" };
    }
  }
}

/**
 * Processa um registro de transação (despesa ou receita)
 */
async function processTransactionRecord(messageContent, sender, userContext) {
  try {
    // Extrair detalhes da transação usando IA
    const transactionDetails = await extractTransactionDetails(messageContent);
    
    if (!transactionDetails.success) {
      return {
        success: false,
        response: `Não consegui entender completamente os detalhes da sua transação. Pode fornecer mais informações? Por exemplo: "Gastei R$50 com almoço hoje" ou "Recebi R$1000 de salário ontem".`
      };
    }
    
    // Categorizar a transação
    const categorizedTransaction = await categorizeTransaction(transactionDetails.data);
    
    // Salvar no banco de dados
    const saveResult = await saveTransaction(sender, categorizedTransaction);
    
    if (!saveResult.success) {
      return {
        success: false,
        response: `Houve um problema ao salvar sua transação. Por favor, tente novamente mais tarde.`
      };
    }
    
    // Gerar resposta personalizada
    let response;
    if (categorizedTransaction.type === 'expense') {
      response = `✅ Despesa registrada com sucesso!\n\n📝 *${categorizedTransaction.description}*\n💰 R$ ${categorizedTransaction.amount.toFixed(2)}\n📊 Categoria: ${categorizedTransaction.category}\n📅 Data: ${formatDate(categorizedTransaction.date)}`;
    } else {
      response = `✅ Receita registrada com sucesso!\n\n📝 *${categorizedTransaction.description}*\n💰 R$ ${categorizedTransaction.amount.toFixed(2)}\n📊 Categoria: ${categorizedTransaction.category}\n📅 Data: ${formatDate(categorizedTransaction.date)}`;
    }
    
    // Adicionar dica personalizada (opcional)
    if (categorizedTransaction.type === 'expense' && categorizedTransaction.amount > 100) {
      const tip = await generateFinancialTip(categorizedTransaction.category);
      if (tip) {
        response += `\n\n💡 *Dica:* ${tip}`;
      }
    }
    
    return {
      success: true,
      response,
      transaction: categorizedTransaction
    };
  } catch (error) {
    console.error("Erro ao processar registro de transação:", error);
    return {
      success: false,
      response: "Desculpe, houve um erro ao processar sua transação. Por favor, tente novamente."
    };
  }
}

/**
 * Extrai detalhes de uma transação da mensagem
 */
async function extractTransactionDetails(messageContent) {
  try {
    const prompt = `
      Extraia os detalhes da transação financeira da seguinte mensagem:
      
      "${messageContent}"
      
      Retorne um JSON com os seguintes campos:
      - type: "expense" ou "income"
      - amount: valor numérico (apenas números)
      - description: breve descrição
      - date: data da transação (use a data atual se não especificada)
      - raw_text: o texto original que descreve a transação
      
      Se não conseguir identificar uma transação válida, retorne {"success": false}.
    `;

    const response = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: prompt,
      max_tokens: 250,
      temperature: 0.3,
    });

    const resultText = response.data.choices[0].text.trim();
    
    try {
      const parsedResult = JSON.parse(resultText);
      
      // Verificar se temos os campos mínimos necessários
      if (parsedResult.success === false) {
        return { success: false };
      }
      
      if (!parsedResult.amount || isNaN(parsedResult.amount)) {
        return { success: false };
      }
      
      // Se não tiver data definida, usar a data atual
      if (!parsedResult.date || parsedResult.date === "") {
        parsedResult.date = new Date().toISOString().split('T')[0];
      }
      
      return {
        success: true,
        data: parsedResult
      };
    } catch (e) {
      console.error("Erro ao analisar resposta da IA:", e);
      return { success: false };
    }
  } catch (error) {
    console.error("Erro ao extrair detalhes da transação:", error);
    return { success: false };
  }
}

/**
 * Processa consultas de saldo
 */
async function processBalanceQuery(sender, userContext) {
  // Implementação aqui
  // ...
  
  return {
    success: true,
    response: "Seu saldo atual é R$ 1.250,00"
  };
}

/**
 * Processa pedidos de resumo de despesas
 */
async function processExpenseSummary(messageContent, sender, userContext) {
  // Implementação aqui
  // ...
  
  return {
    success: true,
    response: "Resumo de despesas do mês: R$ 3.200,00"
  };
}

/**
 * Processa pedidos de ajuda
 */
async function processHelpRequest(userContext) {
  const helpMessage = `
🤖 *Comandos do AutoWork* 🤖

📝 *Registrar Transações*
● "Gastei R$50 com almoço hoje"
● "Recebi R$1200 de salário ontem"

💰 *Consultas*
● "Qual meu saldo atual?"
● "Quanto gastei esse mês?"
● "Resumo da semana"
● "Gastos com alimentação"

📊 *Relatórios*
● "Gráfico de gastos do mês"
● "Relatório por categoria"

❓ Digite "ajuda" a qualquer momento para ver esta mensagem novamente.
  `;
  
  return {
    success: true,
    response: helpMessage
  };
}

/**
 * Processa perguntas gerais
 */
async function processGeneralQuestion(messageContent, userContext) {
  // Implementação aqui
  // ...
  
  return {
    success: true,
    response: "Resposta para sua pergunta..."
  };
}

/**
 * Atualiza o contexto do usuário após uma interação
 */
async function updateUserContext(sender, messageContent, intent, result) {
  // Implementação aqui
  // ...
}

/**
 * Formata uma data para exibição
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR');
}

/**
 * Gera uma dica financeira personalizada
 */
async function generateFinancialTip(category) {
  // Implementação aqui
  // ...
  
  return "Considere comparar preços antes de fazer grandes compras nesta categoria.";
}

module.exports = {
  processMessage,
  identifyMessageIntent
};