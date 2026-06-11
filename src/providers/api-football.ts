import axios, { AxiosInstance } from 'axios';
import { configManager } from '../config/manager';
import { logger } from '../utils/logger';
import { 
  Match, 
  StandingTeam, 
  GroupStanding, 
  TopScorerRow, 
  TopAssistRow, 
  MatchLineups, 
  MatchEvent,
  PlayerStatsSummary
} from '../types/sports';

export class APIFootballProvider {
  private client!: AxiosInstance;

  constructor() {
    this.initClient();
  }

  private initClient() {
    const baseURL = configManager.getApiFootballUrl();
    const apiKey = configManager.getApiFootballKey();

    this.client = axios.create({
      baseURL,
      headers: {
        'x-apisports-key': apiKey,
        'x-rapidapi-host': 'v3.football.api-sports.io'
      },
      timeout: 15000 // 15 segundos de timeout
    });
  }

  /**
   * Realiza una petición HTTP con reintentos automáticos
   */
  private async request<T>(url: string, params: Record<string, any> = {}, retries = 3): Promise<T> {
    // Si no hay API key, avisar y retornar null/throw
    if (!configManager.getApiFootballKey()) {
      throw new Error('API_FOOTBALL_KEY no configurada en las variables de entorno.');
    }

    let lastError: any;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        logger.debug(`[API Request] GET ${url} - Params: ${JSON.stringify(params)} (Intento ${attempt}/${retries})`);
        const response = await this.client.get(url, { params });
        
        // La API de Football a veces retorna 200 con mensajes de error dentro del JSON
        if (response.data?.errors && Object.keys(response.data.errors).length > 0) {
          const errorsStr = JSON.stringify(response.data.errors);
          throw new Error(`Error retornado por API-Football: ${errorsStr}`);
        }

        return response.data;
      } catch (error: any) {
        lastError = error;
        logger.warn(`Intento ${attempt} fallido para GET ${url}: ${error.message}`);
        if (attempt < retries) {
          // Espera exponencial: 1s, 2s, 4s...
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    logger.error(`Petición fallida después de ${retries} intentos: GET ${url}`);
    throw lastError;
  }

  /**
   * Obtiene la lista de todos los equipos del mundial para resolver nombres
   */
  public async getTeams(): Promise<any[]> {
    const league = configManager.getApiFootballLeague();
    const season = configManager.getApiFootballSeason();

    const data: any = await this.request('/teams', { league, season });
    return data.response || [];
  }

  /**
   * Obtiene los partidos programados
   * @param date Formato YYYY-MM-DD (opcional)
   */
  public async getFixtures(date?: string): Promise<Match[]> {
    const league = configManager.getApiFootballLeague();
    const season = configManager.getApiFootballSeason();
    
    const params: Record<string, any> = { league, season };
    if (date) {
      params.date = date;
    }

    const data: any = await this.request('/fixtures', params);
    return data.response || [];
  }

  /**
   * Obtiene los detalles de un partido específico
   */
  public async getFixture(id: number): Promise<Match | null> {
    const data: any = await this.request('/fixtures', { id });
    if (data.response && data.response.length > 0) {
      return data.response[0];
    }
    return null;
  }

  /**
   * Obtiene las alineaciones de un partido
   */
  public async getFixtureLineups(fixtureId: number): Promise<MatchLineups[]> {
    const data: any = await this.request('/fixtures/lineups', { fixture: fixtureId });
    return data.response || [];
  }

  /**
   * Obtiene los eventos de un partido (goles, tarjetas, etc.)
   */
  public async getFixtureEvents(fixtureId: number): Promise<MatchEvent[]> {
    const data: any = await this.request('/fixtures/events', { fixture: fixtureId });
    return data.response || [];
  }

  /**
   * Obtiene la tabla de posiciones de la liga
   */
  public async getStandings(): Promise<GroupStanding[]> {
    const league = configManager.getApiFootballLeague();
    const season = configManager.getApiFootballSeason();

    const data: any = await this.request('/standings', { league, season });
    
    const leagueData = data.response?.[0]?.league;
    if (!leagueData || !leagueData.standings) {
      return [];
    }

    // API-Football retorna standings como array de arrays (grupos) o array simple
    const standingsRaw = leagueData.standings;
    const groups: GroupStanding[] = [];

    if (Array.isArray(standingsRaw)) {
      for (const item of standingsRaw) {
        if (Array.isArray(item) && item.length > 0) {
          const groupName = item[0].group || 'Clasificación';
          groups.push({
            groupName,
            standings: item as StandingTeam[]
          });
        } else if (typeof item === 'object' && item !== null) {
          // Si es un objeto simple
          const standingObj = item as any;
          const groupName = standingObj.group || 'Clasificación';
          
          let existingGroup = groups.find(g => g.groupName === groupName);
          if (!existingGroup) {
            existingGroup = { groupName, standings: [] };
            groups.push(existingGroup);
          }
          existingGroup.standings.push(standingObj as StandingTeam);
        }
      }
    }

    return groups;
  }

  /**
   * Obtiene los goleadores del mundial
   */
  public async getTopScorers(): Promise<TopScorerRow[]> {
    const league = configManager.getApiFootballLeague();
    const season = configManager.getApiFootballSeason();

    const data: any = await this.request('/players/topscorers', { league, season });
    const response = data.response || [];

    return response.map((row: any) => ({
      player: {
        id: row.player.id,
        name: row.player.name,
        photo: row.player.photo
      },
      team: {
        id: row.statistics[0].team.id,
        name: row.statistics[0].team.name,
        logo: row.statistics[0].team.logo
      },
      goals: row.statistics[0].goals.total || 0,
      matchesPlayed: row.statistics[0].games.appearances || 0
    }));
  }

  /**
   * Obtiene los líderes en asistencias del mundial
   */
  public async getTopAssists(): Promise<TopAssistRow[]> {
    const league = configManager.getApiFootballLeague();
    const season = configManager.getApiFootballSeason();

    const data: any = await this.request('/players/topassists', { league, season });
    const response = data.response || [];

    return response.map((row: any) => ({
      player: {
        id: row.player.id,
        name: row.player.name,
        photo: row.player.photo
      },
      team: {
        id: row.statistics[0].team.id,
        name: row.statistics[0].team.name,
        logo: row.statistics[0].team.logo
      },
      assists: row.statistics[0].goals.assists || 0,
      matchesPlayed: row.statistics[0].games.appearances || 0
    }));
  }

  /**
   * Busca un jugador por nombre en la liga actual
   */
  public async searchPlayer(name: string): Promise<PlayerStatsSummary[]> {
    const league = configManager.getApiFootballLeague();
    const season = configManager.getApiFootballSeason();

    // La API de Football requiere al menos 3 caracteres para buscar
    if (name.trim().length < 3) {
      throw new Error('La búsqueda de jugador requiere al menos 3 caracteres.');
    }

    const data: any = await this.request('/players', { 
      search: name,
      league,
      season
    });

    return data.response || [];
  }

  /**
   * Obtiene las estadísticas de un equipo en la temporada
   */
  public async getTeamStats(teamId: number): Promise<any> {
    const league = configManager.getApiFootballLeague();
    const season = configManager.getApiFootballSeason();

    const data: any = await this.request('/teams/statistics', { 
      league, 
      season, 
      team: teamId 
    });

    return data.response || null;
  }
}

export const apiFootballProvider = new APIFootballProvider();
