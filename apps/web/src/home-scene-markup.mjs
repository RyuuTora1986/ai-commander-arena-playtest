function renderPackCard(title, index) {
  return `
    <article class="pack-card" data-pack-index="${index + 1}">
      <span class="pack-card-kicker">对局包 0${index + 1}</span>
      <strong class="pack-card-title">${title}</strong>
      <span class="pack-card-copy">风格对抗 · 赛前看点已封装</span>
    </article>
  `;
}

export function renderHomeScene({
  featuredPresetTitle,
  presetTitles = []
}) {
  const titles = presetTitles.length > 0 ? presetTitles : [featuredPresetTitle].filter(Boolean);

  return `
    <section class="scene scene-home">
      <header class="scene-brand-bar">
        <span>AI COMMANDER</span>
        <strong>ARENA</strong>
      </header>
      <div class="scene-home-stage">
        <section class="featured-match-card">
          <p class="scene-kicker">主界面</p>
          <h1>观战本周主赛事</h1>
          <div class="featured-match-art">
            <div class="featured-match-copy">
              <span class="featured-match-badge">推荐对局</span>
              <strong>${featuredPresetTitle}</strong>
              <span>直播战术对抗进行中</span>
            </div>
          </div>
          <div class="scene-actions featured-match-actions">
            <button type="button" data-action="go-prep">开始观战</button>
            <button type="button" data-action="open-help" class="is-secondary">玩法说明</button>
          </div>
        </section>
      </div>
      <div class="scene-home-packs">
        ${titles.map(renderPackCard).join('')}
      </div>
    </section>
  `;
}
