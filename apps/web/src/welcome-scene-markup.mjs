function renderPlaytestMeta({ playtestLabel = null, playtestDuration = null, feedbackUrl = null }) {
  if (!playtestLabel) {
    return '';
  }

  return `
    <div class="welcome-playtest-meta">
      <span class="welcome-playtest-pill">${playtestLabel}</span>
      <p class="welcome-playtest-copy">${playtestDuration ?? ''}</p>
      ${feedbackUrl ? `
        <a
          class="welcome-feedback-link"
          href="${feedbackUrl}"
          target="_blank"
          rel="noreferrer"
        >提交试玩反馈</a>
      ` : ''}
    </div>
  `;
}

export function renderWelcomeScene(options = {}) {
  return `
    <section class="scene scene-welcome">
      <div class="welcome-stage">
        <div class="brand-lockup">
          ${renderPlaytestMeta(options)}
          <div class="brand-wordmark">
            <span class="brand-title-main">AI COMMANDER</span>
            <span class="brand-title-sub">ARENA</span>
          </div>
          <p class="welcome-promise">一场看得懂的 AI 指挥官对抗</p>
          <div class="scene-actions welcome-actions">
            <button type="button" class="scene-button scene-button-hero" data-action="go-home">进入竞技场</button>
          </div>
          <button type="button" data-action="open-help" class="welcome-help-link">查看玩法说明</button>
        </div>
      </div>
    </section>
  `;
}
