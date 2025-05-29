import confetti from 'canvas-confetti';

const screens = {
    start: document.getElementById('start-screen'),
    game: document.getElementById('game-screen'),
    end: document.getElementById('end-screen'),
};

const buttons = {
    solo: document.getElementById('solo-btn'),
    vsPlayer: document.getElementById('vs-player-btn'),
    playAgain: document.getElementById('play-again-btn'),
    mainMenuGame: document.getElementById('main-menu-game-btn'),
    mainMenuEnd: document.getElementById('main-menu-end-btn'),
};

const gameBoard = document.getElementById('game-board');
const player1ScoreDisplay = document.getElementById('player1-score');
const player2ScoreDisplay = document.getElementById('player2-score');
const turnIndicator = document.getElementById('turn-indicator');
const soloMovesDisplay = document.getElementById('solo-moves');
const winnerMessage = document.getElementById('winner-message');

const player1InfoDiv = document.getElementById('player1-info');
const player2InfoDiv = document.getElementById('player2-info');
const soloMovesInfoDiv = document.getElementById('solo-moves-info');


const CARD_VALUES = ['apple', 'banana', 'cherry', 'grape', 'lemon', 'orange', 'pear', 'strawberry'];
const TOTAL_PAIRS = CARD_VALUES.length;

let gameMode = null; // 'solo' or 'vsPlayer'
let currentPlayer = 1;
let scores = { player1: 0, player2: 0 };
let soloMoves = 0;
let flippedCards = [];
let matchedPairs = 0;
let boardCards = [];
let isProcessing = false; // Prevents clicks during animations/checks

// Audio context and buffers
let audioContext;
const audioBuffers = {};
let backgroundMusicSource = null; // To control background music

async function loadSound(url) {
    if (!audioContext) return null;
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        return audioBuffer;
    } catch (error) {
        console.error(`Error loading sound: ${url}`, error);
        return null;
    }
}

function playSound(buffer, loop = false, volume = 1.0) {
    if (!audioContext || !buffer) return null;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;

    const gainNode = audioContext.createGain();
    gainNode.gain.value = volume;
    
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    source.loop = loop;
    source.start(0);
    return source;
}

async function initAudio() {
    if (audioContext) return; // Already initialized
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (!audioContext) {
        console.warn("Web Audio API is not supported in this browser.");
        return;
    }
    // Preload sounds
    const soundFiles = {
        button: './button-sound.mp3',
        flip: './card-flip.mp3',
        match: './match-found.mp3',
        noMatch: './no-match.mp3',
        win: './game-win.mp3',
        background: './background-music.mp3'
    };
    for (const key in soundFiles) {
        audioBuffers[key] = await loadSound(soundFiles[key]);
    }

    // Start background music if buffer is loaded
    if (audioBuffers.background && !backgroundMusicSource) {
        backgroundMusicSource = playSound(audioBuffers.background, true, 0.3); // Loop background music at 30% volume
    }
}

function showScreen(screenId) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenId].classList.add('active');
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function createCardElement(value, index) {
    const card = document.createElement('div');
    card.classList.add('card');
    card.dataset.value = value;
    card.dataset.index = index;

    const cardFaceFront = document.createElement('div');
    cardFaceFront.classList.add('card-face', 'card-front');
    const cardImage = document.createElement('img');
    cardImage.src = `./icon-${value}.png`;
    cardImage.alt = value;
    cardFaceFront.appendChild(cardImage);

    const cardFaceBack = document.createElement('div');
    cardFaceBack.classList.add('card-face', 'card-back');
    // Card back image is set via CSS

    card.appendChild(cardFaceFront);
    card.appendChild(cardFaceBack);

    card.addEventListener('click', () => handleCardClick(card));
    return card;
}

function renderBoard() {
    gameBoard.innerHTML = '';
    boardCards.forEach((value, index) => {
        const cardElement = createCardElement(value, index);
        gameBoard.appendChild(cardElement);
    });
}

function updateUI() {
    if (gameMode === 'solo') {
        soloMovesInfoDiv.style.display = 'block';
        player1InfoDiv.style.display = 'none';
        player2InfoDiv.style.display = 'none';
        turnIndicator.style.display = 'none';
        soloMovesDisplay.textContent = soloMoves;
        screens.game.dataset.mode = 'solo';
    } else if (gameMode === 'vsPlayer') {
        soloMovesInfoDiv.style.display = 'none';
        player1InfoDiv.style.display = 'flex'; 
        player2InfoDiv.style.display = 'flex';
        turnIndicator.style.display = 'block'; 
        player1ScoreDisplay.textContent = scores.player1;
        player2ScoreDisplay.textContent = scores.player2;
        turnIndicator.textContent = `Turno do Jogador ${currentPlayer}`;
        screens.game.dataset.mode = 'vsPlayer';

        // Clear previous highlights and inline styles related to highlighting
        player1InfoDiv.classList.remove('active-player');
        player2InfoDiv.classList.remove('active-player');
        
        // Reset any explicitly set inline border/shadow styles from previous logic version
        // This ensures that the CSS classes take full effect.
        player1InfoDiv.style.borderColor = ''; 
        player1InfoDiv.style.boxShadow = '';
        player2InfoDiv.style.borderColor = '';
        player2InfoDiv.style.boxShadow = '';

        if (currentPlayer === 1) {
            player1InfoDiv.classList.add('active-player');
        } else {
            player2InfoDiv.classList.add('active-player');
        }
    }
}

function startGame(mode) {
    gameMode = mode;
    currentPlayer = 1;
    scores = { player1: 0, player2: 0 };
    soloMoves = 0;
    matchedPairs = 0;
    flippedCards = [];
    isProcessing = false;

    const doubledValues = [...CARD_VALUES, ...CARD_VALUES];
    boardCards = shuffleArray(doubledValues);

    renderBoard();
    updateUI(); // Call updateUI after renderBoard
    showScreen('game');
    playSound(audioBuffers.button);
}

function handleCardClick(cardElement) {
    if (isProcessing || cardElement.classList.contains('flipped') || cardElement.classList.contains('matched')) {
        return;
    }

    playSound(audioBuffers.flip);
    cardElement.classList.add('flipped');
    flippedCards.push(cardElement);

    if (flippedCards.length === 2) {
        isProcessing = true;
        if (gameMode === 'solo') {
            soloMoves++;
            updateUI();
        }
        checkForMatch();
    }
}

function checkForMatch() {
    const [card1, card2] = flippedCards;
    if (card1.dataset.value === card2.dataset.value) {
        // Match found
        playSound(audioBuffers.match);
        card1.classList.add('matched');
        card2.classList.add('matched');
        matchedPairs++;

        if (gameMode === 'vsPlayer') {
            scores[`player${currentPlayer}`]++;
        }
        
        flippedCards = [];
        isProcessing = false;
        updateUI();
        checkGameOver();

    } else {
        // No match
        playSound(audioBuffers.noMatch);
        setTimeout(() => {
            card1.classList.remove('flipped');
            card2.classList.remove('flipped');
            flippedCards = [];
            if (gameMode === 'vsPlayer') {
                currentPlayer = currentPlayer === 1 ? 2 : 1;
            }
            isProcessing = false;
            updateUI();
        }, 1200);
    }
}

function checkGameOver() {
    if (matchedPairs === TOTAL_PAIRS) {
        playSound(audioBuffers.win);
        confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.6 }
        });
        setTimeout(() => { // Delay to allow confetti and sound
            if (gameMode === 'solo') {
                winnerMessage.textContent = `Você venceu em ${soloMoves} movimentos!`;
            } else {
                if (scores.player1 > scores.player2) {
                    winnerMessage.textContent = 'Jogador 1 Venceu!';
                } else if (scores.player2 > scores.player1) {
                    winnerMessage.textContent = 'Jogador 2 Venceu!';
                } else {
                    winnerMessage.textContent = 'Empate!';
                }
            }
            showScreen('end');
        }, 1500);
    }
}

function resetGame() {
    // This will take player to main menu, they can choose mode again or play again
    // If "Play Again" is clicked, it will restart with the *current* gameMode.
    showScreen('start');
    // Clear game board if necessary, though startGame will do it
    gameBoard.innerHTML = '';
}

// Event Listeners
buttons.solo.addEventListener('click', () => {
    initAudio(); // Initialize audio on first user interaction
    startGame('solo');
});
buttons.vsPlayer.addEventListener('click', () => {
    initAudio();
    startGame('vsPlayer');
});

buttons.playAgain.addEventListener('click', () => {
    playSound(audioBuffers.button);
    if (gameMode) { // Should always have a gameMode if on end screen
        startGame(gameMode);
    } else {
        resetGame(); // Fallback to main menu if something went wrong
    }
});

buttons.mainMenuGame.addEventListener('click', () => {
    playSound(audioBuffers.button);
    if (backgroundMusicSource) {
        // Optionally stop or pause music when returning to main menu if desired
        // For now, let it continue playing as it's a main menu too.
    }
    resetGame();
});
buttons.mainMenuEnd.addEventListener('click', () => {
    playSound(audioBuffers.button);
    if (backgroundMusicSource) {
        // Optionally stop or pause music
    }
    resetGame();
});

// Initial setup
showScreen('start');