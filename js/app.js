let userXP = 0;
let currentQuestId = 0;
let pendingNextQuest = null;
let autoStartTimer = null;
let AdController = null;

// Инициализация Telegram API
if (window.Telegram && window.Telegram.WebApp) {
    try {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
    } catch (e) {
        console.warn("Telegram WebApp initialization bypassed:", e);
    }
}

// Инициализация Adsgram
function initAdsgram() {
    if (window.Adsgram) {
        try {
            AdController = window.Adsgram.init({ blockId: "43184", debug: true });
        } catch (e) {
            console.error("Adsgram init error:", e);
        }
    }
}

// Безопасное сохранение прогресса
function saveProgress() {
    const unlockedQuestIds = quests.filter(q => q.unlocked).map(q => q.id);
    const data = {
        userXP: userXP,
        unlockedQuests: unlockedQuestIds
    };
    const jsonStr = JSON.stringify(data);

    // Сохраняем в локальное хранилище браузера
    try {
        localStorage.setItem('arcanum_game_data', jsonStr);
    } catch (e) {
        console.warn("Ошибка записи в localStorage:", e);
    }

    // Сохраняем в Telegram CloudStorage ТОЛЬКО если API действительно поддерживает метод
    try {
        if (window.Telegram?.WebApp?.isVersionAtLeast && 
            window.Telegram.WebApp.isVersionAtLeast('6.9') && 
            window.Telegram.WebApp.CloudStorage) {
            window.Telegram.WebApp.CloudStorage.setItem('arcanum_game_data', jsonStr);
        }
    } catch (e) {
        console.warn("CloudStorage не поддерживается текущим клиентом");
    }
}

// Безопасная загрузка прогресса
function loadProgress(callback) {
    let rawData = null;
    try {
        rawData = localStorage.getItem('arcanum_game_data');
    } catch (e) {
        console.warn("Ошибка чтения localStorage:", e);
    }

    applyData(rawData);

    if (callback) {
        callback();
    }
}

function applyData(rawData) {
    if (!rawData) return;
    try {
        const data = JSON.parse(rawData);
        if (data.userXP !== undefined) {
            userXP = data.userXP;
            const xpEl = document.getElementById('xp-count');
            if (xpEl) xpEl.innerText = userXP;
        }
        if (data.unlockedQuests && Array.isArray(data.unlockedQuests)) {
            quests.forEach(q => {
                if (data.unlockedQuests.includes(q.id)) {
                    q.unlocked = true;
                }
            });
        }
    } catch (e) {
        console.error("Ошибка чтения данных:", e);
    }
}

// Показ рекламы Adsgram
function showRewardAd() {
    if (!AdController) {
        initAdsgram();
    }

    if (!AdController) {
        showModal("Информация", "Рекламный модуль ещё загружается. Перезапустите страницу или попробуйте чуть позже.");
        return;
    }

    AdController.show().then((result) => {
        userXP += 30;
        const xpEl = document.getElementById('xp-count');
        if (xpEl) xpEl.innerText = userXP;
        saveProgress();
        showModal("Награда получена!", "Вы получили +30 к Силе Источника!");
    }).catch((error) => {
        let errorMsg = "Рекламное видео пока недоступно или просмотр не был завершен.";
        if (error && error.description) {
            errorMsg += " (" + error.description + ")";
        }
        showModal("Информация", errorMsg);
    });
}

function skipIntro() {
    if (autoStartTimer) clearTimeout(autoStartTimer);
    switchMode('menu-screen');
}

window.onload = function() {
    initAdsgram();
    
    // Загружаем данные и рендерим карту
    loadProgress(() => {
        renderMapTree();
        renderArcanumGrid();
    });

    // Резервный вызов рендера
    setTimeout(() => {
        renderMapTree();
        renderArcanumGrid();
    }, 300);

    autoStartTimer = setTimeout(skipIntro, 1200);
};

function switchMode(targetScreenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
    const target = document.getElementById(targetScreenId);
    if (target) target.classList.add('active-screen');

    document.querySelectorAll('.btn-nav-mode').forEach(btn => btn.classList.remove('active'));
    
    if (targetScreenId === 'menu-screen') {
        document.querySelectorAll('.btn-nav-mode:nth-child(1)').forEach(b => b.classList.add('active'));
    } else if (targetScreenId === 'arcanum-screen') {
        document.querySelectorAll('.btn-nav-mode:nth-child(2)').forEach(b => b.classList.add('active'));
    }
}

function goToScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active-screen');
}

function renderMapTree() {
    const container = document.getElementById('map-tree');
    if (!container) return;
    container.innerHTML = '';

    quests.forEach((q, index) => {
        const node = document.createElement('div');
        node.className = `path-node ${q.unlocked ? '' : 'locked'}`;
        
        if (q.unlocked) {
            node.innerText = q.num;
            node.onclick = () => startQuest(q.id);
        } else {
            node.innerText = '';
        }

        const label = document.createElement('div');
        label.className = 'node-label';
        label.innerText = q.name;
        node.appendChild(label);

        container.appendChild(node);

        if (index < quests.length - 1) {
            const sep = document.createElement('div');
            sep.className = 'node-separator';
            container.appendChild(sep);
        }
    });
}

function renderArcanumGrid() {
    const grid = document.getElementById('cards-grid-container');
    if (!grid) return;
    grid.innerHTML = '';

    if (typeof arcanumData === 'undefined') return;

    arcanumData.forEach(card => {
        const cardEl = document.createElement('div');
        cardEl.className = 'arcanum-card';
        cardEl.onclick = () => showArcanumDetails(card);

        cardEl.innerHTML = `
            <img src="${card.image}" alt="${card.name}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'75\' height=\'110\'><rect width=\'100%\' height=\'100%\' fill=\'%231d0f2b\'/><text x=\'50%\' y=\'50%\' font-size=\'14\' fill=\'%23e2c974\' text-anchor=\'middle\'></text></svg>'">
            <strong style="font-size:13px;">${card.name}</strong>
            <span class="arcanum-num-tag">${card.num} АРКАН</span>
        `;

        grid.appendChild(cardEl);
    });
}

function startQuest(id) {
    const quest = quests.find(q => q.id === id);
    if (!quest || !quest.unlocked) return;

    currentQuestId = id;
    document.getElementById('level-badge').innerText = quest.num + " Аркан";
    document.getElementById('level-title').innerText = quest.title;
    document.getElementById('level-text').innerText = quest.text;

    const imgEl = document.getElementById('level-image');
    if (quest.image) {
        imgEl.src = quest.image;
        imgEl.style.display = 'block';
    } else {
        imgEl.style.display = 'none';
    }

    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';

    quest.choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'btn-choice';
        btn.innerText = choice.text;
        btn.onclick = () => handleChoice(choice);
        optionsContainer.appendChild(btn);
    });

    goToScreen('game-screen');
}

function handleChoice(choice) {
    const quest = quests.find(q => q.id === currentQuestId);

    if (choice.isCorrect) {
        userXP += 15;
        const xpEl = document.getElementById('xp-count');
        if (xpEl) xpEl.innerText = userXP;

        const nextQuest = quests.find(q => q.id === currentQuestId + 1);
        if (nextQuest) {
            nextQuest.unlocked = true;
            pendingNextQuest = nextQuest.id;
        } else {
            pendingNextQuest = null;
        }

        saveProgress();
        renderMapTree();
        showModal("Мудрое решение!", choice.msg, quest ? quest.image : '');
    } else {
        pendingNextQuest = null;
        showModal("Подумай ещё...", choice.msg, quest ? quest.image : '');
    }
}

function showArcanumDetails(card) {
    showModal(`${card.num} Аркан: ${card.name}`, card.desc, card.image);
}

function showModal(title, text, imageSrc = '') {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-text').innerText = text;

    const imgEl = document.getElementById('modal-image');
    if (imageSrc) {
        imgEl.src = imageSrc;
        imgEl.style.display = 'inline-block';
    } else {
        imgEl.style.display = 'none';
    }

    const modal = document.getElementById('custom-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
}

function closeModal() {
    const modal = document.getElementById('custom-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
    
    // Всегда возвращаемся к карте после ответа
    goToScreen('menu-screen');
    renderMapTree();
}
