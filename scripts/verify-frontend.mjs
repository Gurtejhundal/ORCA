// Run: playwright-cli run-code --filename scripts/verify-frontend.mjs
// This file is a CLI function expression, not an imported module.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
async (page) => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const origin = page.url().split('/').slice(0, 3).join('/');
  await page.goto(origin);
  await page.locator('#orca-query').waitFor();
  for (const [width, height] of [[1920,1080],[1600,900],[1440,900],[1366,768],[1280,720],[1024,768],[768,1024],[430,932],[390,844],[360,800]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    const layout = await page.evaluate(() => {
      const visible = (node) => node.getBoundingClientRect().width > 0 && getComputedStyle(node).visibility !== 'hidden';
      const rect = document.querySelector('.ask-orca').getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        dockVisible: visible(document.querySelector('.marine-tool-dock')),
        tools: [...document.querySelectorAll('.marine-tool-dock button')].map((node) => node.textContent.trim()),
        prompts: [...document.querySelectorAll('.ask-orca__suggestions button')].filter(visible).length,
        searchFits: rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
        targets: [...document.querySelectorAll('.orca-nav a[href^="#"]')].every((node) => !!document.querySelector(node.getAttribute('href'))),
        blur: getComputedStyle(document.querySelector('.orca-nav__rail')).backdropFilter,
      };
    });
    assert(!layout.overflow && layout.searchFits, 'Overflow or clipped search at ' + width);
    assert(layout.dockVisible === (width > 768), 'Wrong responsive dock at ' + width);
    assert(layout.tools.join('|') === 'Fishing Zones|Conditions|Alerts|Route|Layers', 'Wrong dock contents');
    assert(layout.prompts === (width > 768 ? 4 : 2), 'Wrong prompt count at ' + width);
    assert(layout.targets && layout.blur.includes('blur(18px)'), 'Nav anchors or marine glass regressed');
    await page.screenshot({ path: 'output/playwright/hero-' + width + '.png' });
    await page.screenshot({ path: 'output/playwright/page-' + width + '.png', fullPage: true });
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.locator('.orca-nav__rail a[href="#how-it-works"]').click();
  await page.locator('.reasoning-flow button').nth(5).click();
  assert(await page.locator('.reasoning-detail h3').textContent() === 'Recommend', 'Reasoning selector failed');
  for (let index = 0; index < 4; index++) {
    await page.locator('.use-case-selector button').nth(index).click();
    assert(await page.locator('.use-case-scenario h3').textContent(), 'Empty use case');
  }
  assert((await page.locator('.evidence-receipt').textContent()).match(/89%/g).length === 1, 'Duplicated confidence');
  assert(await page.locator('.evidence-receipt .data-state--live').count() === 0, 'Demo receipt claims live evidence');
  await page.locator('.orca-nav__rail a[href="#home"]').click();
  await page.locator('.marine-tool-dock button').nth(1).click();
  await page.getByRole('heading', { name: 'Conditions at your location', exact: true }).waitFor();
  await page.locator('.marine-tool-dock button').nth(2).click();
  await page.getByRole('heading', { name: 'Marine alerts', exact: true }).first().waitFor();
  await page.locator('.marine-tool-dock button').nth(3).click();
  await page.getByRole('heading', { name: 'Route options', exact: true }).waitFor();
  assert(await page.locator('.workspace-route').count() > 0, 'Routes panel is empty');
  await page.locator('.marine-tool-dock button').nth(4).click();
  await page.getByRole('heading', { name: 'Map layers', exact: true }).waitFor();
  const layerResponse = page.waitForResponse((response) => response.url().includes('/map/layer/waves'), { timeout: 45000 });
  await page.locator('.marine-layer-selector button').nth(3).click();
  assert((await layerResponse).ok(), 'Waves layer request failed');
  assert(await page.locator('.marine-layer-selector button').nth(3).getAttribute('aria-pressed') === 'true', 'Layer selection failed');
  await page.locator('.marine-tool-dock button').first().click();
  assert(await page.locator('#query').isVisible(), 'Fishing planner did not reopen');
  await page.locator('.orca-nav__rail a[href="#home"]').click();
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new Error('Test microphone denial'); };
    window.webkitSpeechRecognition = class { start() { throw new Error('Test speech failure'); } };
  });
  await page.getByRole('button', { name: 'Start voice input', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Voice input could not start' }).waitFor();
  assert(await page.getByRole('button', { name: 'Start voice input', exact: true }).getAttribute('aria-pressed') === 'false', 'Mic failure left listening active');
  await page.locator('#orca-query').fill('What can ORCA do?');
  await page.getByRole('button', { name: 'Send question', exact: true }).click();
  await page.locator('.chat-answer').first().waitFor();
  assert(await page.evaluate(() => location.pathname) === '/', 'Chat changed route');
  assert(await page.locator('video').evaluate((node) => node.paused), 'Ocean did not stop for chat');
  assert(await page.locator('.orca-landing').evaluate((node) => node.parentElement.inert), 'Hidden landing controls remain focusable');
  const chatResponse = page.waitForResponse((response) => response.url().includes('/api/v1/chat'), { timeout: 45000 });
  await page.locator('#orca-follow-up').fill('What is the wave height near Nagapattinam?');
  await page.getByRole('button', { name: 'Send follow-up', exact: true }).click();
  const response = await chatResponse;
  const chatPayload = await response.json();
  assert(response.ok() && typeof chatPayload.session_id === 'string', 'Marine chat API failed');
  await page.locator('.chat-thinking').waitFor({ state: 'hidden', timeout: 45000 });
  await page.locator('#orca-follow-up').fill('Open the marine map');
  await page.getByRole('button', { name: 'Send follow-up', exact: true }).click();
  await page.locator('.workspace-answer').waitFor();
  assert(await page.locator('.workspace-answer p').textContent() === chatPayload.answer, 'Map lost the conversation answer');
  await page.locator('.orca-nav__rail a[href="#home"]').click();
  await page.getByRole('button', { name: 'Open recent chat', exact: true }).click();
  await page.locator('.chat-workspace').waitFor();
  assert(await page.locator('.chat-turn').count() >= 2, 'Recent conversation was lost');
  await page.mouse.wheel(0, 900);
  assert(await page.locator('.chat-workspace').isVisible(), 'Wheel redirected away from chat');
  const turns = await page.locator('.chat-turn').count();
  await page.evaluate(() => { window.confirm = () => false; });
  await page.getByRole('button', { name: 'Delete chat', exact: true }).click();
  assert(await page.locator('.chat-turn').count() === turns, 'Cancel deleted chat');
  await page.evaluate(() => { window.confirm = () => true; });
  await page.getByRole('button', { name: 'Delete chat', exact: true }).click();
  await page.locator('.chat-empty').waitFor();
  await page.reload();
  assert(await page.evaluate(() => JSON.parse(localStorage.getItem('orca-recent-chat-v1')).turns.length) === 0, 'Deleted chat returned after reload');
  assert(await page.evaluate(() => !JSON.parse(localStorage.getItem('orca-recent-chat-v1')).sessionId), 'Deleted chat retained session context');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('button', { name: 'हिंदी', exact: true }).click();
  assert(await page.locator('#orca-query').getAttribute('placeholder') === 'मत्स्य, सुरक्षा, मार्ग या समुद्री स्थिति के बारे में ORCA से पूछें…', 'Hindi query assistance did not switch');
  await page.getByRole('button', { name: 'मेनू बंद करें', exact: true }).click();
  assert(!await page.locator('#orca-mobile-menu').isVisible(), 'Closed menu remains visible');
  await page.locator('.marine-tool-panel summary').click();
  await page.getByRole('button', { name: 'समुद्री स्थिति', exact: true }).click();
  await page.getByRole('heading', { name: 'आपके स्थान की समुद्री स्थिति', exact: true }).waitFor();
  assert(!await page.locator('.marine-tool-panel').getAttribute('open'), 'Tools panel stayed open');
  await page.keyboard.press('Escape');
  await page.mouse.wheel(0, -900);
  assert(await page.locator('.chat-workspace').count() === 0, 'Wheel reopened chat');
  return 'Frontend verification passed: 10 viewports, navigation, tools, layers, reasoning, use cases, chat deletion, native scrolling, Hindi mobile.';
}
