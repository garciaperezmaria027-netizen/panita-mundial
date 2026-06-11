import * as dotenv from 'dotenv';
import { sportsService } from '../services/sports';
import { logger } from '../utils/logger';

dotenv.config();

async function runTest() {
  logger.info('🧪 [Test Deportes] Iniciando pruebas del servicio de datos deportivos...');
  
  const provider = process.env.SPORTS_PROVIDER || 'api-football';
  if (provider !== 'free-2026' && !process.env.API_FOOTBALL_KEY) {
    logger.error('❌ API_FOOTBALL_KEY no está configurada en el archivo .env y es requerida para el proveedor api-football. Finalizando prueba.');
    return;
  }

  try {
    // 1. Obtener partidos de hoy
    logger.info('--- Probando getMatchesToday() ---');
    const todayMatches = await sportsService.getMatchesToday();
    logger.info(`Se obtuvieron ${todayMatches.length} partidos para hoy.`);
    if (todayMatches.length > 0) {
      logger.info('Primer partido obtenido:', {
        home: todayMatches[0].teams.home.name,
        away: todayMatches[0].teams.away.name,
        status: todayMatches[0].fixture.status.long
      });
    }

    // 2. Obtener clasificación
    logger.info('--- Probando getGroupStandings() ---');
    const standings = await sportsService.getGroupStandings();
    logger.info(`Se obtuvieron ${standings.length} grupos.`);
    if (standings.length > 0) {
      logger.info(`Primer grupo: ${standings[0].groupName}`);
      logger.info(`Líder del grupo 1: ${standings[0].standings[0]?.team.name || 'N/A'}`);
    }

    // 3. Obtener goleadores
    logger.info('--- Probando getTopScorers() ---');
    const scorers = await sportsService.getTopScorers();
    logger.info(`Se obtuvieron ${scorers.length} goleadores.`);
    if (scorers.length > 0) {
      logger.info(`Líder de goleo: ${scorers[0].player.name} (${scorers[0].goals} goles)`);
    }

    // 4. Buscar un equipo y obtener estadísticas
    logger.info('--- Probando getTeamStats("Argentina") ---');
    const teamStats = await sportsService.getTeamStats('Argentina');
    if (teamStats) {
      logger.info('Estadísticas de Argentina encontradas:', {
        nombre: teamStats.team.name,
        jugados: teamStats.fixtures.played.total,
        goles_a_favor: teamStats.goals.for.total.total
      });
    } else {
      logger.warn('No se encontraron estadísticas para Argentina (puede que no haya datos cargados).');
    }

    logger.info('✅ [Test Deportes] Pruebas finalizadas con éxito.');

  } catch (error) {
    logger.error('❌ [Test Deportes] Error en las pruebas:', error);
  }
}

runTest();
