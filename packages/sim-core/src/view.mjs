export function createSpectatorView(state) {
  return {
    matchId: state.matchId,
    phase: state.phase,
    clock: {
      elapsedMs: state.clock.elapsedMs,
      maxMatchMs: state.rules.maxMatchMs
    },
    score: {
      blue: state.score.blue,
      red: state.score.red
    },
    structures: {
      blueCore: {
        hp: state.structures.blueCore.hp,
        maxHp: state.structures.blueCore.maxHp
      },
      redCore: {
        hp: state.structures.redCore.hp,
        maxHp: state.structures.redCore.maxHp
      }
    },
    objectives: {
      topBeacon: {
        owner: state.objectives.topBeacon.owner,
        progressTeam: state.objectives.topBeacon.captureTeam,
        progressRatio: state.objectives.topBeacon.captureProgress / state.objectives.topBeacon.captureMs
      },
      botBeacon: {
        owner: state.objectives.botBeacon.owner,
        progressTeam: state.objectives.botBeacon.captureTeam,
        progressRatio: state.objectives.botBeacon.captureProgress / state.objectives.botBeacon.captureMs
      },
      primeRelay: {
        owner: state.objectives.primeRelay.owner,
        active: state.objectives.primeRelay.active,
        nextSpawnMs: state.objectives.primeRelay.nextSpawnMs,
        progressTeam: state.objectives.primeRelay.captureTeam,
        progressRatio: state.objectives.primeRelay.captureProgress / state.objectives.primeRelay.captureMs
      }
    },
    commanders: state.commanders.map((commander) => ({
      id: commander.id,
      teamId: commander.teamId,
      name: commander.name,
      brainType: commander.brainType,
      persona: commander.persona,
      intent: commander.currentOrder.intent,
      riskLevel: commander.currentOrder.risk_level,
      target: commander.currentOrder.target_entity_id,
      rationaleTags: commander.currentOrder.rationale_tags,
      orderSource: commander.lastOrderMeta?.source ?? commander.brainType,
      fallbackUsed: commander.lastOrderMeta?.fallbackUsed ?? false,
      latencyMs: commander.lastOrderMeta?.latencyMs ?? 0
    })),
    units: state.units.map((unit) => ({
      id: unit.id,
      teamId: unit.teamId,
      commanderId: unit.commanderId,
      role: unit.roleId,
      x: unit.position.x,
      y: unit.position.y,
      hp: unit.hp,
      maxHp: unit.maxHp,
      alive: unit.alive
    })),
    recentEvents: state.replay.events.slice(-12).reverse(),
    winner: state.summary?.winner ?? null
  };
}

export function createReplayFrame(state) {
  return {
    tick: state.clock.tick,
    match_time_sec: Math.floor(state.clock.elapsedMs / 1000),
    ...createSpectatorView(state)
  };
}
