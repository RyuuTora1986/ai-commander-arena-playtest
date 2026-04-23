function renderSeatPlate(commander, tone, index) {
  const portrait = commander.portraitAsset
    ? `<img class="identity-seat-avatar" src="${commander.portraitAsset}" alt="${commander.displayName ?? commander.name}">`
    : '';

  return `
    <article class="identity-seat-plate ${tone}">
      <div class="identity-seat-avatar-wrap">${portrait}</div>
      <span class="identity-seat-index">${String(index + 1).padStart(2, '0')}</span>
      <strong>${commander.displayName ?? commander.name}</strong>
      <span>${commander.styleLabel}</span>
    </article>
  `;
}

function renderRoster(teamLabel, roster, tone) {
  return `
    <section class="prep-stage prep-stage-${tone}">
      <div class="prep-stage-header">
        <span class="prep-stage-kicker">阵营席位</span>
        <h3>${teamLabel}</h3>
      </div>
      <div class="prep-stage-seat-list">
        ${roster.map((commander, index) => renderSeatPlate(commander, tone, index)).join('')}
      </div>
    </section>
  `;
}

function renderDoctrineOption(option, selectedDoctrineId) {
  const selectedClass = option.id === selectedDoctrineId ? ' is-selected' : '';
  const selectedState = option.id === selectedDoctrineId
    ? '<span class="prep-doctrine-button-state">已选</span>'
    : '';
  return `
    <button
      type="button"
      class="scene-button scene-button-secondary prep-doctrine-button${selectedClass}"
      data-action="select-doctrine"
      data-doctrine-value="${option.id}"
    >
      <span class="prep-doctrine-button-head">
        <span class="prep-doctrine-button-label">${option.label}</span>
        ${selectedState}
      </span>
      <span class="prep-doctrine-button-summary">${option.summary}</span>
    </button>
  `;
}

function renderDoctrineIntelItem(item) {
  return `
    <article class="prep-doctrine-intel-card">
      <span>${item.label}</span>
      <p>${item.value}</p>
    </article>
  `;
}

export function renderPrepScene(viewModel) {
  const doctrineIntelItems =
    Array.isArray(viewModel.doctrineIntelItems) && viewModel.doctrineIntelItems.length > 0
      ? viewModel.doctrineIntelItems
      : [
          {
            label: '开局意图',
            value: viewModel.selectedDoctrineSummary || '这会改变蓝方的开局路线与 Prime 争夺方式。'
          },
          {
            label: '观战重点',
            value: '赛中会持续追踪这份手册，赛后结算也会解释它怎样影响了本局节奏。'
          }
        ];

  return `
    <section class="scene scene-prep">
      <header class="scene-brand-bar scene-brand-bar-prep">
        <span>AI COMMANDER ARENA</span>
        <strong>${viewModel.title}</strong>
      </header>
      <div class="scene-prep-topline">
        <button type="button" class="scene-button scene-button-secondary is-secondary" data-action="back-home">返回主界面</button>
      </div>
      <section class="prep-doctrine-deck" aria-label="战术手册选择">
        <div class="prep-doctrine-layout">
          <div class="prep-doctrine-copy">
            <p class="scene-kicker">蓝方战术手册</p>
            <strong>${viewModel.selectedDoctrineLabel}</strong>
            <p>${viewModel.selectedDoctrineSummary}</p>
            <p class="prep-doctrine-note">这会直接改变蓝方的开局路线、风险偏好和 Prime 争夺方式。</p>
            <div class="prep-doctrine-intel-grid">
              ${doctrineIntelItems.map((item) => renderDoctrineIntelItem(item)).join('')}
            </div>
          </div>
          <div class="prep-doctrine-choice-panel">
            <div class="prep-doctrine-choice-header">
              <span class="prep-doctrine-choice-kicker">选择开局打法</span>
              <p class="prep-doctrine-choice-copy">赛中会持续追踪这份手册，赛后结算也会解释它怎样影响了本局节奏。</p>
            </div>
            <div class="prep-doctrine-grid">
              ${(viewModel.doctrineOptions ?? []).map((option) => renderDoctrineOption(option, viewModel.selectedDoctrineId)).join('')}
            </div>
          </div>
        </div>
      </section>
      <div class="scene-prep-versus scene-prep-arena">
        ${renderRoster('蓝方', viewModel.blueRoster ?? [], 'blue')}
        <section class="prep-stage prep-stage-versus scene-prep-vs-core">
          <span class="vs-mark">VS</span>
          <p class="prep-stage-rules">${viewModel.ruleLine}</p>
        </section>
        ${renderRoster('红方', viewModel.redRoster ?? [], 'red')}
      </div>
      <div class="scene-prep-footer">
        <button type="button" class="scene-button scene-button-hero" data-action="start-match">开始对局</button>
      </div>
    </section>
  `;
}
