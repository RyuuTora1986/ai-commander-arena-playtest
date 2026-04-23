function getLeadingTeam(score = { blue: 0, red: 0 }) {
  if ((score.blue ?? 0) === (score.red ?? 0)) {
    return null;
  }

  return (score.blue ?? 0) > (score.red ?? 0) ? 'blue' : 'red';
}

function getTeamLabel(teamId) {
  return teamId === 'red' ? '红方' : '蓝方';
}

function getObjectiveLabel(objectiveId) {
  if (objectiveId === 'prime-relay' || objectiveId === 'primeRelay') {
    return 'Prime Relay';
  }

  if (objectiveId === 'top-beacon' || objectiveId === 'topBeacon') {
    return '上路信标';
  }

  if (objectiveId === 'bot-beacon' || objectiveId === 'botBeacon') {
    return '下路信标';
  }

  return objectiveId ?? '关键目标';
}

export function buildObjectiveWindowHint(view) {
  const elapsedMs = view?.clock?.elapsedMs ?? 0;
  const prime = view?.objectives?.primeRelay;
  if (!prime) {
    return null;
  }

  if (prime.active) {
    return {
      type: 'prime_window',
      tone: 'alert',
      title: 'Prime 已激活',
      detail: '当前是最容易拉开分差的争夺窗口。'
    };
  }

  const remainingSec = Math.max(0, Math.ceil(((prime.nextSpawnMs ?? 0) - elapsedMs) / 1000));
  if (remainingSec > 20) {
    return null;
  }

  const leader = getLeadingTeam(view?.score);
  const leadText = leader
    ? `${getTeamLabel(leader)}要决定是保分差还是提前占位`
    : '双方都需要为下一波争夺提前站位';

  return {
    type: 'prime_window',
    tone: leader ?? 'neutral',
    title: `Prime ${remainingSec}s 后刷新`,
    detail: `${leadText}，这会直接决定中盘争夺窗口。`
  };
}

export function buildCommanderStylePayoffMap(view) {
  const result = new Map();
  const score = view?.score ?? { blue: 0, red: 0 };

  for (const commander of view?.commanders ?? []) {
    let payoff = null;
    const tags = commander.rationaleTags ?? [];
    const teamLead =
      commander.teamId === 'blue'
        ? (score.blue ?? 0) - (score.red ?? 0)
        : (score.red ?? 0) - (score.blue ?? 0);

    if (
      (commander.persona === 'aggressive' || commander.persona === 'berserker') &&
      commander.intent === 'collapse_target' &&
      tags.includes('enemy_low_hp')
    ) {
      payoff = {
        label: commander.persona === 'berserker' ? '极限搏命兑现' : '高压强开兑现',
        tone: commander.teamId
      };
    } else if (
      commander.persona === 'defensive' &&
      (commander.intent === 'hold_lane' || commander.intent === 'defend_core') &&
      teamLead > 0
    ) {
      payoff = {
        label: '防守反打兑现',
        tone: commander.teamId
      };
    } else if (
      commander.persona === 'macro' &&
      (commander.intent === 'split_push' || commander.intent === 'contest_prime_relay')
    ) {
      payoff = {
        label: '资源运营兑现',
        tone: commander.teamId
      };
    } else if (
      commander.persona === 'trickster' &&
      (commander.intent === 'split_push' || commander.intent === 'collapse_target')
    ) {
      payoff = {
        label: '欺骗埋伏兑现',
        tone: commander.teamId
      };
    } else if (
      commander.persona === 'kite' &&
      (commander.intent === 'hold_lane' || commander.intent === 'split_push')
    ) {
      payoff = {
        label: '拉扯控距兑现',
        tone: commander.teamId
      };
    }

    if (payoff) {
      result.set(commander.id, payoff);
    }
  }

  return result;
}

export function buildPostMatchIdentitySummary(report) {
  const winner = report?.winner ?? 'blue';
  const winPattern = report?.winPattern ?? '控图';
  const swingObjective = getObjectiveLabel(report?.swingObjective);

  return {
    title: `${getTeamLabel(winner)}靠${winPattern}赢下这局`,
    detail: swingObjective ? `关键转折点：${swingObjective}` : '关键转折点：终局处理',
    styleStandouts: Array.isArray(report?.styleStandouts) ? report.styleStandouts : []
  };
}
