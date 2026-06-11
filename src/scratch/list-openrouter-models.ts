import axios from 'axios';
import { logger } from '../utils/logger';

async function listModels() {
  try {
    logger.info('Fetching models from OpenRouter...');
    const response = await axios.get('https://openrouter.ai/api/v1/models');
    const models = response.data.data;
    
    logger.info(`Total models found: ${models.length}`);
    
    // Filtrar modelos gratuitos
    const freeModels = models.filter((m: any) => {
      const isFree = m.id.endsWith(':free') || (m.pricing && parseFloat(m.pricing.prompt) === 0 && parseFloat(m.pricing.completion) === 0);
      return isFree;
    });

    logger.info(`\n--- FREE MODELS ON OPENROUTER (${freeModels.length}) ---`);
    freeModels.forEach((m: any) => {
      logger.info(`ID: ${m.id} | Name: ${m.name}`);
    });

    // Buscar modelos específicos de gemini, qwen, deepseek, llama (incluso de pago si no hay gratis)
    const targetKeywords = ['gemini', 'qwen', 'deepseek', 'llama'];
    logger.info('\n--- MODEL GROUPS SEARCH ---');
    targetKeywords.forEach(kw => {
      const matching = models.filter((m: any) => m.id.toLowerCase().includes(kw));
      logger.info(`\n[${kw.toUpperCase()}] models:`);
      matching.slice(0, 10).forEach((m: any) => {
        const costStr = m.pricing ? `Prompt: ${m.pricing.prompt}, Comp: ${m.pricing.completion}` : 'Free/Unknown';
        logger.info(`  • ID: ${m.id} | Name: ${m.name} (${costStr})`);
      });
    });

  } catch (error: any) {
    logger.error('Error fetching models:', error.message);
  }
}

listModels();
