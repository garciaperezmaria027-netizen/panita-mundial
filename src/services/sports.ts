import * as fs from 'fs';
import * as path from 'path';
import { apiFootballProvider } from '../providers/api-football';
import { worldCupFreeProvider } from '../providers/worldcup-free';
import { cacheManager } from './cache';
import { logger } from '../utils/logger';
import { 
  Match, 
  GroupStanding, 
  TopScorerRow, 
  TopAssistRow, 
  MatchLineups, 
  MatchEvent,
  PlayerStatsSummary
} from '../types/sports';

// Mapeo de nombres de equipos en español (sin tildes, minúsculas) a su nombre en inglés
// tal como lo reporta la API. Cubre las 48 selecciones clasificadas al Mundial 2026
// más algunos alias comunes para evitar resultados vacíos por errores de traducción.
const TEAM_TRANSLATIONS: Record<string, string> = {
  // Grupo A
  'mexico': 'Mexico',
  'sudafrica': 'South Africa',
  'sud africa': 'South Africa',
  'corea del sur': 'South Korea',
  'corea': 'South Korea',
  'republica checa': 'Czech Republic',
  'chequia': 'Czech Republic',
  // Grupo B
  'canada': 'Canada',
  'bosnia y herzegovina': 'Bosnia and Herzegovina',
  'bosnia': 'Bosnia and Herzegovina',
  'catar': 'Qatar',
  'qatar': 'Qatar',
  'suiza': 'Switzerland',
  // Grupo C
  'brasil': 'Brazil',
  'escocia': 'Scotland',
  'marruecos': 'Morocco',
  'haiti': 'Haiti',
  // Grupo D
  'turquia': 'Turkey',
  'estados unidos': 'United States',
  'eeuu': 'United States',
  'ee.uu.': 'United States',
  'usa': 'United States',
  'paraguay': 'Paraguay',
  'australia': 'Australia',
  // Grupo E
  'costa de marfil': 'Ivory Coast',
  'ecuador': 'Ecuador',
  'curazao': 'Curaçao',
  'alemania': 'Germany',
  // Grupo F
  'paises bajos': 'Netherlands',
  'holanda': 'Netherlands',
  'japon': 'Japan',
  'tunez': 'Tunisia',
  'suecia': 'Sweden',
  // Grupo G
  'egipto': 'Egypt',
  'nueva zelanda': 'New Zealand',
  'nueva zelandia': 'New Zealand',
  'belgica': 'Belgium',
  'iran': 'Iran',
  // Grupo H
  'cabo verde': 'Cape Verde',
  'arabia saudita': 'Saudi Arabia',
  'arabia saudi': 'Saudi Arabia',
  'espana': 'Spain',
  'uruguay': 'Uruguay',
  // Grupo I
  'francia': 'France',
  'irak': 'Iraq',
  'iraq': 'Iraq',
  'noruega': 'Norway',
  'senegal': 'Senegal',
  // Grupo J
  'austria': 'Austria',
  'argentina': 'Argentina',
  'argelia': 'Algeria',
  'jordania': 'Jordan',
  // Grupo K
  'portugal': 'Portugal',
  'uzbekistan': 'Uzbekistan',
  'colombia': 'Colombia',
  'republica democratica del congo': 'Democratic Republic of the Congo',
  'rd congo': 'Democratic Republic of the Congo',
  'congo': 'Democratic Republic of the Congo',
  // Grupo L
  'ghana': 'Ghana',
  'inglaterra': 'England',
  'panama': 'Panama',
  'croacia': 'Croatia'
};

class SportsService {
  /**
   * Resuelve el proveedor activo basándose en las variables de entorno
   */
  private getProvider() {
    const provider = process.env.SPORTS_PROVIDER || 'api-football';
    if (provider === 'free-2026') {
      return worldCupFreeProvider;
    }
    return apiFootballProvider;
  }

  /**
   * Quita tildes/diacríticos y normaliza a minúsculas (ej. "México" -> "mexico")
   */
  private stripAccents(name: string): string {
    return name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  /**
   * Resuelve el nombre del equipo ingresado por el usuario a su versión estándar o inglés
   */
  private normalizeTeamName(name: string): string {
    const cleaned = this.stripAccents(name);
    return TEAM_TRANSLATIONS[cleaned] || name;
  }

  /**
   * Busca si un nombre parcial coincide con el nombre del equipo de la API
   */
  private matchTeam(userInput: string, teamName: string): boolean {
    const normUser = this.stripAccents(this.normalizeTeamName(userInput));
    const normTeam = this.stripAccents(teamName);

    // Comparación directa o inclusión
    return normTeam.includes(normUser) || normUser.includes(normTeam);
  }

  /**
   * Obtiene la lista de equipos del mundial, con caché de 7 días
   */
  public async getTeams(): Promise<any[]> {
    const cacheKey = 'worldcup_teams';
    const cached = cacheManager.get<any[]>(cacheKey);
    if (cached) return cached;

    try {
      const teams = await this.getProvider().getTeams();
      if (teams && teams.length > 0) {
        // Guardar por 7 días (604800000 ms)
        cacheManager.set(cacheKey, teams, 604800000);
      }
      return teams;
    } catch (error) {
      logger.error('Error al obtener equipos de la API, retornando vacío:', error);
      return [];
    }
  }

  /**
   * Encuentra el ID de un equipo por su nombre
   */
  public async resolveTeamId(teamName: string): Promise<number | null> {
    const teams = await this.getTeams();
    const matched = teams.find(t => 
      this.matchTeam(teamName, t.team.name) || 
      (t.team.code && this.matchTeam(teamName, t.team.code))
    );
    return matched ? matched.team.id : null;
  }

  /**
   * Obtiene los partidos de la fecha especificada o la actual (Colombia UTC-5)
   * Caché: 30 minutos, pero si hay partidos en vivo puede bajar a 2 minutos
   */
  public async getMatchesToday(dateStr?: string): Promise<Match[]> {
    // Obtener fecha objetivo (enviada por parámetro o la de hoy en Colombia)
    const targetDateStr = dateStr || new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Bogota'
    }); // Formato YYYY-MM-DD

    const cacheKey = `fixtures_${targetDateStr}`;
    const cached = cacheManager.get<Match[]>(cacheKey);
    if (cached) return cached;

    try {
      const fixtures = await this.getProvider().getFixtures(targetDateStr);
      
      // Determinar TTL
      // Si algún partido está en juego (1H, 2H, HT, ET, P), guardamos solo por 2 minutos
      const hasLiveMatch = fixtures.some(f => 
        ['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes(f.fixture.status.short)
      );
      
      const ttl = hasLiveMatch ? 120000 : 1800000; // 2 min o 30 min
      cacheManager.set(cacheKey, fixtures, ttl);
      
      return fixtures;
    } catch (error) {
      logger.error(`Error al obtener partidos para la fecha ${targetDateStr}:`, error);
      return [];
    }
  }

  /**
   * Obtiene el resultado más reciente de un equipo
   * Cache: 15 minutos
   */
  public async getMatchResult(teamName: string): Promise<Match[]> {
    const cacheKey = `all_fixtures`;
    let fixtures = cacheManager.get<Match[]>(cacheKey);

    if (!fixtures) {
      try {
        fixtures = await this.getProvider().getFixtures();
        cacheManager.set(cacheKey, fixtures, 3600000); // 1 hora de caché para todo el calendario
      } catch (error) {
        logger.error('Error al obtener todos los partidos para resultados:', error);
        return [];
      }
    }

    // Filtrar partidos del equipo que ya finalizaron (FT, AET, PEN)
    const finishedMatches = fixtures.filter(f => 
      ['FT', 'AET', 'PEN'].includes(f.fixture.status.short) &&
      (this.matchTeam(teamName, f.teams.home.name) || this.matchTeam(teamName, f.teams.away.name))
    );

    // Ordenar por fecha de forma descendente (el más reciente primero)
    return finishedMatches.sort((a, b) => b.fixture.timestamp - a.fixture.timestamp);
  }

  /**
   * Obtiene los próximos partidos del torneo o de un equipo específico
   * Cache: 30 minutos
   */
  public async getUpcomingMatches(teamName?: string): Promise<Match[]> {
    const cacheKey = `all_fixtures`;
    let fixtures = cacheManager.get<Match[]>(cacheKey);

    if (!fixtures) {
      try {
        fixtures = await this.getProvider().getFixtures();
        cacheManager.set(cacheKey, fixtures, 1800000); // 30 minutos
      } catch (error) {
        logger.error('Error al obtener todos los partidos para próximos juegos:', error);
        return [];
      }
    }

    // Filtrar partidos que no han comenzado (NS, TBD) o aplazados
    let upcoming = fixtures.filter(f => 
      ['NS', 'TBD'].includes(f.fixture.status.short)
    );

    if (teamName) {
      upcoming = upcoming.filter(f => 
        this.matchTeam(teamName, f.teams.home.name) || this.matchTeam(teamName, f.teams.away.name)
      );
    }

    // Ordenar por fecha de forma ascendente (los más cercanos primero)
    return upcoming.sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);
  }

  /**
   * Obtiene la tabla de posiciones, opcionalmente filtrada por grupo
   * Cache: 1 hora
   */
  public async getGroupStandings(groupLetter?: string): Promise<GroupStanding[]> {
    const cacheKey = 'standings';
    let standings = cacheManager.get<GroupStanding[]>(cacheKey);

    if (!standings) {
      try {
        standings = await this.getProvider().getStandings();
        if (standings && standings.length > 0) {
          cacheManager.set(cacheKey, standings, 3600000); // 1 hora
        }
      } catch (error) {
        logger.error('Error al obtener clasificación:', error);
        return [];
      }
    }

    if (groupLetter) {
      const cleanGroup = groupLetter.trim().toLowerCase();
      // Filtrar grupos que contengan la letra/nombre del grupo (ej: "Group A", "Grupo A", "A")
      return standings.filter(g => 
        g.groupName.toLowerCase().includes(cleanGroup) ||
        (cleanGroup.length === 1 && g.groupName.toLowerCase().endsWith(` ${cleanGroup}`))
      );
    }

    return standings;
  }

  /**
   * Obtiene la tabla de goleadores
   * Cache: 4 horas
   */
  public async getTopScorers(): Promise<TopScorerRow[]> {
    const cacheKey = 'top_scorers';
    const cached = cacheManager.get<TopScorerRow[]>(cacheKey);
    if (cached) return cached;

    try {
      const scorers = await this.getProvider().getTopScorers();
      if (scorers && scorers.length > 0) {
        cacheManager.set(cacheKey, scorers, 14400000); // 4 horas
      }
      return scorers;
    } catch (error) {
      logger.error('Error al obtener goleadores:', error);
      return [];
    }
  }

  /**
   * Obtiene la tabla de asistencias
   * Cache: 4 horas
   */
  public async getTopAssists(): Promise<TopAssistRow[]> {
    const cacheKey = 'top_assists';
    const cached = cacheManager.get<TopAssistRow[]>(cacheKey);
    if (cached) return cached;

    try {
      const assists = await this.getProvider().getTopAssists();
      if (assists && assists.length > 0) {
        cacheManager.set(cacheKey, assists, 14400000); // 4 horas
      }
      return assists;
    } catch (error) {
      logger.error('Error al obtener asistencias:', error);
      return [];
    }
  }

  /**
   * Obtiene estadísticas detalladas de un jugador por su nombre
   * Cache: 12 horas
   */
  public async getPlayerStats(playerName: string): Promise<PlayerStatsSummary[]> {
    const cacheKey = `player_stats_${playerName.toLowerCase().trim().replace(/\s+/g, '_')}`;
    const cached = cacheManager.get<PlayerStatsSummary[]>(cacheKey);
    if (cached) return cached;

    try {
      const stats = await this.getProvider().searchPlayer(playerName);
      if (stats && stats.length > 0) {
        cacheManager.set(cacheKey, stats, 43200000); // 12 horas
      }
      return stats;
    } catch (error) {
      logger.error(`Error al obtener estadísticas del jugador ${playerName}:`, error);
      return [];
    }
  }

  /**
   * Obtiene estadísticas de un equipo en la temporada del mundial
   * Cache: 6 horas
   */
  public async getTeamStats(teamName: string): Promise<any> {
    const teamId = await this.resolveTeamId(teamName);
    if (!teamId) {
      logger.warn(`No se pudo resolver el ID para el equipo: ${teamName}`);
      return null;
    }

    const cacheKey = `team_stats_${teamId}`;
    const cached = cacheManager.get<any>(cacheKey);
    if (cached) return cached;

    try {
      const stats = await this.getProvider().getTeamStats(teamId);
      if (stats) {
        cacheManager.set(cacheKey, stats, 21600000); // 6 horas
      }
      return stats;
    } catch (error) {
      logger.error(`Error al obtener estadísticas para el equipo ID ${teamId}:`, error);
      return null;
    }
  }

  /**
   * Obtiene la alineación oficial o probable de un partido
   * Cache: 10 minutos
   */
  public async getLineups(matchId: number): Promise<MatchLineups[]> {
    const cacheKey = `lineups_${matchId}`;
    const cached = cacheManager.get<MatchLineups[]>(cacheKey);
    if (cached) return cached;

    try {
      const lineups = await this.getProvider().getFixtureLineups(matchId);
      if (lineups && lineups.length > 0) {
        cacheManager.set(cacheKey, lineups, 600000); // 10 minutos
      }
      return lineups;
    } catch (error) {
      logger.error(`Error al obtener alineaciones del partido ${matchId}:`, error);
      return [];
    }
  }

  /**
   * Obtiene detalles, eventos y alineaciones de un partido
   * Cache: Variable. 1 minuto si está en vivo, 12 horas si finalizó.
   */
  public async getMatchDetails(matchId: number): Promise<{ match: Match; events: MatchEvent[]; lineups: MatchLineups[] } | null> {
    const cacheKey = `match_details_${matchId}`;
    const cached = cacheManager.get<any>(cacheKey);
    if (cached) return cached;

    try {
      const match = await this.getProvider().getFixture(matchId);
      if (!match) return null;

      const events = await this.getProvider().getFixtureEvents(matchId);
      const lineups = await this.getLineups(matchId);

      const data = { match, events, lineups };

      // Si el partido ya finalizó, guardamos el detalle por 12 horas. Si no, solo por 1 minuto.
      const isFinished = ['FT', 'AET', 'PEN'].includes(match.fixture.status.short);
      const ttl = isFinished ? 43200000 : 60000;

      cacheManager.set(cacheKey, data, ttl);
      return data;
    } catch (error) {
      logger.error(`Error al obtener detalles completos del partido ${matchId}:`, error);
      return null;
    }
  }

  /**
   * Obtiene la plantilla local convocada de un equipo desde squads.json
   */
  public getTeamSquad(teamName: string): any {
    try {
      const filePath = path.join(__dirname, '../config/squads.json');
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const squads = JSON.parse(fileContent);
        
        // Buscar coincidencia insensible a mayúsculas y acentos
        const cleanName = teamName.trim().toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        const key = Object.keys(squads).find(k => {
          const normKey = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return normKey.includes(cleanName) || cleanName.includes(normKey);
        });

        if (key) {
          return squads[key];
        }
      }
      return null;
    } catch (error) {
      logger.error(`Error al leer squads.json para ${teamName}:`, error);
      return null;
    }
  }
}

export const sportsService = new SportsService();
export { TEAM_TRANSLATIONS };
