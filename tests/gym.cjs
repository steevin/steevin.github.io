// Run with a local HTTP server. PLAYWRIGHT_MODULE may point to an existing installation.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.GYM_URL || 'http://127.0.0.1:4173/focus_booster.html';
(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(url);
        await page.waitForFunction(() => typeof startRoutine === 'function' && !document.getElementById('routine-start').disabled);
        await page.clock.install();
        const state = fn => page.evaluate(fn);
        const click = id => page.locator('#' + id).click();

        // Pending flashes and turn-enabling callbacks cannot survive navigation.
        await click('tab-btn-neuro-matrix'); await click('game-btn');
        await click('tab-btn-stroop-challenge');
        await page.clock.runFor(10000);
        assert.deepEqual(await state(() => ({ active:gameActive, enabled:document.querySelectorAll('.grid-cell:not(:disabled)').length, pending:memoryTimers.size })), {active:false,enabled:0,pending:0});
        assert.equal(await state(() => trainingHistory.filter(r=>r.exercise==='memory' && r.status==='interrupted').length), 1);
        // Restart after cancelling does not inherit callbacks from the previous attempt.
        await click('tab-btn-neuro-matrix'); await click('game-btn');
        await page.clock.runFor(3000);
        for (const index of await state(() => gameSequence.slice())) await page.locator('.grid-cell').nth(index).click();
        assert.equal(await state(() => gameScore),1);
        await click('tab-btn-stroop-challenge');
        await page.clock.runFor(3000);
        assert.equal(await state(() => memoryTimers.size),0);

        // Penalty reaching zero ends synchronously and ignores further answers.
        await click('stroop-start-btn');
        await state(() => { stroopDeadline=performance.now()+1000; stroopAnswer(currentTargetColorKey==='red'?'blue':'red'); });
        assert.equal(await state(() => stroopGameActive),false);
        const historyCount=await state(()=>trainingHistory.length);
        await state(()=>{stroopAnswer(currentTargetColorKey);endStroop();});
        assert.equal(await state(()=>trainingHistory.length),historyCount);
        assert.equal(await state(()=>trainingHistory[0].errors),1);
        // Also reject a correct answer arriving after the deadline before the timer ticks.
        await click('stroop-start-btn');
        await state(()=>{stroopDeadline=performance.now()-1;stroopAnswer(currentTargetColorKey);});
        assert.equal(await state(()=>trainingHistory[0].correct),0);

        for (const [difficulty,cells] of [['easy',9],['normal',16],['hard',25]]) {
            await page.locator('#difficulty').selectOption(difficulty);
            await click('tab-btn-schulte-table'); await click('schulte-start-btn');
            assert.equal(await page.locator('.schulte-cell').count(),cells);
            for(let n=1;n<=cells;n++) await page.getByRole('button',{name:`Número ${n}`,exact:true}).click();
            assert.equal(await state(()=>trainingHistory[0].correct),cells);
            assert.equal(await state(()=>trainingHistory[0].difficulty),difficulty);
            assert.equal(await state(()=>trainingHistory[0].status),'completed');
        }
        // Untimed Stroop stays open until explicitly finished.
        await page.locator('#difficulty').selectOption('easy');
        await click('tab-btn-stroop-challenge'); await click('stroop-start-btn');
        await page.clock.runFor(61000);
        assert.equal(await state(()=>stroopGameActive),true);
        await state(()=>stroopAnswer(currentTargetColorKey));
        await click('stroop-finish');
        assert.equal(await state(()=>trainingHistory[0].correct),1);
        // Difficulties change the initial sequence length and remain locked during play.
        for(const [difficulty,length] of [['easy',2],['normal',3],['hard',4]]) {
            await page.locator('#difficulty').selectOption(difficulty);
            await click('tab-btn-neuro-matrix'); await click('game-btn');
            assert.equal(await state(()=>gameSequence.length),length);
            assert(await page.locator('#difficulty').isDisabled());
            await click('tab-btn-calm-chamber');
        }
        // Guided routine: bounded breathing, memory deadline, timed Stroop and summary.
        await page.locator('#difficulty').selectOption('normal');
        await click('routine-start');
        assert(await page.locator('#breath-btn').isDisabled());
        await page.clock.runFor(60000);
        assert.equal(await state(()=>isBreathing),false);
        assert(await page.locator('#routine-next').isVisible());
        await click('routine-next');
        await page.clock.runFor(120000);
        assert.equal(await state(()=>gameActive),false);
        await click('routine-next');
        await page.clock.runFor(120000);
        await click('routine-next');
        assert.equal(await state(()=>routine),null);
        assert.equal(await state(()=>trainingHistory[0].exercise),'routine');
        assert.equal(await state(()=>trainingHistory[0].score),3);
        assert.equal(await state(()=>trainingHistory[0].status),'completed');
        assert.match(await page.locator('#result-title').innerText(),/Rutina completada/);
        assert.equal(await state(()=>memoryTimers.size),0);
        // Navigation cancels an active routine, rather than leaving its deadline alive.
        await click('routine-start'); await click('tab-btn-schulte-table');
        await page.clock.runFor(180000);
        assert.equal(await state(()=>routine),null);
        assert.equal(await state(()=>isBreathing),false);
        assert.equal(await state(()=>trainingHistory[0].status),'interrupted');
        // A hidden page interrupts a guided step and cannot resume stale work.
        await click('routine-start');
        await state(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
        await page.clock.runFor(180000);
        assert.equal(await state(()=>routine),null);
        assert.equal(await state(()=>isBreathing),false);
        assert.equal(await state(()=>activeSession),null);
        await state(()=>delete document.hidden);
        // History survives a reload and filtering does not mix exercises.
        const saved=await state(()=>trainingHistory.length);
        await page.reload(); await page.waitForFunction(()=>!document.getElementById('routine-start').disabled);
        assert.equal(await state(()=>trainingHistory.length),saved);
        await page.locator('#history-filter').selectOption('schulte');
        assert.equal(await page.locator('#history-list tbody tr').count(),3);
        for (const width of [390,768,1440]) {
            await page.setViewportSize({width,height:1000});
            assert(await state(()=>document.documentElement.scrollWidth<=innerWidth));
        }
        assert.deepEqual(errors,[]);
        console.log('PASS: cancellation, restart, Stroop expiration, difficulties, guided routine, history, responsive layouts');
        // Invalid persisted content is ignored. A blocked store cannot break startup.
        await page.evaluate(()=>localStorage.setItem('gym_history_v1','{"broken":true}'));
        await page.reload(); await page.waitForFunction(()=>!document.getElementById('routine-start').disabled);
        assert.equal(await state(()=>trainingHistory.length),0);
        const blocked=await browser.newPage();
        await blocked.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('blocked')};Storage.prototype.setItem=()=>{throw Error('blocked')};});
        await blocked.goto(url); await blocked.waitForFunction(()=>!document.getElementById('routine-start').disabled);
        await blocked.locator('#difficulty').selectOption('easy');
        assert.match(await blocked.locator('#storage-note').innerText(),/solo durante esta visita/);
        console.log('PASS: corrupted and unavailable storage');
    } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
