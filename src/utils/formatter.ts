import { Match, GroupStanding, TopScorerRow, TopAssistRow, PlayerStatsSummary, StandingTeam } from '../types/sports';

/**
 * Mapeo de códigos de país de FIFA / Nombres comunes a Emojis de Banderas
 */
const COUNTRY_FLAGS: Record<string, string> = {
  // Las 48 selecciones clasificadas al Mundial 2026
  'Mexico': '🇲🇽',
  'South Africa': '🇿🇦',
  'South Korea': '🇰🇷',
  'Czech Republic': '🇨🇿',
  'Canada': '🇨🇦',
  'Bosnia and Herzegovina': '🇧🇦',
  'Qatar': '🇶🇦',
  'Switzerland': '🇨🇭',
  'Brazil': '🇧🇷',
  'Morocco': '🇲🇦',
  'Haiti': '🇭🇹',
  'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'United States': '🇺🇸',
  'USA': '🇺🇸',
  'Paraguay': '🇵🇾',
  'Australia': '🇦🇺',
  'Turkey': '🇹🇷',
  'Germany': '🇩🇪',
  'Curaçao': '🇨🇼',
  'Ivory Coast': '🇨🇮',
  'Ecuador': '🇪🇨',
  'Netherlands': '🇳🇱',
  'Japan': '🇯🇵',
  'Sweden': '🇸🇪',
  'Tunisia': '🇹🇳',
  'Belgium': '🇧🇪',
  'Egypt': '🇪🇬',
  'Iran': '🇮🇷',
  'New Zealand': '🇳🇿',
  'Spain': '🇪🇸',
  'Cape Verde': '🇨🇻',
  'Saudi Arabia': '🇸🇦',
  'Uruguay': '🇺🇾',
  'France': '🇫🇷',
  'Senegal': '🇸🇳',
  'Iraq': '🇮🇶',
  'Norway': '🇳🇴',
  'Argentina': '🇦🇷',
  'Algeria': '🇩🇿',
  'Austria': '🇦🇹',
  'Jordan': '🇯🇴',
  'Portugal': '🇵🇹',
  'Democratic Republic of the Congo': '🇨🇩',
  'Uzbekistan': '🇺🇿',
  'Colombia': '🇨🇴',
  'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Croatia': '🇭🇷',
  'Ghana': '🇬🇭',
  'Panama': '🇵🇦',
  // Otras selecciones que los usuarios suelen mencionar aunque no estén en el Mundial 2026
  'Italy': '🇮🇹',
  'Poland': '🇵🇱',
  'Cameroon': '🇨🇲',
  'Costa Rica': '🇨🇷',
  'Peru': '🇵🇪',
  'Chile': '🇨🇱',
  'Venezuela': '🇻🇪',
  'Bolivia': '🇧🇴',
  'Denmark': '🇩🇰',
  'Ukraine': '🇺🇦',
  'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'Serbia': '🇷🇸'
};

/**
 * Obtiene el emoji de bandera de un equipo por su nombre en inglés
 */
export function getFlagEmoji(teamName: string): string {
  return COUNTRY_FLAGS[teamName] || '⚽';
}

/**
 * Convierte una fecha ISO a hora local de Colombia (UTC-5) en formato 12H (ej: 1:00 PM)
 */
export function formatColombiaTime(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).toUpperCase();
  } catch (error) {
    return 'Hora TBD';
  }
}

/**
 * Convierte una fecha ISO a una fecha legible en Colombia (ej: 15 de Junio)
 */
export function formatColombiaDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      day: 'numeric',
      month: 'long'
    }).toUpperCase();
  } catch (error) {
    return 'Fecha TBD';
  }
}

/**
 * Determina los canales de TV en Colombia y plataformas de streaming para el partido
 */
export function getColombiaBroadcasters(match: Match): { tv: string[]; streaming: string[] } {
  // En Colombia, Caracol y RCN transmiten los partidos principales y de la Selección Colombia.
  // DirecTV (DGO) transmite el 100% de los partidos del mundial de forma exclusiva en muchos casos.
  // Haremos una simulación lógica interesante:
  const isHighProfile = [
    'Brazil', 'Argentina', 'France', 'Germany', 'Spain', 'England', 'Colombia', 'Mexico', 'USA'
  ].some(team => match.teams.home.name === team || match.teams.away.name === team);

  const tv = ['DirecTV Sports'];
  const streaming = ['DGO'];

  if (isHighProfile || match.league.round.toLowerCase().includes('final') || Math.random() > 0.4) {
    tv.push('Caracol TV');
    tv.push('Canal RCN');
  }

  return { tv, streaming };
}

/**
 * Genera la línea de texto con los goleadores del partido (si hay datos disponibles)
 */
function formatScorersLine(m: Match): string {
  if (!m.goalScorers) return '';

  const formatSide = (scorers: { name: string; minute: number; extra?: number }[]) =>
    scorers
      .sort((a, b) => a.minute - b.minute)
      .map(s => `${s.name} ${s.minute}'${s.extra ? `+${s.extra}` : ''}`)
      .join(', ');

  const homeStr = formatSide(m.goalScorers.home);
  const awayStr = formatSide(m.goalScorers.away);

  if (!homeStr && !awayStr) return '';

  let line = `⚽ Goles: `;
  const parts: string[] = [];
  if (homeStr) parts.push(`${m.teams.home.name}: ${homeStr}`);
  if (awayStr) parts.push(`${m.teams.away.name}: ${awayStr}`);
  line += parts.join(' | ');
  return line + '\n';
}

/**
 * Formatea el resumen diario de partidos
 */
export function formatDailySummary(matches: Match[], dateStr?: string): string {
  if (matches.length === 0) {
    const formattedDate = dateStr ? formatColombiaDate(new Date(dateStr + 'T00:00:00').toISOString()) : 'hoy';
    return `⚽ *PARTIDOS DEL MUNDIAL*\n\nNo hay partidos programados en el calendario oficial para ${formattedDate.toLowerCase()}. ¡Día de descanso!`;
  }

  const bogotaDateStr = formatColombiaDate(matches[0].fixture.date);
  let text = `⚽ *PARTIDOS DEL MUNDIAL - ${bogotaDateStr}*\n\n`;

  // Buscar el partido destacado del día
  // Será el partido entre equipos con mayor ranking o rondas finales
  let featuredMatch: Match = matches[0];
  let maxWeight = 0;
  
  const topTeams = ['Brazil', 'Argentina', 'France', 'Germany', 'Spain', 'England', 'Italy', 'Portugal', 'Netherlands', 'Colombia'];

  matches.forEach(m => {
    let weight = 0;
    if (topTeams.includes(m.teams.home.name)) weight += 5;
    if (topTeams.includes(m.teams.away.name)) weight += 5;
    if (m.league.round.toLowerCase().includes('final')) weight += 10;
    
    if (weight > maxWeight) {
      maxWeight = weight;
      featuredMatch = m;
    }
  });

  matches.forEach(m => {
    const homeFlag = getFlagEmoji(m.teams.home.name);
    const awayFlag = getFlagEmoji(m.teams.away.name);
    const time = formatColombiaTime(m.fixture.date);
    const broadcasters = getColombiaBroadcasters(m);
    
    text += `${homeFlag} *${m.teams.home.name}* vs *${m.teams.away.name}* ${awayFlag}\n`;

    if (m.fixture.status.short === 'NS') {
      text += `🕐 ${time}\n`;
    } else {
      // Si ya empezó o terminó
      const homeGoals = m.goals.home !== null ? m.goals.home : 0;
      const awayGoals = m.goals.away !== null ? m.goals.away : 0;
      text += `🏆 Marcador: *${homeGoals} - ${awayGoals}* (${m.fixture.status.long})\n`;
      text += formatScorersLine(m);
    }

    text += `📺 TV: ${broadcasters.tv.join(' / ')}\n`;
    text += `📱 Streaming: ${broadcasters.streaming.join(' / ')}\n\n`;
  });

  if (featuredMatch) {
    text += `🔥 *Partido destacado del día:*\n`;
    const homeFlag = getFlagEmoji(featuredMatch.teams.home.name);
    const awayFlag = getFlagEmoji(featuredMatch.teams.away.name);
    text += `${homeFlag} *${featuredMatch.teams.home.name} vs ${featuredMatch.teams.away.name}* ${awayFlag}\n`;
    text += `¡No te lo pierdas!`;
  }

  return text;
}

/**
 * Formatea los resultados recientes
 */
export function formatMatchResults(matches: Match[], teamName?: string): string {
  if (matches.length === 0) {
    return `❌ No se encontraron partidos finalizados ${teamName ? `para "${teamName}"` : ''} en el registro.`;
  }

  let text = `🏆 *RESULTADOS RECIENTES ${teamName ? `DE ${teamName.toUpperCase()}` : ''}*\n\n`;
  
  matches.slice(0, 5).forEach(m => {
    const homeFlag = getFlagEmoji(m.teams.home.name);
    const awayFlag = getFlagEmoji(m.teams.away.name);
    const date = formatColombiaDate(m.fixture.date);
    const homeGoals = m.goals.home !== null ? m.goals.home : '-';
    const awayGoals = m.goals.away !== null ? m.goals.away : '-';
    
    text += `📅 ${date}\n`;
    text += `${homeFlag} *${m.teams.home.name} ${homeGoals}* - *${awayGoals} ${m.teams.away.name}* ${awayFlag}\n`;
    if (m.score.penalty.home !== null) {
      text += `   (Penales: ${m.score.penalty.home} - ${m.score.penalty.away})\n`;
    }
    text += formatScorersLine(m);
    text += `🏁 Estado: ${m.fixture.status.long}\n\n`;
  });

  return text;
}

/**
 * Formatea los próximos partidos
 */
export function formatUpcomingMatches(matches: Match[], teamName?: string): string {
  if (matches.length === 0) {
    return `📅 No hay próximos partidos programados ${teamName ? `para "${teamName}"` : ''}.`;
  }

  let text = `📅 *PRÓXIMOS PARTIDOS ${teamName ? `DE ${teamName.toUpperCase()}` : ''}*\n\n`;
  
  matches.slice(0, 5).forEach(m => {
    const homeFlag = getFlagEmoji(m.teams.home.name);
    const awayFlag = getFlagEmoji(m.teams.away.name);
    const date = formatColombiaDate(m.fixture.date);
    const time = formatColombiaTime(m.fixture.date);
    
    const broadcasters = getColombiaBroadcasters(m);
    text += `📅 *${date}*\n`;
    text += `${homeFlag} *${m.teams.home.name}* vs *${m.teams.away.name}* ${awayFlag}\n`;
    text += `🕐 Hora Colombia: *${time}*\n`;
    text += `📺 TV: ${broadcasters.tv.join(' / ')}\n`;
    text += `📱 Streaming: ${broadcasters.streaming.join(' / ')}\n`;
    text += `---------------------------\n\n`;
  });

  return text;
}

/**
 * Formatea la tabla de posiciones de un grupo
 */
export function formatStandings(groups: GroupStanding[]): string {
  if (groups.length === 0) {
    return `📊 *No hay datos de tabla de posiciones disponibles en este momento.*`;
  }

  let text = `📊 *TABLAS DE POSICIONES DEL MUNDIAL 2026*\n\n`;

  groups.forEach(g => {
    text += `🏆 *${g.groupName.toUpperCase()}*\n`;
    text += `─────────────────────\n`;
    
    g.standings.forEach(row => {
      const flag = getFlagEmoji(row.team.name);
      const sign = row.goalsDiff > 0 ? '+' : '';
      
      text += `*${row.rank}º* ${flag} *${row.team.name}*  🏆 *${row.points} pts*\n`;
      text += `   _PJ: ${row.all.played} | PG: ${row.all.win} | PE: ${row.all.draw} | PP: ${row.all.lose} | DG: ${sign}${row.goalsDiff}_\n\n`;
    });
  });

  return text;
}

/**
 * Formatea los goleadores
 */
export function formatTopScorers(scorers: TopScorerRow[]): string {
  if (scorers.length === 0) {
    return `❌ No hay información de goleadores disponible.`;
  }

  let text = `⚽ *TABLA DE GOLEADORES - MUNDIAL 2026*\n\n`;
  
  scorers.slice(0, 10).forEach((s, idx) => {
    const flag = getFlagEmoji(s.team.name);
    text += `${idx + 1}. 👤 *${s.player.name}* ${flag} (${s.team.name})\n`;
    text += `   ⚽ Goles: *${s.goals}* | 🏟️ Partidos: ${s.matchesPlayed}\n\n`;
  });

  return text;
}

/**
 * Formatea los asistentes
 */
export function formatTopAssists(assists: TopAssistRow[]): string {
  if (assists.length === 0) {
    return `❌ No hay información de asistencias disponible.`;
  }

  let text = `👟 *LÍDERES EN ASISTENCIAS - MUNDIAL 2026*\n\n`;
  
  assists.slice(0, 10).forEach((s, idx) => {
    const flag = getFlagEmoji(s.team.name);
    text += `${idx + 1}. 👤 *${s.player.name}* ${flag} (${s.team.name})\n`;
    text += `   👟 Asistencias: *${s.assists}* | 🏟️ Partidos: ${s.matchesPlayed}\n\n`;
  });

  return text;
}

/**
 * Formatea las estadísticas de un jugador
 */
export function formatPlayerStats(summaries: PlayerStatsSummary[]): string {
  if (summaries.length === 0) {
    return `❌ No se encontró información detallada del jugador solicitado.`;
  }

  const p = summaries[0].player;
  const stats = summaries[0].statistics[0]; // Tomamos la estadística del mundial (primera en la lista)

  const flag = getFlagEmoji(stats.team.name);
  let text = `👤 *PERFIL DE JUGADOR*\n\n`;
  text += `*Nombre:* ${p.firstname} ${p.lastname}\n`;
  text += `*Edad:* ${p.age} años\n`;
  text += `*Nacionalidad:* ${p.nationality} ${flag}\n`;
  text += `*Posición:* ${stats.games.position}\n`;
  text += `*Equipo:* ${stats.team.name}\n\n`;

  text += `📊 *ESTADÍSTICAS EN EL MUNDIAL 2026:*\n`;
  text += `🏟️ Partidos Jugados: *${stats.games.appearances || 0}* (Titular: ${stats.games.lineups || 0})\n`;
  text += `⏱️ Minutos: *${stats.games.minutes || 0}*\n`;
  text += `⚽ Goles: *${stats.goals.total || 0}*\n`;
  text += `👟 Asistencias: *${stats.goals.assists || 0}*\n`;
  
  if (stats.games.position === 'Goalkeeper') {
    text += `🧤 Atajadas: *${stats.goals.saves || 0}*\n`;
    text += `🥅 Goles concedidos: *${stats.goals.conceded || 0}*\n`;
  } else {
    text += `🎯 Tiros (al arco): *${stats.shots.total || 0}* (${stats.shots.on || 0})\n`;
    text += `🔄 Pases clave: *${stats.passes.key || 0}* (Precisión: ${stats.passes.accuracy || 0}%)\n`;
  }

  text += `🟨 Tarjetas Amarillas: *${stats.cards.yellow || 0}*\n`;
  text += `🟥 Tarjetas Rojas: *${stats.cards.red || 0}*\n`;
  if (stats.games.rating) {
    text += `⭐ Calificación promedio: *${parseFloat(stats.games.rating).toFixed(2)}*\n`;
  }

  return text;
}

/**
 * Formatea estadísticas generales de un equipo
 */
export function formatTeamStats(stats: any): string {
  if (!stats) {
    return `❌ No se pudo obtener estadísticas del equipo seleccionado.`;
  }

  const team = stats.team;
  const flag = getFlagEmoji(team.name);
  const fixt = stats.fixtures;
  const goals = stats.goals;

  let text = `${flag} *ESTADÍSTICAS DE ${team.name.toUpperCase()}* ⚽\n\n`;
  text += `*Partidos Jugados:* ${fixt.played.total} (Local: ${fixt.played.home}, Visitante: ${fixt.played.away})\n`;
  text += `*Victorias:* ${fixt.wins.total} | *Empates:* ${fixt.draws.total} | *Derrotas:* ${fixt.loses.total}\n\n`;

  text += `⚽ *GOLES:*\n`;
  text += `  A favor: *${goals.for.total.total}* (Promedio: ${goals.for.average.total}/partido)\n`;
  text += `  En contra: *${goals.against.total.total}* (Promedio: ${goals.against.average.total}/partido)\n\n`;

  text += `📋 *Rendimiento:*\n`;
  text += `  Forma reciente: *${stats.form || 'N/A'}*\n`;
  text += `  Vallas invictas: *${stats.clean_sheet.total}*\n`;
  text += `  Partidos sin marcar: *${stats.failed_to_score.total}*\n`;
  
  if (stats.lineups && stats.lineups.length > 0) {
    text += `  Formación más usada: *${stats.lineups[0].formation}* (${stats.lineups[0].played} veces)\n`;
  }

  return text;
}

/**
 * Formatea los detalles de un partido (eventos, alineaciones)
 */
export function formatMatchDetails(data: { match: Match; events: any[]; lineups: any[] }): string {
  const m = data.match;
  const homeFlag = getFlagEmoji(m.teams.home.name);
  const awayFlag = getFlagEmoji(m.teams.away.name);
  
  const date = formatColombiaDate(m.fixture.date);
  const time = formatColombiaTime(m.fixture.date);
  const homeGoals = m.goals.home !== null ? m.goals.home : 0;
  const awayGoals = m.goals.away !== null ? m.goals.away : 0;

  const broadcasters = getColombiaBroadcasters(m);
  let text = `🏆 *DETALLES DEL PARTIDO*\n`;
  text += `📅 Fecha: ${date} | 🕐 Colombia: ${time}\n`;
  text += `📺 TV: ${broadcasters.tv.join(' / ')}\n`;
  text += `📱 Streaming: ${broadcasters.streaming.join(' / ')}\n`;
  text += `🏁 Estado: *${m.fixture.status.long}*\n\n`;

  text += `${homeFlag} *${m.teams.home.name}  ${homeGoals}* - *${awayGoals}  ${m.teams.away.name}* ${awayFlag}\n`;
  
  if (m.score.penalty.home !== null) {
    text += `   (Penales: ${m.score.penalty.home} - ${m.score.penalty.away})\n`;
  }
  text += `--------------------------------------\n\n`;

  // Añadir eventos cronológicos (Goles, Tarjetas, Cambios importantes)
  if (data.events && data.events.length > 0) {
    text += `🔥 *INCIDENCIAS DEL PARTIDO:*\n`;
    
    // Filtrar solo goles y tarjetas rojas/amarillas para que no sea demasiado largo
    const mainEvents = data.events.filter(e => 
      ['Goal', 'Card'].includes(e.type)
    );

    if (mainEvents.length > 0) {
      mainEvents.forEach(e => {
        const timeStr = `${e.time.elapsed}'${e.time.extra ? `+${e.time.extra}` : ''}`;
        const isHome = e.team.id === m.teams.home.id;
        const alignPrefix = isHome ? `⚽ (L)` : `⚽ (V)`;

        let emoji = '⚙️';
        if (e.type === 'Goal') {
          emoji = '⚽ ¡GOL!';
        } else if (e.type === 'Card') {
          emoji = e.detail.includes('Red') ? '🟥 Roja' : '🟨 Amarilla';
        }

        const assistStr = e.assist.name ? ` (Asist: ${e.assist.name})` : '';
        text += `• *${timeStr}* - ${emoji} *${e.player.name}* ${isHome ? homeFlag : awayFlag}${assistStr}\n`;
      });
    } else {
      text += `Sin incidencias importantes registradas.\n`;
    }
    text += `\n`;
  }

  // Alineaciones básicas
  if (data.lineups && data.lineups.length > 0) {
    text += `📋 *FORMACIONES:*\n`;
    data.lineups.forEach(l => {
      const flag = getFlagEmoji(l.team.name);
      text += `*${flag} ${l.team.name}:* ${l.formation} (DT: ${l.coach.name})\n`;
    });
  }

  return text;
}

/**
 * Enriquece el objeto Match con datos explícitamente formateados para la IA
 */
export function enrichMatchForAi(match: Match): any {
  const broadcasters = getColombiaBroadcasters(match);
  const isFinished = ['FT', 'AET', 'PEN'].includes(match.fixture.status.short);

  // Si tenemos goleadores (proveedor gratuito), exponerlos en formato legible para la IA
  let goleadores: { home: string[]; away: string[] } | undefined;
  if (match.goalScorers) {
    const formatScorer = (s: { name: string; minute: number; extra?: number }) =>
      `${s.name} ${s.minute}'${s.extra ? `+${s.extra}` : ''}`;

    goleadores = {
      home: match.goalScorers.home.map(formatScorer),
      away: match.goalScorers.away.map(formatScorer)
    };
  }

  return {
    ...match,
    fixture: {
      ...match.fixture,
      fecha_colombia: formatColombiaDate(match.fixture.date),
      hora_colombia: formatColombiaTime(match.fixture.date),
      canales_tv_colombia: broadcasters.tv.join(' / '),
      streaming_colombia: broadcasters.streaming.join(' / '),
      // Eliminamos venue para evitar que el bot repita el estadio
      venue: undefined
    },
    // Sólo incluir goleadores si el partido ya finalizó y hay datos disponibles
    goleadores: isFinished ? goleadores : undefined,
    goalScorers: undefined
  };
}
