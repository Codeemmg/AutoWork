// transactionCategorizer.js

const { Configuration, OpenAIApi } = require("openai");
const { getCategories } = require("../database/categoryRepository");

// Configuração da OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Cache de categorias para reduzir consultas ao banco
let categoriesCache = null;
let lastCacheUpdate = null;

/**
 * Categoriza uma transação usando IA
 * @param {Object} transaction - Detalhes da transação
 * @returns {Promise<Object>} - Transação categorizada
 */
async function categorizeTransaction(transaction) {
  try {
    // Garantir que temos as categorias disponíveis
    const categories = await getCachedCategories();
    
    // Se temos uma categoria claramente identificável por regras simples, usar
    const quickCategory = findQuickCategory(transaction.description, categories);
    if (quickCategory) {
      return {
        ...transaction,
        category: quickCategory
      };
    }
    
    // Caso contrário, usar IA para categorização mais precisa
    const aiCategory = await categorizeThroughAI(transaction, categories);
    
    return {
      ...transaction,
      category: aiCategory
    };
  } catch (error) {
    console.error("Erro ao categorizar transação:", error);
    
    // Fallback para categoria genérica em caso de erro
    return {
      ...transaction,
      category: transaction.type === 'expense' ? 'Outros Gastos' : 'Outras Receitas'
    };
  }
}

/**
 * Obtém categorias do cache ou do banco
 */
async function getCachedCategories() {
  const cacheValidityPeriod = 60 * 60 * 1000; // 1 hora em milissegundos
  
  if (categoriesCache && lastCacheUpdate && 
      (Date.now() - lastCacheUpdate) < cacheValidityPeriod) {
    return categoriesCache;
  }
  
  try {
    const freshCategories = await getCategories();
    categoriesCache = freshCategories;
    lastCacheUpdate = Date.now();
    return freshCategories;
  } catch (error) {
    console.error("Erro ao buscar categorias:", error);
    
    // Fallback para categorias padrão em caso de erro
    return getDefaultCategories();
  }
}

/**
 * Categorias padrão para fallback
 */
function getDefaultCategories() {
  return {
    expense: [
      'Alimentação',
      'Transporte',
      'Moradia',
      'Saúde',
      'Educação',
      'Lazer',
      'Vestuário',
      'Outros Gastos'
    ],
    income: [
      'Salário',
      'Freelance',
      'Investimentos',
      'Outras Receitas'
    ]
  };
}

/**
 * Tenta encontrar uma categoria por regras simples
 */
function findQuickCategory(description, categories) {
  if (!description) return null;
  
  const lowerDesc = description.toLowerCase();
  
  // Mapeamento de palavras-chave para categorias
  const keywordMap = {
    // Despesas
    'mercado': 'Alimentação',
    'supermercado': 'Alimentação',
    'restaurante': 'Alimentação',
    'lanche': 'Alimentação',
    'ifood': 'Alimentação',
    
    'uber': 'Transporte',
    'gasolina': 'Transporte',
    'combustível': 'Transporte',
    'transporte': 'Transporte',
    'passagem': 'Transporte',
    
    'aluguel': 'Moradia',
    'condomínio': 'Moradia',
    'iptu': 'Moradia',
    'água': 'Moradia',
    'luz': 'Moradia',
    'energia': 'Moradia',
    'internet': 'Moradia',
    
    'remédio': 'Saúde',
    'farmácia': 'Saúde',
    'consulta': 'Saúde',
    'médico': 'Saúde',
    'dentista': 'Saúde',
    
    'curso': 'Educação',
    'livro': 'Educação',
    'faculdade': 'Educação',
    'escola': 'Educação',
    'mensalidade': 'Educação',
    
    'cinema': 'Lazer',
    'teatro': 'Lazer',
    'netflix': 'Lazer',
    'spotify': 'Lazer',
    'viagem': 'Lazer',
    
    'roupa': 'Vestuário',
    'calçado': 'Vestuário',
    'sapato': 'Vestuário',
    
    // Receitas
    'salário': 'Salário',
    'pagamento': 'Salário',
    
    'freelance': 'Freelance',
    'projeto': 'Freelance',
    
    'dividendo': 'Investimentos',
    'rendimento': 'Investimentos',
    'juros': 'Investimentos'
  };
  
  // Verificar se alguma palavra-chave está presente na descrição
  for (const [keyword, category] of Object.entries(keywordMap)) {
    if (lowerDesc.includes(keyword)) {
      return category;
    }
  }
  
  // Não encontrou correspondência
  return null;
}

/**
 * Categoriza transação usando IA
 */
async function categorizeThroughAI(transaction, categories) {
  const relevantCategories = transaction.type === 'expense' ? 
                            categories.expense : 
                            categories.income;
  
  const prompt = `
    Categorize a seguinte transação financeira:
    
    Tipo: ${transaction.type === 'expense' ? 'Despesa' : 'Receita'}
    Descrição: "${transaction.description}"
    Valor: R$ ${transaction.amount}
    
    Escolha UMA categoria da lista abaixo que melhor se aplica:
    ${relevantCategories.join(', ')}
    
    Retorne apenas o nome da categoria escolhida, sem explicações adicionais.
  `;

  try {
    const response = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: prompt,
      max_tokens: 50,
      temperature: 0.3,
    });

    const category = response.data.choices[0].text.trim();
    
    // Verificar se a categoria retornada está na lista
    if (relevantCategories.includes(category)) {
      return category;
    }
    
    // Caso a IA retorne uma categoria que não está na lista
    // usar a que tiver mais similaridade textual
    const mostSimilar = findMostSimilarCategory(category, relevantCategories);
    return mostSimilar;
    
  } catch (error) {
    console.error("Erro na categorização via IA:", error);
    
    // Fallback para categoria padrão
    return transaction.type === 'expense' ? 'Outros Gastos' : 'Outras Receitas';
  }
}

/**
 * Encontra a categoria mais similar textualmente
 */
function findMostSimilarCategory(input, categories) {
  if (!input || categories.length === 0) {
    return categories[0] || (input ? input : 'Outros');
  }
  
  const lowerInput = input.toLowerCase();
  
  // Algoritmo simples de similaridade de texto
  let bestMatch = categories[0];
  let highestSimilarity = 0;
  
  for (const category of categories) {
    const lowerCategory = category.toLowerCase();
    
    // Calcular similaridade (implementação simplificada)
    let similarity = 0;
    const words = lowerInput.split(' ');
    
    for (const word of words) {
      if (lowerCategory.includes(word) && word.length > 2) {
        similarity += 1;
      }
    }
    
    if (similarity > highestSimilarity) {
      highestSimilarity = similarity;
      bestMatch = category;
    }
  }
  
  return bestMatch;
}

module.exports = {
  categorizeTransaction
};