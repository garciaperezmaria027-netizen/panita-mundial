import axios from 'axios';
import { configManager } from '../config/manager';
import { logger } from '../utils/logger';

export interface SearchResult {
  title: string;
  snippet: string;
  link: string;
}

export class GoogleSearchService {
  /**
   * Realiza una búsqueda web a través de la API de Google Custom Search.
   * Retorna un resumen de los resultados o un mensaje de error/advertencia.
   */
  public async search(query: string): Promise<any> {
    const key = configManager.getGoogleSearchKey();
    const cx = configManager.getGoogleCseId();

    if (!key || !cx) {
      logger.warn('[Google Search] Google Custom Search API Key o CX no configurados. Saltando búsqueda.');
      return {
        error: 'La búsqueda web no está configurada. Por favor, define GOOGLE_SEARCH_KEY y GOOGLE_CSE_ID en el archivo .env.'
      };
    }

    try {
      logger.info(`[Google Search] Buscando en la web: "${query}"`);
      const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${key}&cx=${cx}&num=4`;
      
      const response = await axios.get(url, { timeout: 10000 });
      const items = response.data?.items || [];

      if (items.length === 0) {
        return {
          query,
          results: [],
          text_summary: 'No se encontraron resultados web para esta búsqueda.'
        };
      }

      const results: SearchResult[] = items.map((item: any) => ({
        title: item.title || '',
        snippet: item.snippet || '',
        link: item.link || ''
      }));

      // Crear un resumen textual amigable para que el LLM lo consuma
      let textSummary = `Resultados de búsqueda web para: "${query}"\n\n`;
      results.forEach((r, idx) => {
        textSummary += `[Resultado ${idx + 1}]\n`;
        textSummary += `Título: ${r.title}\n`;
        textSummary += `Resumen: ${r.snippet}\n`;
        textSummary += `Enlace: ${r.link}\n\n`;
      });

      return {
        query,
        results,
        whatsapp_formatted_text: textSummary
      };
    } catch (error: any) {
      logger.error('[Google Search] Error ejecutando la búsqueda web:', error.message || error);
      return {
        error: `Error al conectar con el motor de búsqueda de Google: ${error.message || error}`
      };
    }
  }
}

export const googleSearchService = new GoogleSearchService();
