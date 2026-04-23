function teamLabel(teamId) {
  return teamId === 'red' ? '红方' : '蓝方';
}

function toneForTeam(teamId) {
  return teamId === 'red' ? 'red' : 'blue';
}

function buildEventKey(event) {
  return [event?.type ?? 'event', Number(event?.tick ?? 0)].join(':');
}

function attackerTeamId(event) {
  if (event?.payload?.attackerId?.startsWith('red-')) {
    return 'red';
  }
  if (event?.payload?.attackerId?.startsWith('blue-')) {
    return 'blue';
  }
  return null;
}

function objectiveLabel(objectiveId) {
  if (objectiveId === 'prime-relay' || objectiveId === 'primeRelay') {
    return 'Prime Relay';
  }
  if (objectiveId === 'top-beacon') {
    return '上路信标';
  }
  if (objectiveId === 'bot-beacon') {
    return '下路信标';
  }
  return '关键据点';
}

function reviewHintForSwingObjective(swingObjectiveLabel) {
  if (swingObjectiveLabel === 'Prime Relay') {
    return '回看 Prime Relay 前后的抱团与站位变化，能最快看懂节奏为什么被改写。';
  }
  if (swingObjectiveLabel === '核心推进') {
    return '回看最后一段核心推进，能直接看到优势是怎么被兑现成胜势的。';
  }
  if (swingObjectiveLabel === '上路信标' || swingObjectiveLabel === '下路信标') {
    return '回看据点争夺前后的线路变化，能更清楚看出分差是怎样滚大的。';
  }
  return '回看关键转折前后的 10 秒，先看局面为什么会突然改势。';
}

function buildEventPresentation(event) {
  if (!event?.type) {
    return null;
  }

  if (event.type === 'prime_relay_activated') {
    return {
      key: buildEventKey(event),
      badge: '关键目标',
      title: 'Prime Relay 已激活',
      detail: '双方会开始围绕中线增益找一波决定性窗口。',
      tone: 'amber',
      mode: 'impact',
      durationMs: 1800
    };
  }

  if (event.type === 'objective_captured') {
    const owner = event.payload?.owner;
    const objectiveId = event.payload?.objectiveId;
    const isPrime = objectiveId === 'prime-relay' || objectiveId === 'primeRelay';

    return {
      key: buildEventKey(event),
      badge: isPrime ? '推进窗口' : '控图转换',
      title: `${teamLabel(owner)}拿下${objectiveLabel(objectiveId)}`,
      detail: isPrime
        ? '这波增益会直接改变线路推进和团战主动权。'
        : '控住据点后，分差和路权会开始继续滚大。',
      tone: owner ? toneForTeam(owner) : 'neutral',
      mode: isPrime ? 'settle' : 'event',
      durationMs: isPrime ? 2200 : 1500
    };
  }

  if (event.type === 'unit_eliminated') {
    const teamId = attackerTeamId(event);
    return {
      key: buildEventKey(event),
      badge: '人数差',
      title: `${teamLabel(teamId)}先打出击倒`,
      detail: '短时人数差通常会立刻转成抱团推进、抢点或逼退。',
      tone: toneForTeam(teamId),
      mode: 'event',
      durationMs: 1200
    };
  }

  if (event.type === 'overclock_started') {
    return {
      key: buildEventKey(event),
      badge: '终局升温',
      title: 'Overclock 阶段开启',
      detail: '复活更慢，核心更脆，任何一次失位都可能直接终结比赛。',
      tone: 'amber',
      mode: 'impact',
      durationMs: 2100
    };
  }

  if (event.type === 'match_ended') {
    const winner = event.payload?.winner === 'red' ? 'red' : 'blue';
    return {
      key: buildEventKey(event),
      badge: '战斗结束',
      title: `${teamLabel(winner)}拿下本局`,
      detail: '胜负已经锁定，结算会马上给出赢法与关键转折。',
      tone: toneForTeam(winner),
      mode: 'settle',
      durationMs: 2600
    };
  }

  return null;
}

export function createMatchPresentationState() {
  return {
    activeCard: null,
    expiresAtMs: 0,
    lastEventKey: null
  };
}

export function resetMatchPresentationState(state) {
  state.activeCard = null;
  state.expiresAtMs = 0;
  state.lastEventKey = null;
}

export function pinMatchPresentation(state, card, nowMs, durationMs = 1600) {
  state.activeCard = card;
  state.expiresAtMs = nowMs + durationMs;
  if (card?.key) {
    state.lastEventKey = card.key;
  }
  return state.activeCard;
}

export function createMatchIntroPresentation() {
  return {
    key: 'match:intro',
    badge: '对抗开始',
    title: '开战',
    detail: '先看比分与头条，再看 Prime 和两侧战术席的意图变化。',
    tone: 'neutral',
    mode: 'event'
  };
}

export function createReplayReviewPresentation(report) {
  return {
    key: 'match:review',
    badge: '关键回看',
    title: `回看${report?.swingObjectiveLabel ?? '关键转折'}`,
    detail: reviewHintForSwingObjective(report?.swingObjectiveLabel ?? ''),
    tone: report?.winnerTone ?? 'neutral',
    mode: 'event'
  };
}

export function createMatchEndPresentation(report) {
  return {
    key: `match:end:${report?.winnerTone ?? 'blue'}`,
    badge: '胜负已定',
    title: report?.winnerLabel ?? '蓝方获胜',
    detail: `${report?.winReasonLabel ?? '以优势取胜'}，关键转折来自${report?.swingObjectiveLabel ?? '终局推进'}。`,
    tone: report?.winnerTone ?? 'blue',
    mode: 'settle'
  };
}

export function advanceMatchPresentationState({
  state,
  view,
  allowEventPlayback = true
}) {
  const nowMs = view?.clock?.elapsedMs ?? 0;

  if (state.activeCard && nowMs < state.expiresAtMs) {
    return state.activeCard;
  }

  if (state.activeCard && nowMs >= state.expiresAtMs) {
    state.activeCard = null;
  }

  if (!allowEventPlayback) {
    return null;
  }

  const nextCard = (view?.recentEvents ?? [])
    .map((event) => buildEventPresentation(event))
    .find(Boolean);

  if (!nextCard || nextCard.key === state.lastEventKey) {
    return null;
  }

  state.lastEventKey = nextCard.key;
  state.activeCard = nextCard;
  state.expiresAtMs = nowMs + (nextCard.durationMs ?? 1500);
  return state.activeCard;
}
