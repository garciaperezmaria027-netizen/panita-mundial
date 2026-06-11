import axios from 'axios';
import { logger } from '../utils/logger';
import { 
  Match, 
  GroupStanding, 
  StandingTeam,
  TopScorerRow, 
  TopAssistRow, 
  MatchLineups, 
  MatchEvent,
  PlayerStatsSummary
} from '../types/sports';

const STADIUM_OFFSETS: Record<string, string> = {
  '1': '-06:00', // Mexico City (CST)
  '2': '-06:00', // Guadalajara (CST)
  '3': '-06:00', // Monterrey (CST)
  '4': '-05:00', // Dallas (CDT)
  '5': '-05:00', // Houston (CDT)
  '6': '-05:00', // Kansas City (CDT)
  '7': '-04:00', // Atlanta (EDT)
  '8': '-04:00', // Miami (EDT)
  '9': '-04:00', // Boston (EDT)
  '10': '-04:00', // Philadelphia (EDT)
  '11': '-04:00', // New York/New Jersey (EDT)
  '12': '-04:00', // Toronto (EDT)
  '13': '-07:00', // Vancouver (PDT)
  '14': '-07:00', // Seattle (PDT)
  '15': '-07:00', // San Francisco Bay Area (PDT)
  '16': '-07:00', // Los Angeles (PDT)
};

export class WorldCupFreeProvider {
  private baseURL = 'https://worldcup26.ir';

  /**
   * Parsea la fecha de formato 'MM/DD/YYYY HH:MM' a un string ISO usando el offset del estadio
   */
  private parseDateString(dateStr: string, stadiumId?: string): string {
    try {
      const parts = dateStr.trim().split(' ');
      if (parts.length !== 2) return new Date().toISOString();

      const dateParts = parts[0].split('/'); // MM, DD, YYYY
      const timeParts = parts[1].split(':'); // HH, MM

      const monthStr = dateParts[0].padStart(2, '0');
      const dayStr = dateParts[1].padStart(2, '0');
      const yearStr = dateParts[2];
      const hourStr = timeParts[0].padStart(2, '0');
      const minuteStr = timeParts[1].padStart(2, '0');

      // Obtener el offset del estadio o por defecto usar el de Colombia (UTC-5)
      const offset = stadiumId ? (STADIUM_OFFSETS[stadiumId] || '-05:00') : '-05:00';
      const isoStr = `${yearStr}-${monthStr}-${dayStr}T${hourStr}:${minuteStr}:00${offset}`;
      const date = new Date(isoStr);
      return date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  /**
   * Obtiene la lista de todos los equipos del mundial 2026
   */
  public async getTeams(): Promise<any[]> {
    try {
      logger.debug(`[Free API] GET /get/teams`);
      const response = await axios.get(`${this.baseURL}/get/teams`);
      const rawTeams = response.data?.teams || [];
      
      // Adaptar al formato de API-Football para compatibilidad en el service
      return rawTeams.map((t: any) => ({
        team: {
          id: parseInt(t.id, 10),
          name: t.name_en,
          logo: t.flag,
          code: t.fifa_code
        }
      }));
    } catch (error: any) {
      logger.error(`Error al obtener equipos de la API gratuita: ${error.message}`);
      return [];
    }
  }

  /**
   * Obtiene los partidos de la Copa del Mundo 2026
   */
  public async getFixtures(date?: string): Promise<Match[]> {
    try {
      logger.debug(`[Free API] GET /get/games`);
      const response = await axios.get(`${this.baseURL}/get/games`);
      const rawGames = response.data?.games || [];

      // Mapear al modelo unificado de Match
      const matches: Match[] = rawGames.map((g: any) => {
        const homeScore = g.home_score !== 'null' ? parseInt(g.home_score, 10) : null;
        const awayScore = g.away_score !== 'null' ? parseInt(g.away_score, 10) : null;
        const finished = g.finished === 'TRUE';
        
        const isoDate = this.parseDateString(g.local_date, g.stadium_id);
        
        return {
          fixture: {
            id: parseInt(g.id, 10),
            referee: null,
            timezone: 'UTC',
            date: isoDate,
            timestamp: Math.round(new Date(isoDate).getTime() / 1000),
            periods: { first: null, second: null },
            venue: {
              id: g.stadium_id ? parseInt(g.stadium_id, 10) : null,
              name: `Estadio #${g.stadium_id || 'TBD'}`,
              city: 'Ciudad Anfitriona'
            },
            status: {
              long: finished ? 'Match Finished' : (g.time_elapsed === 'notstarted' ? 'Not Started' : 'In Progress'),
              short: finished ? 'FT' : (g.time_elapsed === 'notstarted' ? 'NS' : 'LIVE'),
              elapsed: g.time_elapsed !== 'notstarted' && g.time_elapsed !== 'finished' ? parseInt(g.time_elapsed, 10) || null : null
            }
          },
          league: {
            id: 1,
            name: 'FIFA World Cup',
            country: 'World',
            logo: 'https://media.api-sports.io/football/leagues/1.png',
            flag: '',
            season: 2026,
            round: g.group ? `Group Stage - Group ${g.group}` : 'Knockout Stage'
          },
          teams: {
            home: {
              id: parseInt(g.home_team_id, 10),
              name: g.home_team_name_en || g.home_team_label || 'TBD',
              logo: g.home_team_id ? `https://flagcdn.com/w80/${g.home_team_name_en?.toLowerCase().substring(0, 2)}.png` : '⚽'
            },
            away: {
              id: parseInt(g.away_team_id, 10),
              name: g.away_team_name_en || g.away_team_label || 'TBD',
              logo: g.away_team_id ? `https://flagcdn.com/w80/${g.away_team_name_en?.toLowerCase().substring(0, 2)}.png` : '⚽'
            }
          },
          goals: {
            home: homeScore,
            away: awayScore
          },
          score: {
            halftime: { home: null, away: null },
            fulltime: { home: homeScore, away: awayScore },
            extratime: { home: null, away: null },
            penalty: { home: null, away: null }
          }
        };
      });

      // Si se solicita filtrar por fecha (YYYY-MM-DD)
      if (date) {
        return matches.filter(m => {
          try {
            const colDate = new Date(m.fixture.date).toLocaleDateString('en-CA', {
              timeZone: 'America/Bogota'
            });
            return colDate === date;
          } catch (err) {
            return m.fixture.date.startsWith(date);
          }
        });
      }

      return matches;
    } catch (error: any) {
      logger.error(`Error al obtener partidos de la API gratuita: ${error.message}`);
      return [];
    }
  }

  /**
   * Obtiene un partido específico por su ID
   */
  public async getFixture(id: number): Promise<Match | null> {
    try {
      const fixtures = await this.getFixtures();
      return fixtures.find(f => f.fixture.id === id) || null;
    } catch (error: any) {
      logger.error(`Error al obtener partido por ID en la API gratuita: ${error.message}`);
      return null;
    }
  }

  /**
   * Obtiene la clasificación de los grupos
   */
  public async getStandings(): Promise<GroupStanding[]> {
    try {
      logger.debug(`[Free API] GET /get/groups`);
      
      // Necesitamos los equipos para resolver los nombres en la tabla
      const teamsList = await this.getTeams();
      const teamMap: Record<number, { name: string; logo: string }> = {};
      teamsList.forEach(t => {
        teamMap[t.team.id] = {
          name: t.team.name,
          logo: t.team.logo
        };
      });

      const response = await axios.get(`${this.baseURL}/get/groups`);
      const rawGroups = response.data?.groups || [];

      return rawGroups.map((g: any) => {
        const standings: StandingTeam[] = g.teams.map((row: any, idx: number) => {
          const teamId = parseInt(row.team_id, 10);
          const teamInfo = teamMap[teamId] || { name: `Equipo #${teamId}`, logo: '⚽' };
          
          return {
            rank: idx + 1,
            team: {
              id: teamId,
              name: teamInfo.name,
              logo: teamInfo.logo
            },
            points: parseInt(row.pts, 10) || 0,
            goalsDiff: parseInt(row.gd, 10) || 0,
            group: `Grupo ${g.name}`,
            form: '',
            status: '',
            all: {
              played: parseInt(row.mp, 10) || 0,
              win: parseInt(row.w, 10) || 0,
              draw: parseInt(row.d, 10) || 0,
              lose: parseInt(row.l, 10) || 0,
              goals: {
                for: parseInt(row.gf, 10) || 0,
                against: parseInt(row.ga, 10) || 0
              }
            }
          };
        });

        // Ordenar standings por puntos, luego gol diferencia, luego goles a favor
        standings.sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.goalsDiff !== a.goalsDiff) return b.goalsDiff - a.goalsDiff;
          return b.all.goals.for - a.all.goals.for;
        });

        // Corregir rangos después de ordenar
        standings.forEach((st, idx) => { st.rank = idx + 1; });

        return {
          groupName: `Grupo ${g.name}`,
          standings
        };
      });
    } catch (error: any) {
      logger.error(`Error al obtener clasificación de la API gratuita: ${error.message}`);
      return [];
    }
  }

  // --- Endpoints no soportados en la versión gratuita ---
  // Retornamos vacíos/simulados para evitar caídas y dejar que Gemini responda amigablemente

  public async getTopScorers(): Promise<TopScorerRow[]> {
    logger.warn('[Free API] getTopScorers no es soportado por la API gratuita del Mundial 2026.');
    return [];
  }

  public async getTopAssists(): Promise<TopAssistRow[]> {
    logger.warn('[Free API] getTopAssists no es soportado por la API gratuita del Mundial 2026.');
    return [];
  }

  public async searchPlayer(name: string): Promise<PlayerStatsSummary[]> {
    logger.warn(`[Free API] searchPlayer (${name}) no es soportado por la API gratuita del Mundial 2026.`);
    return [];
  }

  public async getTeamStats(teamId: number): Promise<any> {
    logger.warn(`[Free API] getTeamStats (${teamId}) no es soportado por la API gratuita del Mundial 2026.`);
    return null;
  }

  public async getFixtureLineups(fixtureId: number): Promise<MatchLineups[]> {
    logger.warn(`[Free API] getFixtureLineups (${fixtureId}) no es soportado por la API gratuita del Mundial 2026.`);
    return [];
  }

  public async getFixtureEvents(fixtureId: number): Promise<MatchEvent[]> {
    logger.warn(`[Free API] getFixtureEvents (${fixtureId}) no es soportado por la API gratuita del Mundial 2026.`);
    return [];
  }
}

export const worldCupFreeProvider = new WorldCupFreeProvider();
