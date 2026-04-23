function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function renderResultMetric(metric) {
  return `
    <article class="result-intel-card">
      <span>${metric.label}</span>
      <strong>${metric.value}</strong>
      <p>${metric.detail}</p>
    </article>
  `;
}

export function renderResultScene(viewModel, { feedbackUrl = null } = {}) {
  return `
    <section class="scene scene-result scene-result-${viewModel.winnerTone}">
      <header class="scene-brand-bar scene-brand-bar-result">
        <span>AI COMMANDER ARENA</span>
        <strong>RESULT</strong>
      </header>
      <div class="result-podium result-hero-card">
        <div class="result-summary-stack">
          <div class="result-emblem result-emblem-${viewModel.winnerTone}" aria-hidden="true"></div>
          <p class="scene-kicker">${viewModel.resultKicker}</p>
          <span class="result-outcome-chip">${viewModel.outcomeBadge}</span>
          <h1>${viewModel.winnerLabel}</h1>
          <p class="result-reason">${viewModel.winReasonLabel}</p>
          <p class="result-swing">关键转折：${viewModel.swingObjectiveLabel}</p>
          ${viewModel.doctrineLabel ? `<p class="result-doctrine-line">本局蓝方手册：${viewModel.doctrineLabel}</p>` : ''}
          ${viewModel.resultMetrics?.length ? `
            <div class="result-intel-grid">
              ${viewModel.resultMetrics.map((metric) => renderResultMetric(metric)).join('')}
            </div>
          ` : ''}
          <p class="result-followup">${viewModel.followupHint}</p>
          <div class="result-standouts">
            ${(viewModel.styleStandouts ?? []).map((item) => `<span>${item}</span>`).join('')}
          </div>
        </div>
        <div class="scene-actions result-action-row">
          <button type="button" class="scene-button scene-button-hero" data-action="play-again">再来一局</button>
          <button type="button" class="scene-button scene-button-primary" data-action="review-key-moment">回看关键转折</button>
          <button type="button" class="scene-button scene-button-secondary is-secondary" data-action="back-home">返回主界面</button>
          ${feedbackUrl ? `
            <a
              class="scene-button scene-button-secondary is-secondary"
              href="${escapeAttribute(feedbackUrl)}"
              target="_blank"
              rel="noreferrer"
            >提交本局反馈</a>
          ` : ''}
        </div>
      </div>
    </section>
  `;
}
