function renderRoster(teamLabel, roster, tone) {
  return `
    <div class="prep-roster ${tone}">
      <h3>${teamLabel}</h3>
      ${roster.map((commander) => `
        <article class="identity-card ${tone}">
          <strong>${commander.displayName ?? commander.name}</strong>
          <span>${commander.styleLabel}</span>
        </article>
      `).join('')}
      <p class="prep-roster-ready">${teamLabel} READY</p>
    </div>
  `;
}

export function renderPrepScene(viewModel) {
  return `
    <section class="scene scene-prep">
      <header class="scene-brand-bar scene-brand-bar-prep">
        <span>AI COMMANDER ARENA</span>
        <strong>${viewModel.title}</strong>
      </header>
      <div class="scene-prep-topline">
        <button type="button" data-action="back-home" class="is-secondary">返回主界面</button>
        <label class="scene-select-field">
          <span>对局包</span>
          <select id="preset-select">
            ${(viewModel.presetOptions ?? [])
              .map(
                (option) =>
                  `<option value="${option.value}"${option.value === viewModel.currentPreset ? ' selected' : ''}>${option.label}</option>`
              )
              .join('')}
          </select>
        </label>
      </div>
      <div class="scene-prep-versus">
        ${renderRoster('BLUE TEAM', viewModel.blueRoster ?? [], 'blue')}
        <div class="scene-prep-vs-core">
          <span class="vs-mark">VS</span>
          <p class="watch-focus">${viewModel.watchFocus}</p>
          ${viewModel.stakes ? `<p class="stakes-copy">${viewModel.stakes}</p>` : ''}
        </div>
        ${renderRoster('RED TEAM', viewModel.redRoster ?? [], 'red')}
      </div>
      <div class="scene-prep-footer">
        <button type="button" data-action="start-match">开始对局</button>
      </div>
    </section>
  `;
}
