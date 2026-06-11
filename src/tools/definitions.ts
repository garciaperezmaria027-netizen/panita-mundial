import { FunctionDeclaration } from '@google/generative-ai';
import { sportsService } from '../services/sports';
import { duckduckgoSearchService } from '../services/duckduckgo-search';
import * as formatter from '../utils/formatter';
import { logger } from '../utils/logger';

// --- Declaración de Herramientas para Gemini ---

export const getMatchesTodayDeclaration: FunctionDeclaration = {
  name: 'getMatchesToday',
  description: 'Obtiene la lista de partidos programados para una fecha específica o el día de hoy en el Mundial (con hora de Colombia). Úsala para preguntas como: ¿qué partidos hay hoy?, ¿qué partidos se juegan mañana?, ¿a qué hora juega X hoy?, ¿partidos para el YYYY-MM-DD?, etc.',
  parameters: {
    type: 'OBJECT' as any,
    properties: {
      date: {
        type: 'STRING' as any,
        description: 'Fecha opcional en formato YYYY-MM-DD de la cual consultar los partidos (ej. 2026-06-11). Si no se especifica, se asume el día de hoy.'
      }
    }
  }
};

export const getMatchResultDeclaration: FunctionDeclaration = {
  name: 'getMatchResult',
  description: 'Obtiene el resultado del partido más reciente de una selección específica. Úsala para preguntas como: ¿cómo quedó el partido de Argentina?, ¿ganó Brasil su último juego?, ¿cuál fue el resultado de Colombia vs Alemania?',
  parameters: {
    type: 'OBJECT' as any,
    properties: {
      teamName: {
        type: 'STRING' as any,
        description: 'Nombre de la selección de fútbol (ej. Argentina, Brasil, Colombia, Alemania)'
      }
    },
    required: ['teamName']
  }
};

export const getUpcomingMatchesDeclaration: FunctionDeclaration = {
  name: 'getUpcomingMatches',
  description: 'Obtiene los próximos partidos programados en el mundial (incluyendo los de mañana y próximos días). Puede filtrarse para un equipo específico. Úsala para preguntas como: ¿qué partidos hay mañana?, ¿cuáles son los siguientes partidos del mundial?, ¿cuándo vuelve a jugar España?, calendario de próximos juegos.',
  parameters: {
    type: 'OBJECT' as any,
    properties: {
      teamName: {
        type: 'STRING' as any,
        description: 'Nombre opcional de la selección de fútbol para filtrar sus próximos encuentros'
      }
    }
  }
};

export const getGroupStandingsDeclaration: FunctionDeclaration = {
  name: 'getGroupStandings',
  description: 'Obtiene la tabla de posiciones de los grupos del mundial. Puede filtrarse para un grupo específico (A, B, C, D, etc.). Úsala para preguntas como: ¿cómo va el grupo A?, tabla de posiciones del grupo B, clasificación general.',
  parameters: {
    type: 'OBJECT' as any,
    properties: {
      groupLetter: {
        type: 'STRING' as any,
        description: 'Letra o nombre del grupo (ej. A, B, C, Grupo A, Grupo B)'
      }
    }
  }
};

export const getTopScorersDeclaration: FunctionDeclaration = {
  name: 'getTopScorers',
  description: 'Obtiene la tabla de goleadores (máximos anotadores) del Mundial 2026. Úsala para: ¿quién lidera los goleadores?, goleadores del mundial, cuántos goles lleva Messi.'
};

export const getTopAssistsDeclaration: FunctionDeclaration = {
  name: 'getTopAssists',
  description: 'Obtiene la tabla de máximos asistentes (jugadores con más pases de gol) del Mundial 2026. Úsala para: ¿quién tiene más asistencias?, tabla de asistentes.'
};

export const getPlayerStatsDeclaration: FunctionDeclaration = {
  name: 'getPlayerStats',
  description: 'Obtiene las estadísticas de rendimiento individuales de un jugador específico en este mundial (partidos, minutos, goles, asistencias, tarjetas, etc.). Úsala para: estadísticas de Mbappé, cuántos pases clave hizo James, rendimiento de un jugador.',
  parameters: {
    type: 'OBJECT' as any,
    properties: {
      playerName: {
        type: 'STRING' as any,
        description: 'Nombre completo o conocido del jugador a buscar (ej. Lionel Messi, Kylian Mbappé)'
      }
    },
    required: ['playerName']
  }
};

export const getTeamStatsDeclaration: FunctionDeclaration = {
  name: 'getTeamStats',
  description: 'Obtiene estadísticas de rendimiento colectivo de una selección nacional (partidos jugados, ganados, goles a favor, en contra, forma reciente, etc.). Úsala para: estadísticas de Brasil, rendimiento de Colombia, cómo va la forma de Francia.',
  parameters: {
    type: 'OBJECT' as any,
    properties: {
      teamName: {
        type: 'STRING' as any,
        description: 'Nombre de la selección de fútbol (ej. Colombia, Argentina, Alemania)'
      }
    },
    required: ['teamName']
  }
};

export const getLineupsDeclaration: FunctionDeclaration = {
  name: 'getLineups',
  description: 'Obtiene las alineaciones (titulares y suplentes) para un partido específico, buscando por el nombre de la selección. Úsala para: alineación probable de Brasil, quién juega hoy con Argentina, cuál es la nómina de Colombia.',
  parameters: {
    type: 'OBJECT' as any,
    properties: {
      teamName: {
        type: 'STRING' as any,
        description: 'Nombre del equipo del cual se quiere conocer la alineación de su partido más cercano o reciente'
      },
      matchId: {
        type: 'INTEGER' as any,
        description: 'ID numérico directo del partido de la API (opcional si se provee el nombre del equipo)'
      }
    }
  }
};

export const getMatchDetailsDeclaration: FunctionDeclaration = {
  name: 'getMatchDetails',
  description: 'Obtiene los detalles completos de incidencias de un partido (goles, tarjetas amarillas/rojas, eventos principales). Permite buscar por el nombre de un equipo.',
  parameters: {
    type: 'OBJECT' as any,
    properties: {
      teamName: {
        type: 'STRING' as any,
        description: 'Nombre del equipo del cual se quiere conocer el detalle de incidencias de su partido más cercano o reciente'
      },
      matchId: {
        type: 'INTEGER' as any,
        description: 'ID numérico directo del partido de la API (opcional si se provee el nombre del equipo)'
      }
    }
  }
};

export const getTeamSquadDeclaration: FunctionDeclaration = {
  name: 'getTeamSquad',
  description: 'Obtiene la lista de jugadores convocados (plantilla/squad) de una selección nacional para el Mundial 2026. Úsala cuando el usuario te pregunte quiénes juegan en un equipo, quién está convocado, o para predecir la alineación probable con los jugadores actuales reales.',
  parameters: {
    type: 'OBJECT' as any,
    properties: {
      teamName: {
        type: 'STRING' as any,
        description: 'Nombre de la selección de fútbol (ej. Colombia, Argentina, España, Brasil, México)'
      }
    },
    required: ['teamName']
  }
};

export const searchWebDeclaration: FunctionDeclaration = {
  name: 'searchWeb',
  description: 'Realiza una búsqueda en internet en tiempo real usando DuckDuckGo para resolver preguntas sobre noticias de actualidad, resultados en vivo que no estén en la base de datos local, o detalles específicos del torneo. Úsala si la consulta no es respondida por las herramientas de fútbol o si éstas devuelven datos incompletos.',
  parameters: {
    type: 'OBJECT' as any,
    properties: {
      query: {
        type: 'STRING' as any,
        description: 'Consulta de búsqueda específica y detallada en texto plano (ej. resultado en vivo de Colombia hoy, noticias de lesionados en Argentina, etc.)'
      }
    },
    required: ['query']
  }
};

// Exportar la lista de herramientas listas para el SDK
export const WORLD_CUP_TOOLS = [
  {
    functionDeclarations: [
      getMatchesTodayDeclaration,
      getMatchResultDeclaration,
      getUpcomingMatchesDeclaration,
      getGroupStandingsDeclaration,
      getTopScorersDeclaration,
      getTopAssistsDeclaration,
      getPlayerStatsDeclaration,
      getTeamStatsDeclaration,
      getLineupsDeclaration,
      getMatchDetailsDeclaration,
      getTeamSquadDeclaration,
      searchWebDeclaration
    ]
  }
];

// --- Ejecutor de Herramientas ---

export async function executeTool(name: string, args: any): Promise<any> {
  logger.info(`[Tool Execution] Ejecutando herramienta: ${name} con argumentos: ${JSON.stringify(args)}`);
  
  try {
    switch (name) {
      case 'getMatchesToday': {
        const date = args.date;
        const matches = await sportsService.getMatchesToday(date);
        return {
          original_data: matches.map(m => formatter.enrichMatchForAi(m)),
          whatsapp_formatted_text: formatter.formatDailySummary(matches, date)
        };
      }

      case 'getMatchResult': {
        const teamName = args.teamName;
        const matches = await sportsService.getMatchResult(teamName);
        return {
          original_data: matches.map(m => formatter.enrichMatchForAi(m)),
          whatsapp_formatted_text: formatter.formatMatchResults(matches, teamName)
        };
      }

      case 'getUpcomingMatches': {
        const teamName = args.teamName;
        const matches = await sportsService.getUpcomingMatches(teamName);
        return {
          original_data: matches.map(m => formatter.enrichMatchForAi(m)),
          whatsapp_formatted_text: formatter.formatUpcomingMatches(matches, teamName)
        };
      }

      case 'getGroupStandings': {
        const groupLetter = args.groupLetter;
        const standings = await sportsService.getGroupStandings(groupLetter);
        return {
          original_data: standings,
          whatsapp_formatted_text: formatter.formatStandings(standings)
        };
      }

      case 'getTopScorers': {
        const scorers = await sportsService.getTopScorers();
        if (scorers.length === 0) {
          const searchResult = await duckduckgoSearchService.search("FIFA World Cup 2026 top scorers list goals");
          return {
            original_data: null,
            whatsapp_formatted_text: `⚠️ *Goleadores (vía DuckDuckGo)*:\n\n${searchResult.whatsapp_formatted_text || searchResult.error || 'No se encontró información de goleadores.'}`
          };
        }
        return {
          original_data: scorers,
          whatsapp_formatted_text: formatter.formatTopScorers(scorers)
        };
      }

      case 'getTopAssists': {
        const assists = await sportsService.getTopAssists();
        if (assists.length === 0) {
          const searchResult = await duckduckgoSearchService.search("FIFA World Cup 2026 top assists list players");
          return {
            original_data: null,
            whatsapp_formatted_text: `⚠️ *Asistidores (vía DuckDuckGo)*:\n\n${searchResult.whatsapp_formatted_text || searchResult.error || 'No se encontró información de asistentes.'}`
          };
        }
        return {
          original_data: assists,
          whatsapp_formatted_text: formatter.formatTopAssists(assists)
        };
      }

      case 'getPlayerStats': {
        const playerName = args.playerName;
        const stats = await sportsService.getPlayerStats(playerName);
        if (stats.length === 0) {
          const searchResult = await duckduckgoSearchService.search(`stats of ${playerName} in FIFA World Cup 2026 goals assists matches`);
          return {
            original_data: null,
            whatsapp_formatted_text: `⚠️ *Estadísticas de ${playerName} (vía DuckDuckGo)*:\n\n${searchResult.whatsapp_formatted_text || searchResult.error || 'No se encontró información del jugador.'}`
          };
        }
        return {
          original_data: stats,
          whatsapp_formatted_text: formatter.formatPlayerStats(stats)
        };
      }

      case 'getTeamStats': {
        const teamName = args.teamName;
        const stats = await sportsService.getTeamStats(teamName);
        if (!stats) {
          const searchResult = await duckduckgoSearchService.search(`estadísticas de la selección de ${teamName} en el Mundial 2026 partidos goles`);
          return {
            original_data: null,
            whatsapp_formatted_text: `⚠️ *Estadísticas de ${teamName} (vía DuckDuckGo)*:\n\n${searchResult.whatsapp_formatted_text || searchResult.error || 'No se encontró información del equipo.'}`
          };
        }
        return {
          original_data: stats,
          whatsapp_formatted_text: formatter.formatTeamStats(stats)
        };
      }

      case 'getLineups': {
        let matchId = args.matchId;
        const teamName = args.teamName;

        if (!matchId && teamName) {
          // Buscar el partido más representativo del equipo (hoy o el más reciente)
          const todayMatches = await sportsService.getMatchesToday();
          let match = todayMatches.find(m => 
            m.teams.home.name.toLowerCase().includes(teamName.toLowerCase()) ||
            m.teams.away.name.toLowerCase().includes(teamName.toLowerCase())
          );

          if (!match) {
            // Si no juega hoy, buscar el resultado más reciente
            const results = await sportsService.getMatchResult(teamName);
            if (results.length > 0) {
              match = results[0];
            } else {
              // Si no hay resultados, buscar el próximo
              const upcoming = await sportsService.getUpcomingMatches(teamName);
              if (upcoming.length > 0) {
                match = upcoming[0];
              }
            }
          }

          if (match) {
            matchId = match.fixture.id;
          }
        }

        if (!matchId) {
          if (teamName) {
            const searchResult = await duckduckgoSearchService.search(`probable lineup alineacion de la seleccion de ${teamName} Mundial 2026`);
            return {
              original_data: null,
              whatsapp_formatted_text: `⚠️ *Alineación de ${teamName} (vía DuckDuckGo)*:\n\n${searchResult.whatsapp_formatted_text || searchResult.error || 'No se encontró alineación.'}`
            };
          }
          return { error: `No se pudo encontrar ningún partido reciente o futuro para el equipo: ${teamName || ''}` };
        }

        const lineups = await sportsService.getLineups(matchId);
        
        // Si no hay alineaciones, buscar en Google
        if (lineups.length === 0) {
          const matchData = await sportsService.getMatchDetails(matchId);
          const vsText = matchData ? `${matchData.match.teams.home.name} vs ${matchData.match.teams.away.name}` : (teamName || '');
          const searchResult = await duckduckgoSearchService.search(`lineup alineaciones oficiales o probables de ${vsText} Mundial 2026`);
          return {
            original_data: null,
            whatsapp_formatted_text: `⚠️ *Alineaciones (vía DuckDuckGo)*:\n\n${searchResult.whatsapp_formatted_text || searchResult.error || 'Alineaciones no disponibles aún.'}`
          };
        }

        // Obtener datos del fixture para contexto
        const matchData = await sportsService.getMatchDetails(matchId);
        
        let formatted = `📋 *ALINEACIONES OFICIALES / PROBABLES*\n`;
        if (matchData) {
          const homeFlag = formatter.getFlagEmoji(matchData.match.teams.home.name);
          const awayFlag = formatter.getFlagEmoji(matchData.match.teams.away.name);
          formatted += `Partido: ${homeFlag} *${matchData.match.teams.home.name}* vs *${matchData.match.teams.away.name}* ${awayFlag}\n\n`;
        }

        lineups.forEach(l => {
          const flag = formatter.getFlagEmoji(l.team.name);
          formatted += `*${flag} ${l.team.name.toUpperCase()}* (${l.formation})\n`;
          formatted += `*Titulares:*\n`;
          l.startXI.forEach(p => {
            formatted += `  • ${p.player.number}. ${p.player.name} (${p.player.pos})\n`;
          });
          formatted += `*DT:* ${l.coach.name}\n\n`;
        });

        return {
          original_data: lineups,
          whatsapp_formatted_text: formatted
        };
      }

      case 'getMatchDetails': {
        let matchId = args.matchId;
        const teamName = args.teamName;

        if (!matchId && teamName) {
          // Buscar hoy
          const todayMatches = await sportsService.getMatchesToday();
          let match = todayMatches.find(m => 
            m.teams.home.name.toLowerCase().includes(teamName.toLowerCase()) ||
            m.teams.away.name.toLowerCase().includes(teamName.toLowerCase())
          );

          if (!match) {
            const results = await sportsService.getMatchResult(teamName);
            if (results.length > 0) {
              match = results[0];
            } else {
              const upcoming = await sportsService.getUpcomingMatches(teamName);
              if (upcoming.length > 0) {
                match = upcoming[0];
              }
            }
          }

          if (match) {
            matchId = match.fixture.id;
          }
        }

        if (!matchId) {
          if (teamName) {
            const searchResult = await duckduckgoSearchService.search(`resumen del partido de la seleccion de ${teamName} Mundial 2026`);
            return {
              original_data: null,
              whatsapp_formatted_text: `⚠️ *Resumen del partido de ${teamName} (vía DuckDuckGo)*:\n\n${searchResult.whatsapp_formatted_text || searchResult.error || 'No se encontró información.'}`
            };
          }
          return { error: `No se pudo encontrar ningún partido reciente o futuro para el equipo: ${teamName || ''}` };
        }

        const details = await sportsService.getMatchDetails(matchId);
        if (!details) {
          const searchResult = await duckduckgoSearchService.search(`goles tarjetas incidencias partido ID ${matchId} Mundial 2026`);
          return {
            original_data: null,
            whatsapp_formatted_text: `⚠️ *Detalles del partido (vía DuckDuckGo)*:\n\n${searchResult.whatsapp_formatted_text || searchResult.error || 'Detalles no disponibles.'}`
          };
        }

        const enrichedDetails = {
          ...details,
          match: formatter.enrichMatchForAi(details.match)
        };

        return {
          original_data: enrichedDetails,
          whatsapp_formatted_text: formatter.formatMatchDetails(details)
        };
      }

      case 'getTeamSquad': {
        const teamName = args.teamName;
        const squad = sportsService.getTeamSquad(teamName);
        if (!squad) {
          const searchResult = await duckduckgoSearchService.search(`convocados plantilla seleccion de ${teamName} Mundial 2026`);
          return {
            original_data: null,
            whatsapp_formatted_text: `⚠️ *Convocatoria de ${teamName} (vía DuckDuckGo)*:\n\n${searchResult.whatsapp_formatted_text || searchResult.error || 'No se encontró información de convocados.'}`
          };
        }
        
        let formatted = `📋 *PLANTILLA CONVOCADA - ${squad.name.toUpperCase()}* ⚽\n`;
        formatted += `Director Técnico: *${squad.coach}*\n\n`;
        
        // Agrupar por posición
        const positions = ['Portero', 'Defensa', 'Centrocampista', 'Delantero'];
        positions.forEach(pos => {
          const list = squad.players.filter((p: any) => p.pos === pos);
          if (list.length > 0) {
            formatted += `*${pos}s:*\n`;
            list.forEach((p: any) => {
              formatted += `  • ${p.name} (_${p.club}_)\n`;
            });
            formatted += `\n`;
          }
        });

        return {
          original_data: squad,
          whatsapp_formatted_text: formatted.trim()
        };
      }

      case 'search':
      case 'searchWeb':
      // Aliases que los modelos de OpenRouter suelen inventar — los redirigimos a búsqueda web
      case 'searchWorldCupData':
      case 'searchFootballData':
      case 'searchSportsData':
      case 'webSearch':
      case 'searchInternet':
      case 'searchGoogle':
      case 'searchNews':
      case 'getCurrentInfo': {
        // Intentar extraer la query de distintos campos que el modelo pueda haber usado
        const query = args.query || args.search_query || args.q || args.term || args.keywords || name;
        logger.info(`[Tool Alias] Herramienta "${name}" redirigida a búsqueda web con query: "${query}"`);
        const searchResult = await duckduckgoSearchService.search(query);
        return searchResult;
      }

      default: {
        // Para cualquier herramienta desconocida, intentar una búsqueda web como último recurso
        const fallbackQuery = args.query || args.search_query || args.q || args.term || args.keywords || args.teamName || args.playerName || name;
        logger.warn(`[Tool Fallback] Herramienta desconocida "${name}" — ejecutando búsqueda web con: "${fallbackQuery}"`);
        const searchResult = await duckduckgoSearchService.search(`${fallbackQuery} FIFA World Cup 2026`);
        return searchResult;
      }
    }
  } catch (error: any) {
    logger.error(`Error al ejecutar la herramienta ${name}:`, error);
    return { error: error.message };
  }
}
