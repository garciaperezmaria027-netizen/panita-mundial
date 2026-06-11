import axios from 'axios';
import { logger } from '../utils/logger';

export interface SearchResult {
  title: string;
  snippet: string;
  link: string;
}

/**
 * Servicio de búsqueda web usando Google News RSS + Bing HTML como fallback.
 *
 * - Google News RSS: gratuito, sin API key, retorna noticias actuales en XML/RSS.
 * - Bing HTML: fallback scraping básico si Google News no encuentra resultados.
 *
 * Documentación Google News RSS:
 * https://news.google.com/rss/search?q=QUERY&hl=es&gl=CO&ceid=CO:es
 */
export class DuckDuckGoSearchService {
  private readonly GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search';
  private readonly BING_SEARCH = 'https://www.bing.com/search';

  /**
   * Punto de entrada principal — intenta Google News RSS y cae a Bing HTML si falla.
   */
  public async search(query: string, maxResults = 5): Promise<any> {
    logger.info(`[WebSearch] Buscando: "${query}"`);

    // 1. Intentar Google News RSS (gratis, sin key, datos actuales)
    try {
      const results = await this.searchGoogleNewsRSS(query, maxResults);
      if (results.length > 0) {
        logger.info(`[WebSearch] Google News RSS: ${results.length} resultado(s) para: "${query}"`);
        return this.buildResponse(query, results);
      }
    } catch (err: any) {
      logger.warn(`[WebSearch] Google News RSS falló: ${err.message}`);
    }

    // 2. Fallback: Bing HTML scraping
    try {
      const results = await this.searchBingHTML(query, maxResults);
      if (results.length > 0) {
        logger.info(`[WebSearch] Bing HTML: ${results.length} resultado(s) para: "${query}"`);
        return this.buildResponse(query, results);
      }
    } catch (err: any) {
      logger.warn(`[WebSearch] Bing HTML falló: ${err.message}`);
    }

    // 3. Sin resultados — mensaje claro para el LLM
    logger.warn(`[WebSearch] Sin resultados web para: "${query}"`);
    return {
      query,
      results: [],
      whatsapp_formatted_text:
        `No se encontraron resultados web en tiempo real para: "${query}".\n` +
        `Por favor responde basándote en tu conocimiento entrenado sobre el Mundial 2026.`
    };
  }

  /**
   * Búsqueda en Google News RSS (sin API key, completamente gratuito).
   * Retorna noticias actuales sobre el tema buscado.
   */
  private async searchGoogleNewsRSS(query: string, maxResults: number): Promise<SearchResult[]> {
    const response = await axios.get(this.GOOGLE_NEWS_RSS, {
      params: {
        q: query,
        hl: 'es',
        gl: 'CO',
        ceid: 'CO:es'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml,application/xml,text/xml,*/*'
      },
      timeout: 10000
    });

    const xml: string = response.data;
    const results: SearchResult[] = [];

    // Extraer items del XML/RSS
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let itemMatch;

    while ((itemMatch = itemRegex.exec(xml)) !== null && results.length < maxResults) {
      const item = itemMatch[1];

      // Título (puede venir con CDATA o plano)
      const titleMatch = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
                         item.match(/<title>([\s\S]*?)<\/title>/);
      const title = titleMatch ? titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() : '';

      // Link
      const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
      const link = linkMatch ? linkMatch[1].trim() : '';

      // Descripción/snippet
      const descMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
                        item.match(/<description>([\s\S]*?)<\/description>/);
      let snippet = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim() : '';
      // Limitar a 200 chars
      if (snippet.length > 200) snippet = snippet.substring(0, 200) + '...';

      if (title && link) {
        results.push({ title, snippet, link });
      }
    }

    return results;
  }

  /**
   * Búsqueda en Bing scrapeando el HTML de resultados (fallback).
   */
  private async searchBingHTML(query: string, maxResults: number): Promise<SearchResult[]> {
    const response = await axios.get(this.BING_SEARCH, {
      params: { q: query, count: maxResults },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,es;q=0.8'
      },
      timeout: 12000
    });

    const html: string = response.data;
    const results: SearchResult[] = [];

    // Extraer título + URL de los resultados orgánicos de Bing
    const resultBlocks = html.match(/<li[^>]+class="[^"]*b_algo[^"]*"[^>]*>([\s\S]*?)<\/li>/gi) || [];

    for (const block of resultBlocks) {
      if (results.length >= maxResults) break;

      // Título y URL del bloque
      const titleMatch = block.match(/<h2[^>]*><a[^>]+href="(https?[^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!titleMatch) continue;

      const link = titleMatch[1];
      const title = titleMatch[2].replace(/<[^>]+>/g, '').trim();

      // Ignorar resultados internos de Bing
      if (link.includes('bing.com') || link.includes('microsoft.com')) continue;

      // Snippet (descripción)
      const snippetMatch = block.match(/<p[^>]*class="[^"]*b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
                           block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 200) : '';

      if (title && link) {
        results.push({ title, snippet, link });
      }
    }

    return results;
  }

  /**
   * Construye la respuesta formateada para el LLM
   */
  private buildResponse(query: string, results: SearchResult[]): any {
    let textSummary = `Resultados de búsqueda web para: "${query}"\n\n`;
    results.forEach((r, idx) => {
      textSummary += `[Resultado ${idx + 1}]\n`;
      textSummary += `Título: ${r.title}\n`;
      if (r.snippet) textSummary += `Resumen: ${r.snippet}\n`;
      if (r.link) textSummary += `Enlace: ${r.link}\n`;
      textSummary += '\n';
    });

    return {
      query,
      results,
      whatsapp_formatted_text: textSummary
    };
  }
}

export const duckduckgoSearchService = new DuckDuckGoSearchService();
