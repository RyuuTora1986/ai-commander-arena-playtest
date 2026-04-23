function escapeHtml(value) {
  const source = value == null ? '' : String(value);
  return source
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderSeatCard(seat, isFreshOrder) {
  const freshClass = isFreshOrder ? ' is-fresh-order' : '';
  const sideClass = seat.teamId === 'red' ? 'red' : 'blue';
  const payoffChip = seat.payoffChipLabel
    ? `<span class="identity-chip ${sideClass}">${escapeHtml(seat.payoffChipLabel)}</span>`
    : '';
  const avatar = seat.portraitAsset
    ? `<div class="seat-card-avatar-wrap"><img class="seat-card-avatar" src="${escapeHtml(seat.portraitAsset)}" alt="${escapeHtml(seat.displayName)}"></div>`
    : '';

  return `
    <article class="seat-card ${sideClass}${freshClass}">
      ${avatar}
      <div class="seat-card-body">
        <div class="seat-card-head">
          <h3>${escapeHtml(seat.displayName)}</h3>
          <p class="seat-style">${escapeHtml(seat.styleLabel)}</p>
        </div>
        <p class="seat-line">
          <strong class="seat-task">${escapeHtml(seat.missionLabel)}</strong>
          <span class="seat-divider">/</span>
          <span class="seat-stance">${escapeHtml(seat.stanceLabel)}</span>
        </p>
        ${payoffChip}
      </div>
    </article>
  `;
}

export function renderCommanderSeatCards(seatModels, highlightMap = new Map()) {
  const renderTeam = (teamId) =>
    (seatModels?.[teamId] ?? [])
      .map((seat) => renderSeatCard(seat, Boolean(highlightMap.get(seat.id))))
      .join('');

  return {
    blueHtml: renderTeam('blue'),
    redHtml: renderTeam('red')
  };
}

export function renderArenaPresentationCard(presentation) {
  if (!presentation) {
    return '';
  }

  const toneClass = presentation.tone ? ` tone-${escapeHtml(presentation.tone)}` : '';
  const modeClass = presentation.mode ? ` mode-${escapeHtml(presentation.mode)}` : '';
  const layerClass = presentation.mode === 'settle'
    ? 'arena-presentation-layer is-settle'
    : 'arena-presentation-layer';

  return `
    <div class="${layerClass}" aria-live="polite" aria-atomic="true">
      <article class="arena-presentation-card${toneClass}${modeClass}" role="status">
        <p class="arena-presentation-badge">${escapeHtml(presentation.badge ?? '战局提示')}</p>
        <h2 class="arena-presentation-title">${escapeHtml(presentation.title ?? '战局推进中')}</h2>
        <p class="arena-presentation-detail">${escapeHtml(presentation.detail ?? '')}</p>
      </article>
    </div>
  `;
}

export function renderPlayerHudShell({
  headlineHtml = '',
  leadSummaryHtml = '',
  objectiveWindowHtml = '',
  blueSeatsHtml = '',
  redSeatsHtml = '',
  blueScore = '0',
  redScore = '0',
  matchTime = '00:00 / 06:00',
  phase = 'opening',
  arenaOverlayHtml = '',
  arenaBroadcastHtml = '',
  controlStripHtml = '',
  countdownHtml = '',
  presentationHtml = ''
}) {
  return `
    <section class="player-hud-shell">
      <div class="player-match-bar score-broadcast-bar">
        <div class="team-score blue">
          <span class="team-label">蓝方</span>
          <strong>${escapeHtml(blueScore)}</strong>
        </div>
        <div class="match-core-meta">
          <div class="match-time">${escapeHtml(matchTime)}</div>
          <div class="phase-pill">${escapeHtml(phase)}</div>
          <div class="headline-stack">
            ${headlineHtml}
            ${leadSummaryHtml}
          </div>
        </div>
        <div class="team-score red">
          <span class="team-label">红方</span>
          <strong>${escapeHtml(redScore)}</strong>
        </div>
      </div>
      ${objectiveWindowHtml ? `<div class="player-secondary-band">${objectiveWindowHtml}</div>` : ''}
      <div class="player-stage-grid match-stage-grid">
        <aside class="seat-column tactical-seat-column blue">${blueSeatsHtml}</aside>
        <section class="arena-shell arena-stage-shell">
          <div class="broadcast-slot">${arenaBroadcastHtml || headlineHtml}</div>
          ${arenaOverlayHtml}
          ${presentationHtml}
          <div class="arena-board-art" aria-hidden="true"></div>
          <svg id="arena-svg" viewBox="0 0 1000 600" aria-label="战斗地图"></svg>
          ${countdownHtml}
        </section>
        <aside class="seat-column tactical-seat-column red">${redSeatsHtml}</aside>
      </div>
      <div class="control-strip control-utility-rail">${controlStripHtml}</div>
    </section>
  `;
}

function formatWinnerLabel(winner) {
  if (winner === 'blue') {
    return '蓝方获胜';
  }
  if (winner === 'red') {
    return '红方获胜';
  }
  return '未结束';
}

function renderCommanderReportRows(commanders = []) {
  return commanders
    .map(
      (commander) => `
        <div class="report-row">
          <div class="report-row-name">
            <strong>${escapeHtml(commander.name)}</strong>
            <span>${escapeHtml(commander.id)} / ${escapeHtml(commander.brainType)}</span>
          </div>
          <div class="report-metric"><span>命令</span><strong>${escapeHtml(commander.commandCount)}</strong></div>
          <div class="report-metric"><span>fallback</span><strong>${escapeHtml(commander.fallbackCount)}</strong></div>
          <div class="report-metric"><span>击倒</span><strong>${escapeHtml(commander.eliminations)}</strong></div>
          <div class="report-metric"><span>阵亡</span><strong>${escapeHtml(commander.deaths)}</strong></div>
        </div>
      `
    )
    .join('');
}

function renderEventRows(eventLog = []) {
  return eventLog
    .map((event) => `<li>${escapeHtml(event.text ?? event.type ?? 'event')}</li>`)
    .join('');
}

export function renderDevPanel(model) {
  const openAttr = model?.defaultOpen ? ' open' : '';

  return `
    <details class="dev-panel"${openAttr}>
      <summary>开发面板</summary>
      <div class="dev-panel-grid">
        <article class="event-panel">
          <div class="panel-heading">
            <h2>事件日志</h2>
            <span>供回放与调试查看</span>
          </div>
          <ol id="event-log">${renderEventRows(model?.eventLog)}</ol>
        </article>
        <article class="status-panel">
          <div class="panel-heading">
            <h2>回放与战报</h2>
            <span>${escapeHtml(model?.replayModeLabel ?? 'Live')}</span>
          </div>
          <div class="status-grid">
            <div class="status-card">
              <span>蓝方核心</span>
              <strong>${escapeHtml(model?.structures?.blueCore?.hp ?? 0)} / ${escapeHtml(model?.structures?.blueCore?.maxHp ?? 0)}</strong>
            </div>
            <div class="status-card">
              <span>红方核心</span>
              <strong>${escapeHtml(model?.structures?.redCore?.hp ?? 0)} / ${escapeHtml(model?.structures?.redCore?.maxHp ?? 0)}</strong>
            </div>
            <div class="status-card">
              <span>当前赢家</span>
              <strong>${escapeHtml(formatWinnerLabel(model?.structures?.winner ?? null))}</strong>
            </div>
            <div class="status-card">
              <span>平均延迟</span>
              <strong>${escapeHtml(model?.viewMetrics?.averageLatencyMs ?? 0)}ms</strong>
            </div>
          </div>
          <div class="replay-block">
            <div class="replay-meta">
              <strong>${escapeHtml(model?.replayModeLabel ?? 'Live')}</strong>
              <span id="replay-frame-label">${escapeHtml(model?.replayFrameLabel ?? 'Frame 0 / 0')}</span>
            </div>
            <input
              id="replay-slider"
              type="range"
              min="0"
              max="${escapeHtml(model?.replayFrameMax ?? 0)}"
              value="${escapeHtml(model?.replayFrameValue ?? 0)}"
            />
          </div>
          <div class="report-grid">
            <div class="report-card"><span>总命令数</span><strong>${escapeHtml(model?.totals?.totalCommands ?? 0)}</strong></div>
            <div class="report-card"><span>总击倒数</span><strong>${escapeHtml(model?.totals?.totalEliminations ?? 0)}</strong></div>
            <div class="report-card"><span>蓝方控图</span><strong>${escapeHtml(model?.totals?.blueObjectives ?? 0)}</strong></div>
            <div class="report-card"><span>红方控图</span><strong>${escapeHtml(model?.totals?.redObjectives ?? 0)}</strong></div>
          </div>
          <div class="report-list-wrap">
            <div class="panel-heading compact">
              <h2>指挥官战报</h2>
              <span>命令 / fallback / 击倒 / 阵亡</span>
            </div>
            <div id="report-commanders" class="report-list">${renderCommanderReportRows(model?.commanders)}</div>
          </div>
        </article>
      </div>
    </details>
  `;
}
