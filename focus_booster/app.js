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
 * 4. ACTIVIDAD COGNITIVA 1 - MATRIZ DE MEMORIA
 **************************************************************/
let gameSequence = [];
let playerSequence = [];
let gameActive = false;
let gameLevel = 1;
let gameScore = 0;
const totalCells = 9;

function startGame() {
    initAudioContext();
    const btn = document.getElementById('game-btn');
    gameActive = true;
    gameLevel = 1;
    gameScore = 0;
    document.getElementById('game-level').textContent = gameLevel;
    document.getElementById('game-score').textContent = gameScore;
    updateGameStatus('Observa el patrón.');

    btn.textContent = "Observa el Patrón...";
    btn.disabled = true;
    btn.className = "w-full max-w-xs py-4 rounded-xl bg-slate-950/40 border border-slate-800 text-slate-500 font-medium text-xs transition-all cursor-not-allowed";

    generateNextSequence();
}

function generateNextSequence() {
    playerSequence = [];
    gameSequence = [];
    const sequenceLength = 2 + gameLevel;

    for (let i = 0; i < sequenceLength; i++) {
        gameSequence.push(Math.floor(Math.random() * totalCells));
    }
    playSequence();
}

function playSequence() {
    disableAllCells(true);
    let delay = 600 - (gameLevel * 15); // Acelera levemente con niveles altos
    if (delay < 250) delay = 250;

    gameSequence.forEach((cellIdx, i) => {
        setTimeout(() => {
            flashCell(cellIdx);
        }, (i + 1) * delay);
    });

    setTimeout(() => {
        disableAllCells(false);
        const btn = document.getElementById('game-btn');
        btn.textContent = "Tu Turno - Repite";
        updateGameStatus('Tu turno. Repite la secuencia.');
    }, (gameSequence.length + 1) * delay);
}

function flashCell(idx) {
    const cell = document.getElementsByClassName('grid-cell')[idx];
    cell.classList.remove('bg-slate-800/80', 'border-slate-700/60');
    cell.classList.add(
        'bg-indigo-500', 'scale-[1.06]',
        'shadow-[0_0_28px_8px_rgba(99,102,241,0.75)]',
        'border-indigo-300', 'brightness-125'
    );

    playSoftNote(200 + (idx * 50), 0.25);

    setTimeout(() => {
        cell.classList.remove(
            'bg-indigo-500', 'scale-[1.06]',
            'shadow-[0_0_28px_8px_rgba(99,102,241,0.75)]',
            'border-indigo-300', 'brightness-125'
        );
        cell.classList.add('bg-slate-800/80', 'border-slate-700/60');
    }, 380);
}

function cellClicked(idx) {
    if (!gameActive) return;

    const cell = document.getElementsByClassName('grid-cell')[idx];

    // Marcar la celda seleccionada con color visible y permanente
    cell.classList.remove('bg-slate-800/80', 'border-slate-700/60');
    cell.classList.add(
        'bg-emerald-500', 'scale-[1.04]',
        'shadow-[0_0_20px_6px_rgba(16,185,129,0.6)]',
        'border-emerald-400'
    );
    playSoftNote(300 + (idx * 40), 0.12);

    playerSequence.push(idx);
    const currentMoveIndex = playerSequence.length - 1;

    if (playerSequence[currentMoveIndex] !== gameSequence[currentMoveIndex]) {
        // Marcar el error en rojo antes del game over
        cell.classList.remove(
            'bg-emerald-500', 'shadow-[0_0_20px_6px_rgba(16,185,129,0.6)]', 'border-emerald-400'
        );
        cell.classList.add(
            'bg-red-500', 'shadow-[0_0_20px_6px_rgba(239,68,68,0.7)]', 'border-red-400'
        );
        setTimeout(() => gameOver(), 400);
        return;
    }

    if (playerSequence.length === gameSequence.length) {
        gameScore++;
        gameLevel++;
        document.getElementById('game-level').textContent = gameLevel;
        document.getElementById('game-score').textContent = gameScore;

        // Guardar récord de Memoria
        saveRecord('memory', gameLevel);

        disableAllCells(true);
        const btn = document.getElementById('game-btn');
        btn.textContent = "¡Perfecto! Siguiente nivel...";
        updateGameStatus(`Correcto. Preparando el nivel ${gameLevel}.`);

        // Flash de éxito en todos los cuadros seleccionados antes de limpiar
        const cells = document.getElementsByClassName('grid-cell');
        for (let i = 0; i < cells.length; i++) {
            cells[i].classList.remove('bg-emerald-500', 'shadow-[0_0_20px_6px_rgba(16,185,129,0.6)]', 'border-emerald-400');
            cells[i].classList.add('bg-indigo-400', 'shadow-[0_0_16px_4px_rgba(129,140,248,0.5)]', 'border-indigo-300');
        }
        setTimeout(() => {
            resetAllCells();
            generateNextSequence();
        }, 700);
    }
}

function disableAllCells(disabled) {
    const cells = document.getElementsByClassName('grid-cell');
    for (let i = 0; i < cells.length; i++) {
        cells[i].disabled = disabled;
    }
}

function resetAllCells() {
    const cells = document.getElementsByClassName('grid-cell');
    for (let i = 0; i < cells.length; i++) {
        cells[i].className = 'grid-cell bg-slate-800/80 hover:bg-slate-700/80 aspect-square rounded-2xl transition-all duration-100 border border-slate-700/60 disabled:opacity-90 disabled:cursor-not-allowed cursor-pointer';
    }
}

function gameOver() {
    gameActive = false;
    disableAllCells(true);

    const grid = document.getElementById('grid-container');
    grid.classList.add('ring-4', 'ring-red-500/60');
    setTimeout(() => {
        grid.classList.remove('ring-4', 'ring-red-500/60');
        resetAllCells();
    }, 700);

    const btn = document.getElementById('game-btn');
    btn.disabled = false;
    btn.textContent = `Fallo. Racha final: ${gameScore}. ¿Reiniciar?`;
    btn.className = "w-full max-w-xs py-4 rounded-xl bg-gradient-to-r from-red-500 to-indigo-600 hover:from-red-600 text-white font-bold text-xs shadow-lg";
    updateGameStatus(`Secuencia incorrecta. Racha final: ${gameScore}.`);

    playSoftNote(150, 0.6);
    showToast(`Fin de partida. Nivel alcanzado: ${gameLevel}`, "🛑");
}

function updateGameStatus(message) {
    const status = document.getElementById('game-status');
    if (status) status.textContent = message;
}


/**************************************************************
 * 5. ACTIVIDAD COGNITIVA 2 - DESAFÍO STROOP
 **************************************************************/
const stroopColors = [
    { key: 'red',    name: 'Rojo',     textClass: 'text-red-500' },
    { key: 'blue',   name: 'Azul',     textClass: 'text-blue-500' },
    { key: 'green',  name: 'Verde',    textClass: 'text-emerald-400' },
    { key: 'yellow', name: 'Amarillo', textClass: 'text-yellow-400' }
];

let stroopScore = 0;
let stroopTimeLeft = 30;
let stroopInterval = null;
let stroopGameActive = false;
let currentTargetColorKey = '';

function startStroop() {
    initAudioContext();
    stroopScore = 0;
    stroopTimeLeft = 30;
    stroopGameActive = true;

    document.getElementById('stroop-score').textContent = stroopScore;
    document.getElementById('stroop-timer').textContent = `${stroopTimeLeft}s`;

    document.getElementById('stroop-start-btn').classList.add('hidden');
    document.getElementById('stroop-controls').classList.remove('hidden');
    document.getElementById('stroop-status').textContent = 'Prueba en curso. Responde con el color de la tinta.';

    nextStroopQuestion();

    stroopInterval = setInterval(() => {
        stroopTimeLeft--;
        document.getElementById('stroop-timer').textContent = `${stroopTimeLeft}s`;

        if (stroopTimeLeft <= 0) {
            clearInterval(stroopInterval);
            endStroop();
        }
    }, 1000);
    showToast("Prueba Stroop: ¡Presiona el color de la tinta!", "🎨");
}

function nextStroopQuestion() {
    // Pick un nombre de color y una tinta de color (generalmente no coinciden)
    const nameIdx = Math.floor(Math.random() * stroopColors.length);
    let inkIdx = Math.floor(Math.random() * stroopColors.length);

    // 75% de probabilidad de discordancia para asegurar que ocurra el efecto Stroop
    if (inkIdx === nameIdx && Math.random() < 0.75) {
        inkIdx = (inkIdx + 1) % stroopColors.length;
    }

    const wordDisplay = document.getElementById('stroop-word');
    wordDisplay.textContent = stroopColors[nameIdx].name;

    // Resetear clases completamente para evitar residuos de partidas anteriores (ej: text-rose-500 de endStroop)
    wordDisplay.className = `text-5xl font-black tracking-widest uppercase transition-all duration-100 select-none ${stroopColors[inkIdx].textClass}`;

    currentTargetColorKey = stroopColors[inkIdx].key;
}

function stroopAnswer(selectedKey) {
    if (!stroopGameActive) return;

    if (selectedKey === currentTargetColorKey) {
        stroopScore++;
        document.getElementById('stroop-score').textContent = stroopScore;
        playSoftNote(800, 0.1);

        // Guardar récord de Stroop
        saveRecord('stroop', stroopScore);
        document.getElementById('stroop-status').textContent = 'Correcto.';
    } else {
        // Penalización de tiempo (-2 seg) por respuesta incorrecta
        stroopTimeLeft = Math.max(0, stroopTimeLeft - 2);
        document.getElementById('stroop-timer').textContent = `${stroopTimeLeft}s`;
        playSoftNote(150, 0.2);
        document.getElementById('stroop-status').textContent = 'Incorrecto. Penalización de dos segundos.';
    }
    nextStroopQuestion();
}

function endStroop() {
    stroopGameActive = false;
    document.getElementById('stroop-word').textContent = "¡TIEMPO COMPLETO!";
    document.getElementById('stroop-word').className = "text-3xl font-black text-rose-500";

    document.getElementById('stroop-start-btn').classList.remove('hidden');
    document.getElementById('stroop-start-btn').textContent = "¿Volver a probar?";
    document.getElementById('stroop-controls').classList.add('hidden');
    document.getElementById('stroop-status').textContent = `Tiempo completo. Puntuación: ${stroopScore}.`;

    showToast(`Puntuación Stroop final: ${stroopScore} aciertos`, "⚡");
}


/**************************************************************
 * 6. ACTIVIDAD COGNITIVA 3 - TABLA DE SCHULTE
 **************************************************************/
let schulteNumbers = [];
let currentSchulteTarget = 1;
let schulteStartTime = null;
let schulteInterval = null;
let schulteGameActive = false;

function startSchulte() {
    initAudioContext();
    currentSchulteTarget = 1;
    schulteGameActive = true;
    document.getElementById('schulte-target').textContent = currentSchulteTarget;
    document.getElementById('schulte-timer').textContent = "00.0s";

    // Crear array 1 a 25 y desordenarlo
    schulteNumbers = Array.from({length: 25}, (_, i) => i + 1);
    shuffleArray(schulteNumbers);

    const grid = document.getElementById('schulte-grid');
    grid.innerHTML = ''; // Limpiar cuadrícula

    schulteNumbers.forEach(num => {
        const btn = document.createElement('button');
        btn.textContent = num;
        btn.className = "schulte-cell bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-extrabold text-sm md:text-base aspect-square rounded-lg transition-all flex items-center justify-center border border-slate-800/60 active:scale-95";
        btn.setAttribute('aria-label', `Número ${num}`);
        btn.onclick = () => clickedSchulte(num, btn);
        grid.appendChild(btn);
    });

    document.getElementById('schulte-start-btn').textContent = "Reiniciar Tabla";

    schulteStartTime = performance.now();
    if (schulteInterval) clearInterval(schulteInterval);

    schulteInterval = setInterval(() => {
        const elapsed = (performance.now() - schulteStartTime) / 1000;
        document.getElementById('schulte-timer').textContent = `${elapsed.toFixed(1)}s`;
    }, 100);
    showToast("Tabla Schulte: Busca en orden del 1 al 25", "👁️");
}

function clickedSchulte(num, buttonElement) {
    if (!schulteGameActive) return;

    if (num === currentSchulteTarget) {
        // Correcto
        buttonElement.classList.add('bg-emerald-500/20', 'text-emerald-400', 'border-emerald-500/40');
        buttonElement.disabled = true;

        playSoftNote(500 + (num * 20), 0.1);

        currentSchulteTarget++;
        if (currentSchulteTarget > 25) {
            endSchulte();
        } else {
            document.getElementById('schulte-target').textContent = currentSchulteTarget;
        }
    } else {
        // Error (Flash rojo rápido)
        buttonElement.classList.add('bg-red-500/20', 'border-red-500/40');
        playSoftNote(180, 0.15);
        setTimeout(() => {
            buttonElement.classList.remove('bg-red-500/20', 'border-red-500/40');
        }, 200);
    }
}

function endSchulte() {
    clearInterval(schulteInterval);
    schulteGameActive = false;
    const finalTime = ((performance.now() - schulteStartTime) / 1000).toFixed(2);
    document.getElementById('schulte-timer').textContent = `${finalTime}s`;
    document.getElementById('schulte-target').textContent = "¡Listo!";

    // Guardar récord de Schulte
    saveRecord('schulte', parseFloat(finalTime));

    showToast(`¡Completado en ${finalTime} segundos!`, "🎖️");
}

// Utilidad para desordenar un arreglo (Fisher-Yates Shuffle)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}


/**************************************************************
 * 7. NAVEGACIÓN Y CONFIGURACIONES GLOBALES
 **************************************************************/
function switchTab(targetTabId) {
    // Detener ejercicios que no deben seguir ejecutándose en segundo plano.
    if (targetTabId !== 'calm-chamber' && isBreathing) {
        toggleBreathing();
    }

    if (targetTabId !== 'neuro-matrix' && gameActive) {
        gameActive = false;
        disableAllCells(true);
        resetAllCells();
        const gameBtn = document.getElementById('game-btn');
        if (gameBtn) {
            gameBtn.disabled = false;
            gameBtn.textContent = 'Iniciar Gimnasia de Memoria';
            gameBtn.className = 'w-full max-w-xs py-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-500/25';
        }
        updateGameStatus('Sesión cancelada. Pulsa iniciar para comenzar de nuevo.');
    }

    if (targetTabId !== 'stroop-challenge' && stroopGameActive) {
        clearInterval(stroopInterval);
        stroopGameActive = false;
        stroopTimeLeft = 30;
        document.getElementById('stroop-timer').textContent = '30s';
        document.getElementById('stroop-word').textContent = 'PRESIONA INICIAR';
        document.getElementById('stroop-word').className = 'text-4xl md:text-5xl font-black tracking-widest uppercase transition-all duration-100 select-none text-slate-500';
        document.getElementById('stroop-start-btn').classList.remove('hidden');
        document.getElementById('stroop-start-btn').textContent = 'Iniciar Prueba Stroop';
        document.getElementById('stroop-controls').classList.add('hidden');
        document.getElementById('stroop-status').textContent = 'Sesión cancelada. Pulsa iniciar para comenzar de nuevo.';
    }

    if (targetTabId !== 'schulte-table' && schulteGameActive) {
        clearInterval(schulteInterval);
        schulteGameActive = false;
        document.getElementById('schulte-target').textContent = '1';
        document.getElementById('schulte-timer').textContent = '00.0s';
        document.getElementById('schulte-start-btn').textContent = 'Generar & Iniciar Tabla';
    }

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
}

// Guardar Tarea Global en LocalStorage
function saveGlobalTask(val) {
    localStorage.setItem('cyber_zen_global_task', val);
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

// Sistema para guardar y cargar récords desde LocalStorage
function saveRecord(type, score) {
    if (type === 'memory') {
        const currentRecord = parseInt(localStorage.getItem('cyber_zen_rec_memory') || '0');
        if (score > currentRecord) {
            localStorage.setItem('cyber_zen_rec_memory', score);
            updateRecordDisplays();
        }
    } else if (type === 'stroop') {
        const currentRecord = parseInt(localStorage.getItem('cyber_zen_rec_stroop') || '0');
        if (score > currentRecord) {
            localStorage.setItem('cyber_zen_rec_stroop', score);
            updateRecordDisplays();
        }
    } else if (type === 'schulte') {
        const currentRecord = parseFloat(localStorage.getItem('cyber_zen_rec_schulte') || '999.0');
        if (score < currentRecord) {
            localStorage.setItem('cyber_zen_rec_schulte', score);
            updateRecordDisplays();
        }
    }
}

function updateRecordDisplays() {
    const memRec = localStorage.getItem('cyber_zen_rec_memory') || '0';
    const stroopRec = localStorage.getItem('cyber_zen_rec_stroop') || '0';
    const schulteRec = localStorage.getItem('cyber_zen_rec_schulte') || '--';

    document.getElementById('stat-memory-record').textContent = `${memRec} niveles`;
    document.getElementById('stat-stroop-record').textContent = `${stroopRec} aciertos`;
    document.getElementById('stat-schulte-record').textContent = schulteRec !== '--' ? `${schulteRec} s` : '—';
}

let focusBoosterInitialized = false;

// Inicializar datos después de que los módulos dinámicos estén disponibles.
window.initializeFocusBooster = function() {
    if (focusBoosterInitialized) return;
    focusBoosterInitialized = true;

    // Cargar tarea guardada
    const savedTask = localStorage.getItem('cyber_zen_global_task');
    if (savedTask) {
        document.getElementById('global-task').value = savedTask;
    }
    updateRecordDisplays();
    setTimer(25);

    const tabs = Array.from(document.querySelectorAll('.training-tab'));
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
}
