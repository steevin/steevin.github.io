// A blocked or full browser store must not prevent the exercises from running.
const volatileStorage = new Map();
const safeStorage = {
    getItem(key) { try { return localStorage.getItem(key); } catch { return volatileStorage.get(key) ?? null; } },
    setItem(key, value) {
        volatileStorage.set(key, String(value));
        try { localStorage.setItem(key, value); }
        catch { const note = document.getElementById('storage-note'); if (note) note.textContent = 'El navegador no permite guardar datos. El historial estará disponible solo durante esta visita.'; }
    }
};
/**************************************************************
 * 1. SISTEMA AUDIO BINAURAL & RUIDO MARRÓN (AudioContext Sintetizado)
 **************************************************************/
let audioCtx = null;
let leftOsc = null;
let rightOsc = null;
let leftGain = null;
let rightGain = null;
let pannerLeft = null;
let pannerRight = null;

// Ruido Marrón Nativo
let brownNoiseNode = null;
let brownGain = null;
let isBrownNoisePlaying = false;

let isAudioPlaying = false;
let selectedWaveMode = 'alpha';
let baseCarrierFreq = 180;
let currentVolume = 0.3;

// Inicializar Audio Context de forma segura ante interacciones del navegador
function initAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function selectWave(mode) {
    selectedWaveMode = mode;
    const btnAlpha = document.getElementById('wave-alpha');
    const btnBeta = document.getElementById('wave-beta');

    if (mode === 'alpha') {
        btnAlpha.className = 'py-2 px-3 rounded-lg bg-indigo-600/20 border border-indigo-500 text-indigo-300 font-semibold text-xs text-center transition-all focus:outline-none';
        btnBeta.className = 'py-2 px-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 font-semibold text-xs text-center transition-all hover:bg-slate-800 focus:outline-none';
    } else {
        btnBeta.className = 'py-2 px-3 rounded-lg bg-indigo-600/20 border border-indigo-500 text-indigo-300 font-semibold text-xs text-center transition-all focus:outline-none';
        btnAlpha.className = 'py-2 px-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 font-semibold text-xs text-center transition-all hover:bg-slate-800 focus:outline-none';
    }

    btnAlpha.setAttribute('aria-pressed', String(mode === 'alpha'));
    btnBeta.setAttribute('aria-pressed', String(mode === 'beta'));

    if (isAudioPlaying) {
        updateFrequencies();
    }
}

function updateVolume(value) {
    currentVolume = value / 100;
    document.getElementById('vol-display').textContent = `${value}%`;

    // Actualizar ganancia de osciladores binaurales
    if (isAudioPlaying && leftGain && rightGain) {
        leftGain.gain.setValueAtTime(currentVolume * 0.4, audioCtx.currentTime);
        rightGain.gain.setValueAtTime(currentVolume * 0.4, audioCtx.currentTime);
    }
    // Actualizar ganancia del ruido marrón
    if (isBrownNoisePlaying && brownGain) {
        brownGain.gain.setValueAtTime(currentVolume * 0.3, audioCtx.currentTime);
    }
}

function updateFrequencies() {
    if (!leftOsc || !rightOsc) return;
    let diff = selectedWaveMode === 'beta' ? 15 : 10;
    leftOsc.frequency.setValueAtTime(baseCarrierFreq, audioCtx.currentTime);
    rightOsc.frequency.setValueAtTime(baseCarrierFreq + diff, audioCtx.currentTime);
}

// Generación Algorítmica de Ruido Marrón Estéreo Real
function createBrownNoiseNode() {
    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Filtro paso bajo de primer orden para aproximar el ruido browniano (-6dB/octava)
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5; // Compensar volumen de atenuación
    }

    const bufferSource = audioCtx.createBufferSource();
    bufferSource.buffer = noiseBuffer;
    bufferSource.loop = true;
    return bufferSource;
}

function toggleBrownNoise() {
    initAudioContext();
    const btn = document.getElementById('brown-noise-btn');
    const status = document.getElementById('brown-noise-status');

    if (!isBrownNoisePlaying) {
        brownNoiseNode = createBrownNoiseNode();
        brownGain = audioCtx.createGain();
        brownGain.gain.setValueAtTime(currentVolume * 0.3, audioCtx.currentTime);

        brownNoiseNode.connect(brownGain).connect(audioCtx.destination);
        brownNoiseNode.start();

        isBrownNoisePlaying = true;
        btn.setAttribute('aria-pressed', 'true');
        btn.className = "w-full py-2 px-3 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-xs font-semibold border border-indigo-500 text-indigo-300 transition-all flex items-center justify-center gap-2";
        status.textContent = "Sintonizado";
        showToast("🔊 Ruido Marrón profundo encendido", "💤");
    } else {
        if (brownNoiseNode) {
            brownNoiseNode.stop();
            brownNoiseNode.disconnect();
        }
        isBrownNoisePlaying = false;
        btn.setAttribute('aria-pressed', 'false');
        btn.className = "w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold border border-slate-800 text-slate-300 transition-all flex items-center justify-center gap-2";
        status.textContent = "Apagado";
        showToast("Muteado el Ruido Marrón", "🔇");
    }
}

function toggleAudio() {
    initAudioContext();
    const btn = document.getElementById('audio-btn');
    const btnText = document.getElementById('audio-btn-text');
    const playIcon = document.getElementById('play-icon');

    if (!isAudioPlaying) {
        leftOsc = audioCtx.createOscillator();
        rightOsc = audioCtx.createOscillator();
        leftOsc.type = 'sine';
        rightOsc.type = 'sine';

        leftGain = audioCtx.createGain();
        rightGain = audioCtx.createGain();
        leftGain.gain.setValueAtTime(currentVolume * 0.4, audioCtx.currentTime);
        rightGain.gain.setValueAtTime(currentVolume * 0.4, audioCtx.currentTime);

        pannerLeft = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
        pannerRight = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;

        if (pannerLeft && pannerRight) {
            pannerLeft.pan.setValueAtTime(-1, audioCtx.currentTime);
            pannerRight.pan.setValueAtTime(1, audioCtx.currentTime);

            leftOsc.connect(leftGain).connect(pannerLeft).connect(audioCtx.destination);
            rightOsc.connect(rightGain).connect(pannerRight).connect(audioCtx.destination);
        } else {
            leftOsc.connect(leftGain).connect(audioCtx.destination);
            rightOsc.connect(rightGain).connect(audioCtx.destination);
        }

        updateFrequencies();
        leftOsc.start();
        rightOsc.start();

        isAudioPlaying = true;
        btn.setAttribute('aria-pressed', 'true');
        btn.className = "w-full py-3.5 mt-2 rounded-xl bg-red-600/30 hover:bg-red-700/40 border border-red-500 text-red-200 font-bold text-xs transition-all shadow-lg flex justify-center items-center gap-2";
        btnText.textContent = "Detener Binaural";
        playIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />`;
        showToast("🎧 Sintonización binaural activa", "✨");
    } else {
        if (leftOsc) { leftOsc.stop(); leftOsc.disconnect(); }
        if (rightOsc) { rightOsc.stop(); rightOsc.disconnect(); }
        isAudioPlaying = false;
        btn.setAttribute('aria-pressed', 'false');

        btn.className = "w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-500/20 flex justify-center items-center gap-2";
        btnText.textContent = "Iniciar Binaural";
        playIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />`;
    }
}


/**************************************************************
 * 2. SISTEMA DE RESPIRACIÓN EN CAJA (CON GUIDES)
 **************************************************************/
let breathingInterval = null;
let isBreathing = false;
let breathingPhase = 0;
let breathTimeLeft = 4;

const phases = [
    { text: "Inhala", timerClass: "scale-[1.25] bg-gradient-to-tr from-emerald-500/30 to-indigo-500/20 border-emerald-400" },
    { text: "Retén",  timerClass: "scale-[1.25] bg-gradient-to-tr from-indigo-500/30 to-purple-500/20 border-indigo-400" },
    { text: "Exhala", timerClass: "scale-90 bg-gradient-to-tr from-pink-500/20 to-indigo-500/10 border-pink-400" },
    { text: "Retén",  timerClass: "scale-90 bg-slate-900 border-slate-700" }
];

function playSoftNote(freq, duration) {
    if (!audioCtx) return;
    try {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
}

function toggleBreathing() {
    initAudioContext();
    const btn = document.getElementById('breath-btn');
    const ball = document.getElementById('breathing-ball');
    const actionText = document.getElementById('breath-action');
    const timerText = document.getElementById('breath-timer');

    if (!isBreathing) {
        isBreathing = true;
        btn.setAttribute('aria-pressed', 'true');
        breathingPhase = 0;
        breathTimeLeft = 4;

        actionText.textContent = phases[breathingPhase].text;
        timerText.textContent = `${breathTimeLeft}s`;
        ball.className = `breathing-circle w-24 h-24 border rounded-full flex flex-col justify-center items-center custom-glow relative z-10 duration-[4000ms] ${phases[breathingPhase].timerClass}`;

        btn.textContent = "Detener Ciclo";
        btn.className = "w-full py-3.5 rounded-xl bg-red-600/30 hover:bg-red-700/40 border border-red-500 text-red-200 font-bold text-xs transition-all flex justify-center items-center";

        // Nota suave de entrada
        playSoftNote(440, 0.5);

        breathingInterval = setInterval(() => {
            breathTimeLeft--;
            if (breathTimeLeft <= 0) {
                breathingPhase = (breathingPhase + 1) % 4;
                breathTimeLeft = 4;

                actionText.textContent = phases[breathingPhase].text;
                ball.className = `breathing-circle w-24 h-24 border rounded-full flex flex-col justify-center items-center custom-glow relative z-10 duration-[4000ms] ${phases[breathingPhase].timerClass}`;

                // Sonido sutil en cada cambio de fase
                const freqs = [330, 440, 330, 261];
                playSoftNote(freqs[breathingPhase], 0.4);
            }
            timerText.textContent = `${breathTimeLeft}s`;
        }, 1000);
        showToast("🧘 Respiración caja iniciada. Sigue el compás.", "🍃");
    } else {
        clearInterval(breathingInterval);
        isBreathing = false;
        btn.setAttribute('aria-pressed', 'false');
        actionText.textContent = "Listo";
        timerText.textContent = "4s";
        ball.className = "breathing-circle w-24 h-24 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-full flex flex-col justify-center items-center scale-100 custom-glow relative z-10";

        btn.textContent = "Iniciar Respiración";
        btn.className = "w-full py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs transition-all flex justify-center items-center";
    }
}


/**************************************************************
 * 3. TEMPORIZADOR DE ENFOQUE (POMODORO)
 **************************************************************/
let timerSeconds = 1500; // 25 min default
let timerInterval = null;
let isTimerActive = false;
let selectedTimerMinutes = 25;

function setTimer(minutes) {
    selectedTimerMinutes = minutes;
    timerSeconds = minutes * 60;
    updateTimerDisplay();
    if (isTimerActive) {
        toggleTimer();
    }

    document.querySelectorAll('[data-timer-minutes]').forEach(button => {
        const selected = Number(button.dataset.timerMinutes) === minutes;
        button.setAttribute('aria-pressed', String(selected));
        button.classList.toggle('bg-slate-800', selected);
        button.classList.toggle('text-indigo-300', selected);
    });
}

function updateTimerDisplay() {
    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    document.getElementById('timer-display').textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function toggleTimer() {
    initAudioContext();
    const btn = document.getElementById('timer-btn');
    const icon = document.getElementById('timer-icon');

    if (!isTimerActive) {
        if (timerSeconds <= 0) {
            timerSeconds = selectedTimerMinutes * 60;
            updateTimerDisplay();
        }
        isTimerActive = true;
        btn.setAttribute('aria-pressed', 'true');
        btn.setAttribute('aria-label', 'Pausar temporizador');
        btn.className = "p-2.5 rounded-lg bg-red-600/20 border border-red-500 text-red-300 hover:bg-red-600/30 transition-all";
        icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6" />`;

        timerInterval = setInterval(() => {
            if (timerSeconds > 0) {
                timerSeconds--;
                updateTimerDisplay();
            } else {
                clearInterval(timerInterval);
                isTimerActive = false;
                btn.setAttribute('aria-pressed', 'false');
                btn.setAttribute('aria-label', 'Iniciar temporizador');
                btn.className = "p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 transition-all";
                icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />`;

                // Sonido campana final de sesión
                playCampanaFocus();
                showToast("🎉 ¡Sesión de Enfoque Finalizada! Es hora de un respiro.", "🏆");
            }
        }, 1000);
    } else {
        clearInterval(timerInterval);
        isTimerActive = false;
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-label', 'Reanudar temporizador');
        btn.className = "p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 transition-all";
        icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />`;
    }
}

function playCampanaFocus() {
    if (!audioCtx) return;
    const freqs = [523.25, 659.25, 783.99, 1046.5]; // Armónicos zen
    freqs.forEach((f, i) => {
        setTimeout(() => {
            playSoftNote(f, 1.5);
        }, i * 200);
    });
}


/**************************************************************
 * SESIONES, DIFICULTADES E HISTORIAL LOCAL
 **************************************************************/
const difficultyLevels = {
    easy: { label: 'Inicial', memoryLength: 2, memoryDelay: 850, grid: 3, stroopSeconds: null, penalty: 0, mismatch: .5 },
    normal: { label: 'Intermedia', memoryLength: 3, memoryDelay: 650, grid: 4, stroopSeconds: 30, penalty: 2, mismatch: .75 },
    hard: { label: 'Avanzada', memoryLength: 4, memoryDelay: 500, grid: 5, stroopSeconds: 30, penalty: 3, mismatch: 1 }
};
const exerciseNames = { memory: 'Memoria', stroop: 'Stroop', schulte: 'Schulte', routine: 'Rutina' };
let difficulty = 'normal';
let activeSession = null;
let trainingHistory = [];
let routine = null;
let routineInterval = null;
const routineSteps = [
    { tab: 'calm-chamber', label: 'Respiración', seconds: 60, hint: 'Sigue el círculo durante un minuto.' },
    { tab: 'neuro-matrix', label: 'Memoria', seconds: 120, hint: 'Repite las secuencias. El paso termina al fallar o al llegar a dos minutos.' },
    { tab: 'stroop-challenge', label: 'Stroop', seconds: 120, hint: 'Responde al color de la tinta. Los errores pueden acortar el tiempo según la dificultad.' }
];
const $ = id => document.getElementById(id);

function readTrainingHistory() {
    try {
        const value = JSON.parse(safeStorage.getItem('gym_history_v1') || '[]');
        if (!Array.isArray(value)) return [];
        return value.filter(r => r && exerciseNames[r.exercise] && difficultyLevels[r.difficulty]
            && ['completed', 'interrupted'].includes(r.status) && ['practice', 'routine'].includes(r.mode)
            && Number.isFinite(Date.parse(r.date)) && ['seconds','correct','errors','score'].every(k => Number.isFinite(r[k]) && r[k] >= 0)).slice(0,100);
    } catch { return []; }
}
function changeDifficulty(value) {
    if (!difficultyLevels[value] || routine) return;
    cancelExercise();
    difficulty = value;
    safeStorage.setItem('gym_difficulty', value);
    updateDifficultyUI();
}
function updateDifficultyUI() {
    $('difficulty').value = difficulty;
    const config = difficultyLevels[difficulty];
    $('difficulty-hint').textContent = `${config.memoryLength} luces al empezar · Schulte ${config.grid}×${config.grid} · Stroop ${config.stroopSeconds ? '30 s' : 'sin reloj'}`;
    $('schulte-range').textContent = `1 al ${config.grid ** 2}`;
    if (!stroopGameActive) $('stroop-timer').textContent = config.stroopSeconds ? `${config.stroopSeconds}s` : 'Libre';
    if (!schulteGameActive) {
        $('schulte-grid').style.gridTemplateColumns = `repeat(${config.grid}, minmax(0, 1fr))`;
        $('schulte-grid').innerHTML = '<p style="grid-column:1/-1;padding:24px;text-align:center">La tabla se generará al iniciar.</p>';
        $('schulte-target').textContent = '1';
        $('schulte-timer').textContent = '00.0s';
    }
    $('session-result').hidden = true;
    updateRecordDisplays();
}
function beginSession(exercise) {
    if (activeSession) finishSession('interrupted');
    activeSession = { exercise, difficulty, mode: routine ? 'routine' : 'practice', started: performance.now(), correct: 0, errors: 0, score: 0, responseTotal: 0, responses: 0 };
    $('session-result').hidden = true;
    $('difficulty').disabled = true;
}
function recordAnswer(correct, latency) {
    if (!activeSession) return;
    activeSession[correct ? 'correct' : 'errors']++;
    if (Number.isFinite(latency)) {
        activeSession.responseTotal += Math.max(0,latency);
        activeSession.responses++;
    }
}
function appendHistory(record) {
    trainingHistory.unshift(record);
    trainingHistory = trainingHistory.slice(0,100);
    safeStorage.setItem('gym_history_v1', JSON.stringify(trainingHistory));
    renderHistory();
    updateRecordDisplays();
}
function finishSession(status = 'completed') {
    if (!activeSession) return null;
    const session = activeSession;
    activeSession = null;
    const record = { exercise: session.exercise, difficulty: session.difficulty, mode: session.mode, date: new Date().toISOString(), status,
        seconds: Math.round((performance.now()-session.started)/100)/10,
        correct: session.correct, errors: session.errors, score: session.score,
        responseMs: session.responses ? Math.round(session.responseTotal/session.responses) : null };
    appendHistory(record);
    $('difficulty').disabled = Boolean(routine);
    if (status === 'completed') {
        showSessionResult(record);
        if (routine) finishRoutineStep();
    }
    return record;
}
function accuracy(record) {
    const total = record.correct + record.errors;
    return total ? `${Math.round(record.correct / total * 100)}%` : '—';
}
function resultText(record) {
    if (record.exercise === 'routine') return `${record.score}/3 pasos · ${Math.round(record.seconds)} s`;
    const result = record.exercise === 'memory' ? `${record.score} niveles completados` : record.exercise === 'stroop' ? `${record.correct} aciertos` : `${record.correct} números encontrados`;
    return `${result} · ${record.errors} errores · ${accuracy(record)} de precisión · ${record.seconds} s${Number.isFinite(record.responseMs) ? ` · ${record.responseMs} ms por respuesta` : ''}`;
}
function showSessionResult(record) {
    const previous = trainingHistory.find(r => r !== record && r.status === 'completed' && r.exercise === record.exercise && r.difficulty === record.difficulty && r.mode === record.mode);
    $('result-title').textContent = `${exerciseNames[record.exercise]} · ${difficultyLevels[record.difficulty].label}`;
    $('result-detail').textContent = resultText(record);
    $('result-comparison').textContent = previous ? `Sesión anterior de la misma dificultad y modalidad: ${resultText(previous)}` : 'Primera sesión completada de esta dificultad y modalidad.';
    $('session-result').hidden = false;
    if (!routine) $('session-result').focus();
}
function renderHistory() {
    const filter = $('history-filter').value;
    const records = trainingHistory.filter(r => filter === 'all' || r.exercise === filter);
    $('history-summary').textContent = `${records.length} sesiones · ${records.filter(r=>r.status==='completed').length} completadas`;
    const list = $('history-list');
    list.replaceChildren();
    if (!records.length) { list.textContent = 'Tu primera sesión aparecerá aquí al terminar. Elige un ejercicio o empieza una rutina.'; return; }
    const table = document.createElement('table');
    const head = table.createTHead().insertRow();
    const columns = ['Fecha','Ejercicio','Dificultad','Resultado','Estado'];
    columns.forEach(title=>{ const th=document.createElement('th'); th.scope='col'; th.textContent=title; head.append(th); });
    const body = table.createTBody();
    records.forEach(record=>{
        const row=body.insertRow();
        [new Date(record.date).toLocaleString('es-CO',{dateStyle:'short',timeStyle:'short'}), `${exerciseNames[record.exercise]}${record.mode==='routine' && record.exercise!=='routine' ? ' · guiada' : ''}`, difficultyLevels[record.difficulty].label, resultText(record), record.status==='completed'?'Completada':'Interrumpida'].forEach((value,index)=>{
            const cell=row.insertCell(); cell.textContent=value; cell.dataset.label=columns[index];
        });
    });
    list.append(table);
}
function updateRecordDisplays() {
    const records = trainingHistory.filter(r=>r.status==='completed' && r.difficulty===difficulty && r.mode==='practice');
    const memory=records.filter(r=>r.exercise==='memory');
    const stroop=records.filter(r=>r.exercise==='stroop');
    const schulte=records.filter(r=>r.exercise==='schulte');
    $('stat-memory-record').textContent=memory.length ? `${Math.max(...memory.map(r=>r.score))} niveles` : '—';
    $('stat-stroop-record').textContent=stroop.length ? (difficulty==='easy' ? `${Math.max(...stroop.map(r=>r.correct+r.errors ? Math.round(100*r.correct/(r.correct+r.errors)):0))}% precisión` : `${Math.max(...stroop.map(r=>r.correct))} aciertos`) : '—';
    $('stat-schulte-record').textContent=schulte.length ? `${Math.min(...schulte.map(r=>r.seconds))} s` : '—';
}

/**************************************************************
 * MEMORIA: todos los callbacks pertenecen a una sola partida.
 **************************************************************/
let gameSequence = [], playerSequence = [];
let gameActive = false, acceptingMemory = false;
let gameLevel = 1, gameScore = 0, memoryResponseAt = 0;
const memoryTimers = new Set();
function memoryLater(callback, delay) {
    const timer=setTimeout(()=>{memoryTimers.delete(timer); callback();},delay);
    memoryTimers.add(timer);
}
function clearMemoryTimers() {
    memoryTimers.forEach(clearTimeout);
    memoryTimers.clear();
}
function resetAllCells() {
    document.querySelectorAll('.grid-cell').forEach(cell=>cell.className='grid-cell bg-slate-800/80 hover:bg-slate-700/80 aspect-square rounded-2xl transition-all duration-100 border border-slate-700/60 disabled:opacity-90 disabled:cursor-not-allowed');
}
function disableAllCells(disabled) { document.querySelectorAll('.grid-cell').forEach(cell=>cell.disabled=disabled); }
function updateGameStatus(text) { $('game-status').textContent=text; }
function stopMemory() {
    clearMemoryTimers();
    gameActive=false; acceptingMemory=false;
    resetAllCells(); disableAllCells(true);
    $('game-btn').disabled=false; $('game-btn').textContent='Iniciar memoria';
    updateGameStatus('Pulsa iniciar para comenzar.');
}
function startGame() {
    if (routine && (routine.index!==1 || routine.waiting)) return;
    cancelExercise(); initAudioContext(); beginSession('memory');
    gameActive=true; gameLevel=1; gameScore=0;
    $('game-level').textContent='1'; $('game-score').textContent='0';
    $('game-btn').disabled=true;
    generateNextSequence();
}
function generateNextSequence() {
    if (!gameActive) return;
    playerSequence=[];
    const config=difficultyLevels[difficulty];
    gameSequence=Array.from({length:config.memoryLength+gameLevel-1},()=>Math.floor(Math.random()*9));
    acceptingMemory=false; disableAllCells(true);
    $('game-btn').textContent='Observa el patrón…'; updateGameStatus('Observa el patrón.');
    // Always leave a gap after the light goes off, including repeated cells.
    const delay=Math.max(470,config.memoryDelay-(gameLevel-1)*15);
    gameSequence.forEach((index,i)=>memoryLater(()=>flashCell(index),(i+1)*delay));
    memoryLater(()=>{
        if (!gameActive) return;
        acceptingMemory=true; disableAllCells(false); memoryResponseAt=performance.now();
        $('game-btn').textContent='Tu turno'; updateGameStatus('Tu turno. Repite la secuencia.');
    },(gameSequence.length+1)*delay);
}
function flashCell(index) {
    if (!gameActive) return;
    const cell=document.querySelectorAll('.grid-cell')[index];
    cell.classList.remove('bg-slate-800/80'); cell.classList.add('bg-indigo-500','scale-[1.06]');
    playSoftNote(200+index*50,.2);
    memoryLater(()=>{cell.classList.remove('bg-indigo-500','scale-[1.06]');cell.classList.add('bg-slate-800/80');},300);
}
function cellClicked(index) {
    if (!gameActive || !acceptingMemory) return;
    const correct=index===gameSequence[playerSequence.length];
    recordAnswer(correct,performance.now()-memoryResponseAt); memoryResponseAt=performance.now();
    if (!correct) { gameOver(); return; }
    playerSequence.push(index); playSoftNote(300+index*40,.1);
    if (playerSequence.length===gameSequence.length) {
        gameScore++; gameLevel++; activeSession.score=gameScore;
        $('game-score').textContent=String(gameScore); $('game-level').textContent=String(gameLevel);
        acceptingMemory=false; disableAllCells(true);
        updateGameStatus('Correcto. Preparando la siguiente secuencia.');
        memoryLater(generateNextSequence,700);
    }
}
function gameOver() {
    if (!gameActive) return;
    stopMemory(); updateGameStatus(`Sesión terminada. ${gameScore} niveles completados.`);
    finishSession();
}

/**************************************************************
 * STROOP: el plazo se verifica también antes de cada respuesta.
 **************************************************************/
const stroopColors=[{key:'red',name:'Rojo',textClass:'text-red-500'},{key:'blue',name:'Azul',textClass:'text-blue-500'},{key:'green',name:'Verde',textClass:'text-emerald-400'},{key:'yellow',name:'Amarillo',textClass:'text-yellow-400'}];
let stroopScore=0, stroopTimeLeft=30, stroopInterval=null, stroopGameActive=false, currentTargetColorKey='', stroopDeadline=null, stroopResponseAt=0;
function stopStroop() {
    clearInterval(stroopInterval); stroopInterval=null; stroopGameActive=false;
    $('stroop-controls').classList.add('hidden'); $('stroop-start-btn').classList.remove('hidden'); $('stroop-finish').hidden=true;
}
function startStroop() {
    if (routine && (routine.index!==2 || routine.waiting)) return;
    cancelExercise(); initAudioContext(); beginSession('stroop');
    stroopScore=0; stroopGameActive=true;
    const seconds=routine ? routineSteps[2].seconds : difficultyLevels[difficulty].stroopSeconds;
    stroopDeadline=seconds===null ? null : performance.now()+seconds*1000;
    $('stroop-score').textContent='0';
    $('stroop-start-btn').classList.add('hidden'); $('stroop-controls').classList.remove('hidden'); $('stroop-finish').hidden=seconds!==null;
    nextStroopQuestion(); updateStroopClock();
    if (seconds!==null) stroopInterval=setInterval(updateStroopClock,100);
}
function updateStroopClock() {
    if (!stroopGameActive) return;
    stroopTimeLeft=stroopDeadline===null ? null : Math.max(0,Math.ceil((stroopDeadline-performance.now())/1000));
    $('stroop-timer').textContent=stroopTimeLeft===null ? 'Libre' : `${stroopTimeLeft}s`;
    if (stroopTimeLeft===0) endStroop();
}
function nextStroopQuestion() {
    if (!stroopGameActive) return;
    const name=Math.floor(Math.random()*4);
    const ink=Math.random()<difficultyLevels[difficulty].mismatch ? (name+1+Math.floor(Math.random()*3))%4 : name;
    $('stroop-word').textContent=stroopColors[name].name;
    $('stroop-word').className=`text-5xl font-black tracking-widest uppercase ${stroopColors[ink].textClass}`;
    currentTargetColorKey=stroopColors[ink].key; stroopResponseAt=performance.now();
}
function stroopAnswer(key) {
    if (!stroopGameActive) return;
    if (stroopDeadline!==null && performance.now()>=stroopDeadline) { endStroop(); return; }
    const correct=key===currentTargetColorKey;
    recordAnswer(correct,performance.now()-stroopResponseAt);
    if (correct) { stroopScore++; activeSession.score=stroopScore; $('stroop-score').textContent=String(stroopScore); }
    else if (stroopDeadline!==null) stroopDeadline-=difficultyLevels[difficulty].penalty*1000;
    $('stroop-status').textContent=correct?'Correcto.':'Incorrecto.';
    updateStroopClock();
    if (stroopGameActive) nextStroopQuestion();
}
function endStroop() {
    if (!stroopGameActive) return;
    stopStroop();
    $('stroop-word').textContent='Sesión terminada'; $('stroop-word').className='text-3xl font-black text-slate-500';
    $('stroop-status').textContent=`Sesión terminada. ${stroopScore} aciertos.`;
    finishSession();
}

/**************************************************************
 * SCHULTE: tamaños y métricas separados por dificultad.
 **************************************************************/
let schulteNumbers=[], currentSchulteTarget=1, schulteStartTime=null, schulteInterval=null, schulteGameActive=false, schulteResponseAt=0;
function stopSchulte() {
    clearInterval(schulteInterval); schulteInterval=null; schulteGameActive=false;
    document.querySelectorAll('.schulte-cell').forEach(cell=>cell.disabled=true);
}
function startSchulte() {
    if (routine) return;
    cancelExercise(); initAudioContext(); beginSession('schulte');
    const size=difficultyLevels[difficulty].grid;
    schulteNumbers=Array.from({length:size*size},(_,i)=>i+1); shuffleArray(schulteNumbers);
    currentSchulteTarget=1; schulteGameActive=true; schulteStartTime=performance.now(); schulteResponseAt=schulteStartTime;
    $('schulte-target').textContent='1'; $('schulte-timer').textContent='00.0s';
    const grid=$('schulte-grid'); grid.replaceChildren(); grid.style.gridTemplateColumns=`repeat(${size},minmax(0,1fr))`; grid.setAttribute('aria-label',`Tabla de números del 1 al ${size*size}`);
    schulteNumbers.forEach(num=>{
        const btn=document.createElement('button'); btn.type='button'; btn.textContent=String(num); btn.setAttribute('aria-label',`Número ${num}`);
        btn.className='schulte-cell bg-slate-900/80 text-slate-200 font-extrabold aspect-square rounded-lg border border-slate-800/60';
        btn.onclick=()=>clickedSchulte(num,btn); grid.append(btn);
    });
    schulteInterval=setInterval(()=>$('schulte-timer').textContent=`${((performance.now()-schulteStartTime)/1000).toFixed(1)}s`,100);
    $('schulte-start-btn').textContent='Reiniciar tabla';
}
function clickedSchulte(num,button) {
    if (!schulteGameActive || button.disabled) return;
    const correct=num===currentSchulteTarget;
    recordAnswer(correct,performance.now()-schulteResponseAt); schulteResponseAt=performance.now();
    if (correct) {
        button.disabled=true; currentSchulteTarget++; activeSession.score++;
        $('schulte-target').textContent=String(currentSchulteTarget);
        if (currentSchulteTarget>schulteNumbers.length) endSchulte();
    } else showToast(`Busca el número ${currentSchulteTarget}.`,'↗');
}
function endSchulte() {
    if (!schulteGameActive) return;
    stopSchulte(); $('schulte-target').textContent='¡Listo!';
    $('schulte-timer').textContent=`${((performance.now()-schulteStartTime)/1000).toFixed(1)}s`;
    finishSession();
}
function shuffleArray(array) { for(let i=array.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[array[i],array[j]]=[array[j],array[i]];} }
function cancelExercise() {
    stopMemory(); stopStroop(); stopSchulte();
    finishSession('interrupted');
}

/**************************************************************
 * RUTINA GUIADA: pasos acotados y avance explícito.
 **************************************************************/
function startRoutine() {
    if (routine) return;
    cancelExercise();
    if (isBreathing) toggleBreathing();
    if (isTimerActive) toggleTimer();
    routine={index:-1,started:performance.now(),completed:0,waiting:false};
    $('routine-start').disabled=true; $('difficulty').disabled=true;
    lockRoutineControls(true);
    $('routine-progress').hidden=false;
    nextRoutineStep();
}
function nextRoutineStep() {
    if (!routine || (routine.index>=0 && !routine.waiting)) return;
    routine.index++; routine.waiting=false;
    if (routine.index>=routineSteps.length) { completeRoutine('completed'); return; }
    const step=routineSteps[routine.index];
    switchTab(step.tab,true);
    routine.deadline=performance.now()+step.seconds*1000;
    $('routine-title').textContent=`Paso ${routine.index+1} de 3 · ${step.label}`;
    $('routine-description').textContent=step.hint;
    $('routine-next').hidden=true;
    if (routine.index===0) { if (!isBreathing) toggleBreathing(); }
    if (routine.index===1) startGame();
    if (routine.index===2) startStroop();
    clearInterval(routineInterval);
    routineInterval=setInterval(tickRoutine,100); tickRoutine();
    $('workspace').focus();
}
function tickRoutine() {
    if (!routine || routine.waiting) return;
    const deadline = routine.index === 2 && stroopDeadline !== null ? Math.min(routine.deadline, stroopDeadline) : routine.deadline;
    const left=Math.max(0,Math.ceil((deadline-performance.now())/1000));
    $('routine-time').textContent=`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;
    if (left===0) {
        if (routine.index===0) { if(isBreathing) toggleBreathing(); finishRoutineStep(); }
        else if (routine.index===1) { stopMemory(); finishSession(); }
        else endStroop();
    }
}
function finishRoutineStep() {
    if (!routine || routine.waiting) return;
    routine.waiting=true; routine.completed++;
    clearInterval(routineInterval);
    $('routine-title').textContent=`${routineSteps[routine.index].label} completada`;
    $('routine-time').textContent='';
    $('routine-description').textContent='Continúa cuando estés listo.';
    $('routine-next').textContent=routine.index===2?'Ver resumen':'Siguiente ejercicio';
    $('routine-next').hidden=false; $('routine-next').focus();
}
function cancelRoutine() { if (routine) completeRoutine('interrupted'); }
function lockRoutineControls(locked) {
    document.querySelectorAll('#breath-btn, #timer-btn, [data-timer-minutes]').forEach(button => button.disabled = locked);
}
function completeRoutine(status) {
    const completed=routine.completed, started=routine.started;
    clearInterval(routineInterval); routine=null;
    cancelExercise();
    if(isBreathing) toggleBreathing();
    if(isAudioPlaying) toggleAudio();
    if(isBrownNoisePlaying) toggleBrownNoise();
    if(isTimerActive) toggleTimer();
    $('routine-start').disabled=false; $('difficulty').disabled=false; $('routine-progress').hidden=true;
    lockRoutineControls(false);
    const record={exercise:'routine',difficulty,mode:'routine',date:new Date().toISOString(),status,seconds:Math.round((performance.now()-started)/1000),correct:0,errors:0,score:completed,responseMs:null};
    appendHistory(record); showSessionResult(record);
    $('result-title').textContent=status==='completed'?'Rutina completada':'Rutina interrumpida';
    const task=$('global-task').value.trim();
    $('result-comparison').textContent=task?`Tu siguiente paso: ${task}`:'Vuelve a tu tarea cuando estés listo.';
    $('session-result').focus();
}

/**************************************************************
 * 7. NAVEGACIÓN Y CONFIGURACIONES GLOBALES
 **************************************************************/
function switchTab(targetTabId, fromRoutine = false) {
    if (routine && !fromRoutine) cancelRoutine();
    const currentTab = document.querySelector('.training-tab.is-active')?.id;
    if (currentTab !== `tab-btn-${targetTabId}`) cancelExercise();
    if (targetTabId !== 'calm-chamber' && isBreathing) toggleBreathing();

    // Ocultar todas las pestañas
    const panes = document.getElementsByClassName('tab-pane');
    for (let i = 0; i < panes.length; i++) {
        panes[i].classList.add('hidden');
        panes[i].classList.remove('block');
        panes[i].setAttribute('aria-hidden', 'true');
    }

    // Actualizar el estado de las pestañas
    const navButtons = document.querySelectorAll('.training-tab');
    navButtons.forEach(btn => {
        btn.classList.remove('is-active');
        btn.setAttribute('aria-selected', 'false');
        btn.setAttribute('tabindex', '-1');
    });

    // Si la pestaña destino NO es calm-chamber, detener el audio binaural y el ruido marrón
    // (El Sincronizador Neuro-Acústico vive en calm-chamber, por eso se excluye esa pestaña)
    if (targetTabId !== 'calm-chamber') {
        // Detener audio binaural si está activo
        if (isAudioPlaying) {
            if (leftOsc) { try { leftOsc.stop(); leftOsc.disconnect(); } catch(e) {} }
            if (rightOsc) { try { rightOsc.stop(); rightOsc.disconnect(); } catch(e) {} }
            isAudioPlaying = false;

            const audioBtn = document.getElementById('audio-btn');
            const audioBtnText = document.getElementById('audio-btn-text');
            const playIcon = document.getElementById('play-icon');
            if (audioBtn) audioBtn.className = "w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-500/20 flex justify-center items-center gap-2";
            if (audioBtn) audioBtn.setAttribute('aria-pressed', 'false');
            if (audioBtnText) audioBtnText.textContent = "Iniciar Binaural";
            if (playIcon) playIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />`;
        }

        // Detener ruido marrón si está activo
        if (isBrownNoisePlaying) {
            if (brownNoiseNode) { try { brownNoiseNode.stop(); brownNoiseNode.disconnect(); } catch(e) {} }
            isBrownNoisePlaying = false;

            const brownBtn = document.getElementById('brown-noise-btn');
            const brownStatus = document.getElementById('brown-noise-status');
            if (brownBtn) brownBtn.className = "w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold border border-slate-800 text-slate-300 transition-all flex items-center justify-center gap-2";
            if (brownBtn) brownBtn.setAttribute('aria-pressed', 'false');
            if (brownStatus) brownStatus.textContent = "Apagado";
        }
    }

    // Mostrar pestaña seleccionada
    const selectedPane = document.getElementById(`pane-${targetTabId}`);
    selectedPane.classList.remove('hidden');
    selectedPane.classList.add('block');
    selectedPane.setAttribute('aria-hidden', 'false');

    // Marcar la pestaña activa
    const activeBtn = document.getElementById(`tab-btn-${targetTabId}`);
    activeBtn.classList.add('is-active');
    activeBtn.setAttribute('aria-selected', 'true');
    activeBtn.setAttribute('tabindex', '0');

    // En móvil, al cambiar desde un ejercicio largo, llevar el nuevo módulo
    // al inicio para que sus instrucciones y controles queden visibles.
    if (!fromRoutine && currentTab !== activeBtn.id && window.matchMedia('(max-width: 760px)').matches) {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        requestAnimationFrame(() => $('workspace').scrollIntoView({
            behavior: reducedMotion ? 'auto' : 'smooth',
            block: 'start'
        }));
    }
}

// Guardar Tarea Global en LocalStorage
function saveGlobalTask(val) {
    safeStorage.setItem('cyber_zen_global_task', val);
    const status = document.getElementById('goal-status');
    if (!status) return;
    status.classList.add('visible');
    clearTimeout(saveGlobalTask.statusTimer);
    saveGlobalTask.statusTimer = setTimeout(() => status.classList.remove('visible'), 1400);
}

// Sistema de Notificaciones Flotantes (Toasts)
function showToast(message, icon = "💡") {
    const toast = document.getElementById('custom-toast');
    const toastText = document.getElementById('toast-text');
    const toastIcon = document.getElementById('toast-icon');

    toastText.textContent = message;
    toastIcon.textContent = icon;

    // Animar entrada
    toast.classList.add('is-visible');

    clearTimeout(showToast.hideTimer);
    showToast.hideTimer = setTimeout(() => {
        // Animar salida
        toast.classList.remove('is-visible');
    }, 3000);
}

let focusBoosterInitialized = false;

// Inicializar datos después de que los módulos dinámicos estén disponibles.
window.initializeFocusBooster = function() {
    if (focusBoosterInitialized) return;
    focusBoosterInitialized = true;

    // Cargar tarea guardada
    const savedTask = safeStorage.getItem('cyber_zen_global_task');
    if (savedTask) {
        document.getElementById('global-task').value = savedTask;
    }
    trainingHistory = readTrainingHistory();
    const legacy = [['memory', 'Memoria', 'niveles alcanzados'], ['stroop', 'Stroop', 'aciertos'], ['schulte', 'Schulte', 's']]
        .map(([key, label, unit]) => {
            const raw = safeStorage.getItem(`cyber_zen_rec_${key}`);
            const value = Number(raw);
            return raw !== null && Number.isFinite(value) && value > 0 ? `${label}: ${value} ${unit}` : null;
        }).filter(Boolean);
    if (legacy.length) {
        $('legacy-records').hidden = false;
        $('legacy-values').textContent = legacy.join(' · ');
    }
    const savedDifficulty = safeStorage.getItem('gym_difficulty');
    difficulty = difficultyLevels[savedDifficulty] ? savedDifficulty : 'normal';
    updateDifficultyUI();
    renderHistory();
    $('routine-start').disabled = false;
    $('difficulty').disabled = false;
    $('workspace').tabIndex = -1;
    setTimer(25);

    const tabs = Array.from(document.querySelectorAll('.training-tab'));
    const compactNavigation = window.matchMedia('(max-width: 760px)');
    const updateTabOrientation = () => document.querySelector('[role="tablist"]')
        .setAttribute('aria-orientation', compactNavigation.matches ? 'horizontal' : 'vertical');
    updateTabOrientation();
    compactNavigation.addEventListener('change', updateTabOrientation);
    tabs.forEach((tab, index) => {
        tab.addEventListener('keydown', event => {
            if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();

            let nextIndex = index;
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % tabs.length;
            if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + tabs.length) % tabs.length;
            if (event.key === 'Home') nextIndex = 0;
            if (event.key === 'End') nextIndex = tabs.length - 1;

            const targetId = tabs[nextIndex].id.replace('tab-btn-', '');
            switchTab(targetId);
            tabs[nextIndex].focus();
        });
    });

    // Iniciar en la pestaña de calma
    switchTab('calm-chamber');

    // Do not let suspended callbacks silently continue a timed exercise.
    const interruptVisit = () => {
        if (routine) cancelRoutine();
        else cancelExercise();
        if (isBreathing) toggleBreathing();
        if (isAudioPlaying) toggleAudio();
        if (isBrownNoisePlaying) toggleBrownNoise();
        if (isTimerActive) toggleTimer();
    };
    document.addEventListener('visibilitychange', () => { if (document.hidden) interruptVisit(); });
    window.addEventListener('pagehide', interruptVisit);
}
