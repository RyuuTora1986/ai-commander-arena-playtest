function renderPackCard(preset, index, currentPreset) {
  const selectedClass = preset.value === currentPreset ? ' is-selected' : '';
  return `
    <button
      type="button"
      class="pack-card${selectedClass}"
      data-pack-index="${index + 1}"
      data-action="select-preset"
      data-preset-value="${preset.value}"
      aria-pressed="${preset.value === currentPreset ? 'true' : 'false'}"
    >
      <span class="pack-card-kicker">对局包 0${index + 1}</span>
      <strong class="pack-card-title">${preset.title}</strong>
      <span class="pack-card-copy">${preset.summary}</span>
    </button>
  `;
}

export function renderHomeScene({
  featuredPresetTitle,
  featuredPresetSummary = '',
  currentPreset = 'default',
  presetCards = []
}) {
  const cards = presetCards.length > 0
    ? presetCards
    : [{ value: currentPreset, title: featuredPresetTitle, summary: featuredPresetSummary }];

  return `
    <section class="scene scene-home">
      <header class="scene-brand-bar">
        <span>AI COMMANDER</span>
        <strong>ARENA</strong>
      </header>
      <div class="scene-home-stage">
        <section class="featured-match-card">
          <div class="featured-match-art">
            <div class="featured-match-copy">
              <span class="scene-kicker">本轮主赛事</span>
              <strong>${featuredPresetTitle}</strong>
              <span>${featuredPresetSummary}</span>
            </div>
          </div>
          <div class="scene-home-packs">
            ${cards.map((preset, index) => renderPackCard(preset, index, currentPreset)).join('')}
          </div>
          <div class="scene-actions featured-match-actions">
            <button type="button" class="scene-button scene-button-primary" data-action="go-prep">进入对局</button>
            <button type="button" class="scene-button scene-button-secondary is-secondary" data-action="open-help">玩法说明</button>
          </div>
        </section>
      </div>
    </section>
  `;
}