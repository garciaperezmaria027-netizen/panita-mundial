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
  PlayerStatsSummary,
  ScorerEntry
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

// Caracteres de comillas (rectas y tipográficas) que la API usa para delimitar nombres de goleadores
const QUOTE_CHARS = '“”"';
const SCORER_TOKEN_REGEX = new RegExp(`[${QUOTE_CHARS}]([^${QUOTE_CHARS}]+)[${QUOTE_CHARS}]`, 'g');

export class WorldCupFreeProvider {
  private baseURL = 'https://worldcup26.ir';

  // Caché interna en memoria para evitar llamadas repetidas a la API gratuita en ráfagas cortas
  private memCache: Map<string, { data: any; expires: number }> = new Map();

  /**
   * Realiza un GET a la API gratuita cacheando la respuesta en memoria por un tiempo corto
   */
  private async fetchCached<T = any>(endpoint: string, ttlMs: number): Promise<T> {
    const cached = this.memCache.get(endpoint);
    if (cached && cached.expires > Date.now()) {
      return cached.data as T;
    }

    logger.debug(`[Free API] GET ${endpoint}`);
    const response = await axios.get(`${this.baseURL}${endpoint}`, { timeout: 15000 });
    this.memCache.set(endpoint, { data: response.data, expires: Date.now() + ttlMs });
    return response.data as T;
  }

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
   * Parsea el campo home_scorers/away_scorers (formato tipo array de Postgres con
   * comillas tipográficas, ej: {"J. Quiñones 9'","R. Jiménez 67'"}) a una lista de goles.
   */
  private parseScorers(raw: string | undefined | null): ScorerEntry[] {
    if (!raw || raw === 'null') return [];

    const out: ScorerEntry[] = [];
    let match: RegExpExecArray | null;

    // Reiniciar el estado del regex global antes de usarlo
    SCORER_TOKEN_REGEX.lastIndex = 0;
    while ((match = SCORER_TOKEN_REGEX.exec(raw)) !== null) {
      const token = match[1].trim();
      const minuteMatch = token.match(/^(.+?)\s+(\d+)(?:\+(\d+))?'$/);

      if (minuteMatch) {
        out.push({
          name: minuteMatch[1].trim(),
          minute: parseInt(minuteMatch[2], 10),
          extra: minuteMatch[3] ? parseInt(minuteMatch[3], 10) : undefined
        });
      } else if (token.length > 0) {
        out.push({ name: token, minute: 0 });
      }
    }

    return out;
  }

  /**
   * Obtiene el mapa de estadios (id -> nombre/ciudad) para enriquecer los venues
   */
  private async getStadiumsMap(): Promise<Record<string, { name: string; city: string }>> {
    try {
      const data = await this.fetchCached<any>('/get/stadiums', 86400000); // 24 horas
      const stadiums = data?.stadiums || [];
      const map: Record<string, { name: string; city: string }> = {};

      stadiums.forEach((s: any) => {
        map[s.id] = {
          name: s.fifa_name || s.name_en || `Estadio #${s.id}`,
          city: s.city_en || 'Ciudad Anfitriona'
        };
      });

      return map;
    } catch (error: any) {
      logger.warn(`[Free API] No se pudo obtener /get/stadiums: ${error.message}`);
      return {};
    }
  }

  /**
   * Obtiene la lista cruda de partidos desde /get/games (cacheada 60s)
   */
  private async getRawGames(): Promise<any[]> {
    const data = await this.fetchCached<any>('/get/games', 60000); // 1 minuto
    return data?.games || [];
  }

  /**
   * Obtiene la lista de todos los equipos del mundial 2026
   */
  public async getTeams(): Promise<any[]> {
    try {
      const data = await this.fetchCached<any>('/get/teams', 86400000); // 24 horas
      const rawTeams = data?.teams || [];

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
      const [rawGames, stadiumsMap, rawTeamsData] = await Promise.all([
        this.getRawGames(),
        this.getStadiumsMap(),
        this.fetchCached<any>('/get/teams', 86400000)
      ]);

      // Mapa de id de equipo -> código ISO2 para construir URLs de banderas correctas
      const iso2Map: Record<string, string> = {};
      (rawTeamsData?.teams || []).forEach((t: any) => {
        if (t.iso2) iso2Map[t.id] = t.iso2.toLowerCase();
      });

      // Mapear al modelo unificado de Match
      const matches: Match[] = rawGames.map((g: any) => {
        const homeScore = g.home_score !== 'null' ? parseInt(g.home_score, 10) : null;
        const awayScore = g.away_score !== 'null' ? parseInt(g.away_score, 10) : null;
        const finished = g.finished === 'TRUE';

        const isoDate = this.parseDateString(g.local_date, g.stadium_id);
        const stadiumInfo = stadiumsMap[g.stadium_id];

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
              name: stadiumInfo?.name || `Estadio #${g.stadium_id || 'TBD'}`,
              city: stadiumInfo?.city || 'Ciudad Anfitriona'
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
              logo: iso2Map[g.home_team_id] ? `https://flagcdn.com/w80/${iso2Map[g.home_team_id]}.png` : '⚽'
            },
            away: {
              id: parseInt(g.away_team_id, 10),
              name: g.away_team_name_en || g.away_team_label || 'TBD',
              logo: iso2Map[g.away_team_id] ? `https://flagcdn.com/w80/${iso2Map[g.away_team_id]}.png` : '⚽'
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
          },
          goalScorers: {
            home: this.parseScorers(g.home_scorers),
            away: this.parseScorers(g.away_scorers)
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
      // Necesitamos los equipos para resolver los nombres en la tabla
      const teamsList = await this.getTeams();
      const teamMap: Record<number, { name: string; logo: string }> = {};
      teamsList.forEach(t => {
        teamMap[t.team.id] = {
          name: t.team.name,
          logo: t.team.logo
        };
      });

      const data = await this.fetchCached<any>('/get/groups', 300000); // 5 minutos
      const rawGroups = data?.groups || [];

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

  /**
   * Obtiene la tabla de goleadores agregando los goles registrados en /get/games.
   * 100% gratuito y siempre actualizado con los partidos ya jugados.
   */
  public async getTopScorers(): Promise<TopScorerRow[]> {
    try {
      const [rawGames, teamsList] = await Promise.all([
        this.getRawGames(),
        this.getTeams()
      ]);

      const teamMap: Record<number, { name: string; logo: string }> = {};
      teamsList.forEach(t => {
        teamMap[t.team.id] = { name: t.team.name, logo: t.team.logo };
      });

      interface Agg {
        player: { id: number; name: string; photo: string };
        team: { id: number; name: string; logo: string };
        goals: number;
        matches: Set<string>;
      }

      const aggMap = new Map<string, Agg>();

      const addScorers = (scorers: ScorerEntry[], teamId: number, gameId: string) => {
        const teamInfo = teamMap[teamId] || { name: `Equipo #${teamId}`, logo: '⚽' };
        for (const s of scorers) {
          const key = `${s.name.toLowerCase()}_${teamId}`;
          if (!aggMap.has(key)) {
            aggMap.set(key, {
              player: { id: 0, name: s.name, photo: '' },
              team: { id: teamId, name: teamInfo.name, logo: teamInfo.logo },
              goals: 0,
              matches: new Set()
            });
          }
          const entry = aggMap.get(key)!;
          entry.goals += 1;
          entry.matches.add(gameId);
        }
      };

      for (const g of rawGames) {
        if (g.finished !== 'TRUE') continue;

        const homeId = parseInt(g.home_team_id, 10);
        const awayId = parseInt(g.away_team_id, 10);

        addScorers(this.parseScorers(g.home_scorers), homeId, g.id);
        addScorers(this.parseScorers(g.away_scorers), awayId, g.id);
      }

      const result: TopScorerRow[] = Array.from(aggMap.values()).map(e => ({
        player: e.player,
        team: e.team,
        goals: e.goals,
        matchesPlayed: e.matches.size
      }));

      result.sort((a, b) => b.goals - a.goals);
      return result;
    } catch (error: any) {
      logger.error(`Error al calcular la tabla de goleadores desde la API gratuita: ${error.message}`);
      return [];
    }
  }

  /**
   * Obtiene estadísticas de un equipo agregando sus partidos jugados desde /get/games.
   * 100% gratuito.
   */
  public async getTeamStats(teamId: number): Promise<any> {
    try {
      const [fixtures, teamsList] = await Promise.all([
        this.getFixtures(),
        this.getTeams()
      ]);

      const teamInfo = teamsList.find(t => t.team.id === teamId);
      if (!teamInfo) return null;

      const finished = fixtures
        .filter(f =>
          ['FT', 'AET', 'PEN'].includes(f.fixture.status.short) &&
          (f.teams.home.id === teamId || f.teams.away.id === teamId)
        )
        .sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);

      let played = 0, playedHome = 0, playedAway = 0;
      let wins = 0, draws = 0, loses = 0;
      let goalsForTotal = 0, goalsAgainstTotal = 0;
      let cleanSheets = 0, failedToScore = 0;
      let form = '';

      finished.forEach(f => {
        const isHome = f.teams.home.id === teamId;
        const gf = (isHome ? f.goals.home : f.goals.away) ?? 0;
        const ga = (isHome ? f.goals.away : f.goals.home) ?? 0;

        played++;
        if (isHome) playedHome++; else playedAway++;
        goalsForTotal += gf;
        goalsAgainstTotal += ga;

        if (gf > ga) { wins++; form += 'W'; }
        else if (gf === ga) { draws++; form += 'D'; }
        else { loses++; form += 'L'; }

        if (ga === 0) cleanSheets++;
        if (gf === 0) failedToScore++;
      });

      const avg = (total: number) => (played > 0 ? (total / played).toFixed(2) : '0.00');

      return {
        team: { id: teamId, name: teamInfo.team.name, logo: teamInfo.team.logo },
        fixtures: {
          played: { total: played, home: playedHome, away: playedAway },
          wins: { total: wins },
          draws: { total: draws },
          loses: { total: loses }
        },
        goals: {
          for: { total: { total: goalsForTotal }, average: { total: avg(goalsForTotal) } },
          against: { total: { total: goalsAgainstTotal }, average: { total: avg(goalsAgainstTotal) } }
        },
        form: form.slice(-5),
        clean_sheet: { total: cleanSheets },
        failed_to_score: { total: failedToScore }
      };
    } catch (error: any) {
      logger.error(`Error al calcular estadísticas del equipo ${teamId} desde la API gratuita: ${error.message}`);
      return null;
    }
  }

  /**
   * Obtiene los eventos (goles) de un partido a partir de los goleadores reportados
   */
  public async getFixtureEvents(fixtureId: number): Promise<MatchEvent[]> {
    try {
      const match = await this.getFixture(fixtureId);
      if (!match || !match.goalScorers) return [];

      const events: MatchEvent[] = [];

      const pushEvents = (scorers: ScorerEntry[], team: { id: number; name: string; logo: string }) => {
        scorers.forEach(s => {
          events.push({
            time: { elapsed: s.minute, extra: s.extra ?? null },
            team: { id: team.id, name: team.name, logo: team.logo },
            player: { id: 0, name: s.name },
            assist: { id: null, name: null },
            type: 'Goal',
            detail: 'Normal Goal',
            comments: null
          });
        });
      };

      pushEvents(match.goalScorers.home, match.teams.home);
      pushEvents(match.goalScorers.away, match.teams.away);

      events.sort((a, b) => a.time.elapsed - b.time.elapsed);
      return events;
    } catch (error: any) {
      logger.error(`Error al obtener eventos del partido ${fixtureId} desde la API gratuita: ${error.message}`);
      return [];
    }
  }

  // --- Endpoints no soportados en la versión gratuita ---
  // Retornamos vacíos para que el flujo de herramientas use la búsqueda web como respaldo

  public async getTopAssists(): Promise<TopAssistRow[]> {
    logger.warn('[Free API] getTopAssists no es soportado por la API gratuita del Mundial 2026.');
    return [];
  }

  public async searchPlayer(name: string): Promise<PlayerStatsSummary[]> {
    logger.warn(`[Free API] searchPlayer (${name}) no es soportado por la API gratuita del Mundial 2026.`);
    return [];
  }

  public async getFixtureLineups(fixtureId: number): Promise<MatchLineups[]> {
    logger.warn(`[Free API] getFixtureLineups (${fixtureId}) no es soportado por la API gratuita del Mundial 2026.`);
    return [];
  }
}

export const worldCupFreeProvider = new WorldCupFreeProvider();
