import { renderCommanderPayoffChip } from './commander-identity-markup.mjs';

function escapeHtml(value) {
  const source = value == null ? '' : String(value);
  return source
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function teamClass(teamId) {
  if (teamId === 'blue' || teamId === 'red') {
    return teamId;
  }
  return 'neutral';
}

function teamLabel(teamId) {
  return teamId === 'red' ? '红方' : '蓝方';
}

function renderRationaleTags(tags = [], fallbackUsed = false) {
  const rendered = tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`);
  if (fallbackUsed) {
    rendered.push('<span class="tag fallback">fallback</span>');
  }
  return rendered.join('');
}

export function renderBroadcastHeadline(headline) {
  if (!headline) {
    return `
      <article class="broadcast-banner tone-idle impact-low is-idle" data-headline-key="idle">
        <p class="broadcast-kicker">观战播报</p>
        <h2 class="broadcast-title">战局推进中，等待新的关键信号</h2>
      </article>
    `;
  }

  const toneClass = `tone-${escapeHtml(headline.tone ?? 'status')}`;
  const impactClass = `impact-${escapeHtml(headline.impact ?? 'low')}`;
  const kicker = headline.kicker
    ? `<p class="broadcast-kicker">${escapeHtml(headline.kicker)}</p>`
    : '<p class="broadcast-kicker">观战播报</p>';

  return `
    <article class="broadcast-banner ${toneClass} ${impactClass}" data-headline-key="${escapeHtml(headline.key)}">
      ${kicker}
      <h2 class="broadcast-title">${escapeHtml(headline.title ?? '战局推进中')}</h2>
    </article>
  `;
}

export function renderLeadSummaryCard(summary) {
  if (!summary) {
    return '';
  }

  const leaderLabel = summary.leadingTeam ? teamLabel(summary.leadingTeam) : '均势';
  const leadClass = summary.leadingTeam ? teamClass(summary.leadingTeam) : 'neutral';

  return `
    <article class="lead-summary-card ${leadClass}">
      <div class="lead-summary-main">
        <span>当前领跑</span>
        <strong>${escapeHtml(leaderLabel)}</strong>
      </div>
      <div class="lead-summary-main">
        <span>分差</span>
        <strong>${escapeHtml((summary.scoreDiff ?? 0).toFixed?.(1) ?? summary.scoreDiff ?? '0')}</strong>
      </div>
      <div class="lead-summary-main">
        <span>优势来源</span>
        <strong>${escapeHtml(summary.primaryCause ?? '均势')}</strong>
      </div>
      <p class="lead-summary-text">${escapeHtml(summary.text ?? '')}</p>
      <p class="lead-summary-detail">${escapeHtml(summary.detail ?? '')}</p>
    </article>
  `;
}

export function renderCommanderCards(
  commanders = [],
  highlightMap = new Map(),
  identityPayoffMap = new Map()
) {
  const renderByTeam = (teamId) =>
    commanders
      .filter((commander) => commander.teamId === teamId)
      .map((commander) => {
        const isFreshOrder = Boolean(highlightMap.get(commander.id));
        const freshClass = isFreshOrder ? ' is-fresh-order' : '';
        const sideClass = teamClass(commander.teamId);
        const payoffChip = renderCommanderPayoffChip(identityPayoffMap.get(commander.id));
        const styleLabel = commander.styleLabel
          ? `<p class="commander-style">${escapeHtml(commander.styleLabel)}</p>`
          : '';
        return `
          <article class="commander-card ${sideClass}${freshClass}">
            <h3>${escapeHtml(commander.name)}</h3>
            <div class="commander-meta">
              <span>${escapeHtml(commander.brainType)} / ${escapeHtml(commander.persona)}</span>
              <strong>${escapeHtml(commander.orderSource)}</strong>
            </div>
            ${styleLabel}
            ${payoffChip}
            <div class="commander-order">
              <span>当前意图</span>
              <strong>${escapeHtml(commander.intent)}</strong>
            </div>
            <div class="commander-order">
              <span>风险级别</span>
              <strong>${escapeHtml(commander.riskLevel)}</strong>
            </div>
            <div class="commander-tags">
              ${renderRationaleTags(commander.rationaleTags, commander.fallbackUsed)}
            </div>
          </article>
        `;
      })
      .join('');

  return {
    blueHtml: renderByTeam('blue'),
    redHtml: renderByTeam('red')
  };
}
