function escapeHtml(value) {
  const source = value == null ? '' : String(value);
  return source
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderHelpOverlay() {
  return `
    <section class="scene-overlay-panel help-overlay" aria-label="玩法说明">
      <header class="scene-overlay-header">
        <div>
          <p class="scene-kicker">玩法说明</p>
          <h2>先看目标，再看风格</h2>
        </div>
        <button type="button" class="overlay-close" data-action="close-overlay">关闭</button>
      </header>
      <div class="scene-overlay-body">
        <article class="overlay-note">
          <h3>你在看什么</h3>
          <p>这是一场 3v3 AI 指挥官对局。先看比分和头条，再看中间战场，最后看两侧战术席。</p>
        </article>
        <article class="overlay-note">
          <h3>关键目标</h3>
          <p><strong>Prime Relay</strong> 是中期最重要的争夺点，拿下它通常意味着推进和节奏转换。</p>
        </article>
        <article class="overlay-note">
          <h3>怎么看胜负</h3>
          <p>先看谁领先，再看领先来自控图、击杀还是核心压力；赛后结算页会给出为什么赢的摘要。</p>
        </article>
      </div>
    </section>
  `;
}

export function renderControlsOverlay({
  devPanelOpen = false,
  audioMuted = false,
  sceneId = 'home',
  matchRunning = false,
  replayMode = 'live',
  speedValue = '1',
  allowDevPanel = true,
  feedbackUrl = null,
  playtestFocusPoints = []
}) {
  const sceneLabel =
    sceneId === 'match'
      ? '观战对局'
      : sceneId === 'prep'
        ? '对局准备'
        : sceneId === 'result'
          ? '赛后结算'
          : sceneId === 'welcome'
            ? '欢迎入口'
            : '主界面';

  return `
    <section class="scene-overlay-panel controls-overlay" aria-label="控制面板">
      <header class="scene-overlay-header">
        <div>
          <p class="scene-kicker">控制面板</p>
          <h2>${escapeHtml(sceneLabel)}</h2>
        </div>
        <button type="button" class="overlay-close" data-action="close-overlay">关闭</button>
      </header>
      <div class="scene-overlay-body">
        <article class="overlay-note">
          <h3>观战控制</h3>
          <div class="overlay-actions overlay-actions-stack">
            ${sceneId === 'match' ? `
              <label class="overlay-select-field">
                <span>播放速度</span>
                <select id="overlay-speed-select">
                  <option value="1"${speedValue === '1' ? ' selected' : ''}>1x</option>
                  <option value="2"${speedValue === '2' ? ' selected' : ''}>2x</option>
                  <option value="4"${speedValue === '4' ? ' selected' : ''}>4x</option>
                  <option value="8"${speedValue === '8' ? ' selected' : ''}>8x</option>
                </select>
              </label>
            ` : ''}
            <div class="overlay-actions">
              ${sceneId === 'match' ? `<button type="button" id="pause-toggle">${matchRunning ? '暂停对局' : '继续对局'}</button>` : ''}
              ${sceneId === 'match' ? `<button type="button" id="live-button">${replayMode === 'replay' ? '返回直播' : '保持直播'}</button>` : ''}
              <button type="button" id="audio-toggle">音效：${audioMuted ? '关' : '开'}</button>
            </div>
          </div>
        </article>
        ${allowDevPanel ? `
          <article class="overlay-note">
            <h3>开发面板</h3>
            <p>展开后可查看事件日志、回放滑条、核心血量和战报统计。</p>
            <div class="overlay-actions">
              <button type="button" data-action="toggle-dev-panel">${devPanelOpen ? '收起开发面板' : '打开开发面板'}</button>
            </div>
          </article>
        ` : `
          <article class="overlay-note">
            <h3>本轮外测重点</h3>
            <ul class="overlay-bullet-list">
              ${playtestFocusPoints.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
            ${feedbackUrl ? `
              <div class="overlay-actions">
                <a class="overlay-link-button" href="${escapeHtml(feedbackUrl)}" target="_blank" rel="noreferrer">提交试玩反馈</a>
              </div>
            ` : ''}
          </article>
        `}
      </div>
    </section>
  `;
}
