import { MATCH_PHASES } from '../../shared-types/src/index.mjs';
import { averagePosition, distance, teamEnemy } from './helpers.mjs';

function getCommanderUnits(state, commanderId) {
  return state.units.filter((unit) => unit.commanderId === commanderId);
}

function getLivingUnits(state, commanderId) {
  return getCommanderUnits(state, commanderId).filter((unit) => unit.alive);
}

function nearestObjectiveLabel(state, position) {
  const candidates = [
    { id: 'mid_river', point: { x: 500, y: 300 } },
    { id: 'top_lane', point: { x: 500, y: 120 } },
    { id: 'bot_lane', point: { x: 500, y: 480 } },
    { id: 'home_base', point: state.structures.blueCore.position },
    { id: 'enemy_base', point: state.structures.redCore.position }
  ];

  let closest = candidates[0];
  let bestDistance = distance(position, candidates[0].point);

  for (const candidate of candidates.slice(1)) {
    const currentDistance = distance(position, candidate.point);
    if (currentDistance < bestDistance) {
      bestDistance = currentDistance;
      closest = candidate;
    }
  }

  return closest.id;
}

function buildAllowedIntents(state, commander, visibleEnemies) {
  const allowed = ['hold_lane', 'push_lane', 'retreat_reset', 'protect_carry'];
  const primeSoon = state.objectives.primeRelay.nextSpawnMs - state.clock.elapsedMs <= 20000;
  const primeActive = state.objectives.primeRelay.active;

  if (visibleEnemies.length > 0) {
    allowed.push('collapse_target');
  }

  if (primeSoon || primeActive) {
    allowed.push('contest_prime_relay');
  }

  if (state.phase !== 'opening') {
    allowed.push('split_push');
  }

  const enemyTeam = teamEnemy(commander.teamId);
  if (state.structures[`${commander.teamId}Core`].hp / state.structures[`${commander.teamId}Core`].maxHp < 0.7) {
    allowed.push('defend_core');
  }

  if (state.score[commander.teamId] + 2 < state.score[enemyTeam]) {
    allowed.push('split_push');
  }

  return [...new Set(allowed)];
}

function buildPathOptions(commander) {
  const preferred = commander.preferredLane === 'top'
    ? ['hold_top', 'top_lane_pressure', 'rotate_mid_to_top']
    : commander.preferredLane === 'bot'
      ? ['hold_bot', 'bot_lane_pressure', 'rotate_mid_to_bot']
      : ['hold_mid', 'collapse_mid', 'top_lane_pressure', 'bot_lane_pressure', 'rotate_mid_to_top', 'rotate_mid_to_bot'];

  return [...new Set([...preferred, 'retreat_home', 'defend_base', 'collapse_mid', 'hold_mid'])];
}

export function buildBattleSnapshot(state, commander) {
  const units = getCommanderUnits(state, commander.id);
  const livingUnits = units.filter((unit) => unit.alive);
  const enemyTeamId = teamEnemy(commander.teamId);
  const allyCommanders = state.commanders.filter(
    (candidate) => candidate.teamId === commander.teamId && candidate.id !== commander.id
  );
  const enemyCommanders = state.commanders.filter((candidate) => candidate.teamId === enemyTeamId);
  const selfPosition = livingUnits.length > 0
    ? averagePosition(livingUnits.map((unit) => unit.position))
    : state.spawnAnchors[commander.id];
  const visibleEnemyDetails = enemyCommanders
    .map((enemyCommander) => {
      const enemyUnits = getLivingUnits(state, enemyCommander.id);
      if (enemyUnits.length === 0) {
        return null;
      }

      const enemyCenter = averagePosition(enemyUnits.map((unit) => unit.position));
      const visibilityRange = Math.min(...livingUnits.map((unit) => distance(unit.position, enemyCenter)));
      if (livingUnits.length === 0 || visibilityRange > state.rules.unitVisionRange) {
        return null;
      }

      const hpRatio =
        enemyUnits.reduce((total, unit) => total + unit.hp / unit.maxHp, 0) / enemyUnits.length;

      return {
        id: enemyCommander.id,
        hp_ratio: Number(hpRatio.toFixed(2)),
        position_zone: nearestObjectiveLabel(state, enemyCenter)
      };
    })
    .filter(Boolean);
  const nearbyAllies = allyCommanders
    .filter((ally) => {
      const allyUnits = getLivingUnits(state, ally.id);
      if (allyUnits.length === 0) {
        return false;
      }

      const allyCenter = averagePosition(allyUnits.map((unit) => unit.position));
      return distance(selfPosition, allyCenter) <= 220;
    })
    .map((ally) => ally.id);
  const visibleEnemies = visibleEnemyDetails.map((enemy) => enemy.id);
  const threats = [];

  if (visibleEnemyDetails.some((enemy) => enemy.hp_ratio < 0.45)) {
    threats.push('enemy_low_hp');
  }

  const nearbyEnemyCount = visibleEnemyDetails.length;
  const nearbyAllyCount = nearbyAllies.length + 1;
  if (nearbyEnemyCount > nearbyAllyCount) {
    threats.push('numbers_disadvantage');
  } else if (nearbyEnemyCount > 0 && nearbyAllyCount >= nearbyEnemyCount) {
    threats.push('numbers_advantage');
  }

  const ownCore = state.structures[`${commander.teamId}Core`];
  if (ownCore.hp / ownCore.maxHp < 0.7) {
    threats.push('core_under_threat');
  }

  const hpRatio = livingUnits.length > 0
    ? livingUnits.reduce((total, unit) => total + unit.hp / unit.maxHp, 0) / livingUnits.length
    : 0;

  const phaseIndex = MATCH_PHASES.indexOf(state.phase);

  return {
    match_time_sec: Math.floor(state.clock.elapsedMs / 1000),
    phase: MATCH_PHASES[Math.max(0, phaseIndex)],
    team_score_delta: state.score[commander.teamId] - state.score[enemyTeamId],
    self: {
      commander_id: commander.id,
      hp_ratio: Number(hpRatio.toFixed(2)),
      ult_ready_units: units.filter((unit) => unit.alive && unit.abilityCooldownMs <= 0).length,
      position_zone: nearestObjectiveLabel(state, selfPosition),
      nearby_allies: nearbyAllies,
      visible_enemies: visibleEnemies
    },
    objectives: {
      prime_relay_spawn_in: Math.max(0, Math.ceil((state.objectives.primeRelay.nextSpawnMs - state.clock.elapsedMs) / 1000)),
      prime_relay_active: state.objectives.primeRelay.active,
      top_beacon_owner: state.objectives.topBeacon.owner,
      bot_beacon_owner: state.objectives.botBeacon.owner
    },
    threats,
    visible_enemy_details: visibleEnemyDetails,
    previous_order: commander.currentOrder?.intent ?? 'hold_lane',
    allowed_intents: buildAllowedIntents(state, commander, visibleEnemies),
    path_options: buildPathOptions(commander)
  };
}
