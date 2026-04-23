function escapeHtml(value) {
  const source = value == null ? '' : String(value);
  return source
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderCommanderChips(commanders = [], teamTone) {
  return commanders
    .map(
      (commander) => `
        <li class="versus-chip ${teamTone}">
          <strong>${escapeHtml(commander.name)}</strong>
          <span>${escapeHtml(commander.styleLabel ?? '')}</span>
        </li>
      `
    )
    .join('');
}

export function renderMatchupPreviewCard(preview) {
  if (!preview) {
    return '';
  }

  return `
    <article class="matchup-preview-card">
      <div class="matchup-preview-copy">
        <p class="matchup-preview-eyebrow">本局看点</p>
        <h2>${escapeHtml(preview.title)}</h2>
        <p class="matchup-preview-summary">${escapeHtml(preview.summary)}</p>
      </div>
      <div class="matchup-preview-versus">
        <section class="versus-side blue">
          <p class="versus-label">蓝方阵容</p>
          <ul>${renderCommanderChips(preview.blueCommanders, 'blue')}</ul>
        </section>
        <div class="versus-core">
          <span>VS</span>
          <p>${escapeHtml(preview.watchFocus)}</p>
        </div>
        <section class="versus-side red">
          <p class="versus-label">红方阵容</p>
          <ul>${renderCommanderChips(preview.redCommanders, 'red')}</ul>
        </section>
      </div>
    </article>
  `;
}

export function renderCommanderPayoffChip(payoff) {
  if (!payoff) {
    return '';
  }

  return `<span class="identity-chip ${escapeHtml(payoff.tone ?? 'neutral')}">${escapeHtml(payoff.label)}</span>`;
}

export function renderObjectiveWindowHint(hint) {
  if (!hint) {
    return '';
  }

  return `
    <article class="objective-window-card ${escapeHtml(hint.tone ?? 'neutral')}">
      <p class="objective-window-eyebrow">关键窗口</p>
      <strong>${escapeHtml(hint.title)}</strong>
      <p>${escapeHtml(hint.detail)}</p>
    </article>
  `;
}

export function renderIdentitySummaryCard(summary) {
  if (!summary) {
    return '';
  }

  const standoutHtml = (summary.styleStandouts ?? [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');

  return `
    <article class="identity-summary-card">
      <p class="identity-summary-eyebrow">本局总结</p>
      <h3>${escapeHtml(summary.title)}</h3>
      <p class="identity-summary-detail">${escapeHtml(summary.detail)}</p>
      <ul class="identity-summary-standouts">${standoutHtml}</ul>
    </article>
  `;
}
