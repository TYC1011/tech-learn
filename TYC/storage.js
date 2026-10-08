// 玩家資料儲存、伺服器分流、ID自動分配、伺服器題數設定與後台匯出模組 (LocalStorage 持久化)

// 成就定義表 (🏅一般成就 8 項、🏆隱藏成就 2 項)
const ACHIEVEMENTS_DEF = {
    '🏅01': { id: '🏅01', name: '逃離森林與熊', desc: '通過迷霧森林', type: 'general' },
    '🏅02': { id: '🏅02', name: '迷林中的導航', desc: '迷霧森林拿到3星', type: 'general' },
    '🏅03': { id: '🏅03', name: '獲得最強武器', desc: '通過魔法村莊 (獲得傳說之劍)', type: 'general' },
    '🏅04': { id: '🏅04', name: '附魔師的祝福', desc: '魔法村莊拿到3星', type: 'general' },
    '🏅05': { id: '🏅05', name: '獲得最強防具', desc: '通過神殿秘寶 (獲得重生之盾)', type: 'general' },
    '🏅06': { id: '🏅06', name: '突破重重石門', desc: '神殿秘寶拿到3星', type: 'general' },
    '🏅07': { id: '🏅07', name: '不放棄的精神', desc: '擊敗魔龍後，將錯題重新完成 (若沒錯題則自動獲得)', type: 'general' },
    '🏅08': { id: '🏅08', name: '王國的真勇者', desc: '擊敗魔龍解救人質', type: 'general' },
    '🏆01': { id: '🏆01', name: '傳說級勇者', desc: '未失誤任何一次就擊敗魔龍 (魔王關0失誤通關)', type: 'hidden' },
    '🏆02': { id: '🏆02', name: '超快速勇者', desc: '第一關到第三關通關時間總和小於題數總和*5秒', type: 'hidden' }
};

const StorageManager = {
    USERS_KEY: 'TYC_MATH_RPG_USERS_V2',
    COUNTER_KEY: 'TYC_MATH_RPG_ID_COUNTER_V2',
    GUEST_COUNTER_KEY: 'TYC_MATH_RPG_GUEST_COUNTER_V2',
    SERVER_CONFIGS_KEY: 'TYC_MATH_RPG_SERVER_CONFIGS_V2',
    RESERVATIONS_KEY: 'TYC_MATH_RPG_RESERVATIONS_V2',
    SESSION_KEY: 'TYC_MATH_RPG_CURRENT_USER_V2',
    ADMIN_PWD: 'TYC1011',
    ACHIEVEMENTS_DEF,

    // ==========================================
    // ID 生成器：AAA11111 ~ ZZZ99999 (僅供正式註冊玩家使用)
    // 每組英文字母前綴包含 11111 ~ 99999 共 88,889 個數字
    // ==========================================
    indexToId(index) {
        const numbersPerPrefix = 88889; // 99999 - 11111 + 1
        const prefixIndex = Math.floor(index / numbersPerPrefix);
        const numOffset = (index % numbersPerPrefix) + 11111;

        const c1 = String.fromCharCode(65 + Math.floor(prefixIndex / (26 * 26)) % 26);
        const c2 = String.fromCharCode(65 + Math.floor(prefixIndex / 26) % 26);
        const c3 = String.fromCharCode(65 + (prefixIndex % 26));

        return `${c1}${c2}${c3}${numOffset}`;
    },

    idToIndex(id) {
        if (!/^[A-Z]{3}[0-9]{5}$/.test(id)) return -1;
        const p1 = id.charCodeAt(0) - 65;
        const p2 = id.charCodeAt(1) - 65;
        const p3 = id.charCodeAt(2) - 65;
        const prefixIndex = p1 * 26 * 26 + p2 * 26 + p3;
        const num = parseInt(id.slice(3), 10);
        if (num < 11111 || num > 99999) return -1;
        return prefixIndex * 88889 + (num - 11111);
    },

    // 取得當前全域流水號計數器
    getIdCounter() {
        try {
            const val = localStorage.getItem(this.COUNTER_KEY);
            return val ? parseInt(val, 10) : 0;
        } catch (e) {
            return 0;
        }
    },

    setIdCounter(val) {
        try {
            localStorage.setItem(this.COUNTER_KEY, String(val));
        } catch (e) {}
    },

    getReservations() {
        try {
            const data = localStorage.getItem(this.RESERVATIONS_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            return {};
        }
    },

    saveReservations(res) {
        try {
            localStorage.setItem(this.RESERVATIONS_KEY, JSON.stringify(res));
        } catch (e) {}
    },

    // 自動分配下一個正式玩家 ID (空缺遞補、未註冊前進、後按註冊為後一位)
    allocateNextId() {
        const users = this.getUsers();
        const reservations = this.getReservations();
        const now = Date.now();
        const EXPIRY_MS = 5 * 60 * 1000; // 5分鐘保留期

        // 清理過期保留
        for (const id in reservations) {
            if (now - reservations[id] > EXPIRY_MS) {
                delete reservations[id];
            }
        }

        const existingIndices = new Set();
        for (const uid in users) {
            const idx = this.idToIndex(uid);
            if (idx >= 0) existingIndices.add(idx);
        }

        const reservedIndices = new Set();
        for (const id in reservations) {
            const idx = this.idToIndex(id);
            if (idx >= 0) reservedIndices.add(idx);
        }

        let counter = this.getIdCounter();

        // 搜尋 0 ~ counter-1 範圍內的最小空缺 (未被註冊且未被保留)
        for (let i = 0; i < counter; i++) {
            if (!existingIndices.has(i) && !reservedIndices.has(i)) {
                const freeId = this.indexToId(i);
                reservations[freeId] = now;
                this.saveReservations(reservations);
                return freeId;
            }
        }

        // 若無空缺，使用當前 counter 並推進流水號
        const assignedId = this.indexToId(counter);
        this.setIdCounter(counter + 1);
        reservations[assignedId] = now;
        this.saveReservations(reservations);
        return assignedId;
    },

    // ==========================================
    // 遊客編號管理 (0001 ~ 9999，不給 ID)
    // ==========================================
    getGuestCounter() {
        try {
            const val = localStorage.getItem(this.GUEST_COUNTER_KEY);
            return val ? parseInt(val, 10) : 1;
        } catch (e) {
            return 1;
        }
    },

    setGuestCounter(val) {
        try {
            localStorage.setItem(this.GUEST_COUNTER_KEY, String(val));
        } catch (e) {}
    },

    // ==========================================
    // 伺服器各關題數設定 (預設 5 / 10 / 10，每關至少 5 題)
    // ==========================================
    getServerConfigs() {
        try {
            const val = localStorage.getItem(this.SERVER_CONFIGS_KEY);
            return val ? JSON.parse(val) : {};
        } catch (e) {
            return {};
        }
    },

    getServerConfig(serverId) {
        serverId = this.formatServerId(serverId);
        const configs = this.getServerConfigs();
        const cfg = configs[serverId] || {};
        return {
            l1Count: Math.max(5, parseInt(cfg.l1Count, 10) || 5),
            l2Count: Math.max(5, parseInt(cfg.l2Count, 10) || 10),
            l3Count: Math.max(5, parseInt(cfg.l3Count, 10) || 10)
        };
    },

    setServerConfig(serverId, cfg) {
        serverId = this.formatServerId(serverId);
        const configs = this.getServerConfigs();
        configs[serverId] = {
            l1Count: Math.max(5, parseInt(cfg.l1Count, 10) || 5),
            l2Count: Math.max(5, parseInt(cfg.l2Count, 10) || 10),
            l3Count: Math.max(5, parseInt(cfg.l3Count, 10) || 10)
        };
        try {
            localStorage.setItem(this.SERVER_CONFIGS_KEY, JSON.stringify(configs));
        } catch (e) {}
    },

    // 規範化伺服器編號 (001~999)
    formatServerId(s) {
        let num = parseInt(s, 10);
        if (isNaN(num) || num < 1) num = 1;
        if (num > 999) num = 999;
        return String(num).padStart(3, '0');
    },

    // 取得所有使用者清單
    getUsers() {
        try {
            const data = localStorage.getItem(this.USERS_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('Failed to load users', e);
            return {};
        }
    },

    resolveUserKey(idOrKey) {
        if (!idOrKey) {
            const cur = this.getCurrentUser();
            if (cur) return cur.isGuest ? (cur.guestKey || cur.id) : cur.id;
            return '';
        }
        if (typeof idOrKey === 'object') {
            return idOrKey.isGuest ? (idOrKey.guestKey || idOrKey.id) : idOrKey.id;
        }
        const users = this.getUsers();
        if (users[idOrKey]) return idOrKey;
        for (const k in users) {
            if (users[k].id === idOrKey || users[k].guestKey === idOrKey) return k;
        }
        return idOrKey;
    },

    getUser(userId) {
        const key = this.resolveUserKey(userId);
        const users = this.getUsers();
        return users[key] || users[userId] || null;
    },

    saveUsers(users) {
        try {
            localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        } catch (e) {
            console.error('Failed to save users', e);
        }
    },

    isValidUsername(name) {
        return typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 5;
    },

    isValidPassword(pwd) {
        return /^[a-zA-Z0-9]{1,10}$/.test(pwd);
    },

    // 註冊玩家：自動配發 ID (AAA11111 ~ ZZZ99999)
    register(serverId, username, password) {
        serverId = this.formatServerId(serverId);
        username = (username || '').trim();
        password = (password || '').trim();

        // 先推進流水號
        const assignedId = this.allocateNextId();

        if (!this.isValidUsername(username)) {
            return { success: false, message: '用戶名必須在 5 個字以內！' };
        }
        if (!this.isValidPassword(password)) {
            return { success: false, message: '密碼必須為 10 位以內的英文或數字組合！' };
        }

        const users = this.getUsers();

        // 同伺服器內檢查用戶名是否重複
        for (const uid in users) {
            if (users[uid].serverId === serverId && users[uid].username === username) {
                return { success: false, message: `伺服器 [${serverId}] 內已有同名勇者「${username}」，請換一個名字！` };
            }
        }

        const newUser = {
            id: assignedId,
            serverId,
            username,
            password,
            isGuest: false,
            createdAt: new Date().toISOString(),
            stats: {
                level1: { bestScore: 0, bestStars: 0, minTime: null, minErrors: null, retryCount: 0, clearCount: 0 },
                level2: { bestScore: 0, bestStars: 0, minTime: null, minErrors: null, retryCount: 0, clearCount: 0 },
                level3: { bestScore: 0, bestStars: 0, minTime: null, minErrors: null, retryCount: 0, clearCount: 0 },
                boss:   { bestScore: 0, bestStars: 0, minTime: null, minErrors: null, retryCount: 0, clearCount: 0 }
            },
            latestRecords: {},
            history: [],
            notebook: [],
            achievements: {
                general: {},
                hidden: {}
            },
            unlockedLevels: {
                level1: true,
                level2: false,
                level3: false,
                boss: false
            },
            inventory: {
                swordOfDoom: false, // 傳說之劍
                shieldOfRebirth: false // 重生之盾
            }
        };

        users[assignedId] = newUser;
        this.saveUsers(users);
        this.setCurrentUser(newUser);

        return { success: true, user: newUser, assignedId };
    },

    // 登入驗證 (支援 ID+密碼 或 伺服器+用戶名+密碼)
    login(serverId, account, password) {
        serverId = this.formatServerId(serverId);
        account = (account || '').trim();
        password = (password || '').trim();
        const users = this.getUsers();

        // 1. 若輸入的是 ID (大寫)
        const idKey = account.toUpperCase();
        if (users[idKey] && users[idKey].password === password) {
            this.setCurrentUser(users[idKey]);
            return { success: true, user: users[idKey] };
        }

        // 2. 若輸入的是 伺服器 + 用戶名
        for (const uid in users) {
            const u = users[uid];
            if (u.serverId === serverId && u.username === account && u.password === password) {
                this.setCurrentUser(u);
                return { success: true, user: u };
            }
        }

        return { success: false, message: '伺服器、帳號(ID/用戶名)或密碼不正確，請重新確認！' };
    },

    // 遊客登入 (編號 0001 ~ 9999，不給 ID，不佔用 AAA11111)
    loginAsGuest(serverId) {
        serverId = this.formatServerId(serverId);
        const currentCounter = this.getGuestCounter();
        const guestNum = String(currentCounter).padStart(4, '0');
        
        // 循環遞增遊客計數
        const nextCounter = currentCounter >= 9999 ? 1 : currentCounter + 1;
        this.setGuestCounter(nextCounter);

        const guestKey = `GUEST_${guestNum}_${Date.now()}`;
        const guestUser = {
            id: '', // 不給 ID
            guestKey: guestKey,
            guestNum: guestNum,
            serverId,
            username: `遊客${guestNum}`,
            isGuest: true,
            createdAt: new Date().toISOString(),
            stats: {
                level1: { bestScore: 0, bestStars: 0, minTime: null, minErrors: null, retryCount: 0, clearCount: 0 },
                level2: { bestScore: 0, bestStars: 0, minTime: null, minErrors: null, retryCount: 0, clearCount: 0 },
                level3: { bestScore: 0, bestStars: 0, minTime: null, minErrors: null, retryCount: 0, clearCount: 0 },
                boss:   { bestScore: 0, bestStars: 0, minTime: null, minErrors: null, retryCount: 0, clearCount: 0 }
            },
            latestRecords: {},
            history: [],
            notebook: [],
            achievements: {
                general: {},
                hidden: {}
            },
            unlockedLevels: {
                level1: true,
                level2: false,
                level3: false,
                boss: false
            },
            inventory: {
                swordOfDoom: false,
                shieldOfRebirth: false
            }
        };

        const users = this.getUsers();
        users[guestKey] = guestUser;
        this.saveUsers(users);
        this.setCurrentUser(guestUser);

        return guestUser;
    },

    setCurrentUser(user) {
        try {
            sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
        } catch (e) {}
    },

    getCurrentUser() {
        try {
            const data = sessionStorage.getItem(this.SESSION_KEY);
            if (!data) return null;
            const parsed = JSON.parse(data);
            const users = this.getUsers();
            const key = parsed.isGuest ? (parsed.guestKey || parsed.id) : parsed.id;
            return users[key] || parsed;
        } catch (e) {
            return null;
        }
    },

    logout() {
        try {
            sessionStorage.removeItem(this.SESSION_KEY);
        } catch (e) {}
    },

    // 累計重來次數
    recordRetry(userIdOrKey, levelKey) {
        const key = this.resolveUserKey(userIdOrKey);
        const users = this.getUsers();
        const u = users[key];
        if (!u || !u.stats[levelKey]) return;
        u.stats[levelKey].retryCount = (u.stats[levelKey].retryCount || 0) + 1;

        this.saveUsers(users);
        this.setCurrentUser(u);
    },

    // 紀錄錯題至筆記本 (在玩家未全部重新前可隨時查看)
    addNotebookEntry(userIdOrKey, entry) {
        const key = this.resolveUserKey(userIdOrKey);
        const users = this.getUsers();
        const u = users[key];
        if (!u) return;
        if (!u.notebook) u.notebook = [];
        u.notebook.push({
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            timestamp: new Date().toISOString(),
            levelKey: entry.levelKey || '',
            levelName: entry.levelName || '',
            expr: entry.expr || '',
            userChoice: entry.userChoice !== undefined ? String(entry.userChoice) : '',
            answer: entry.answer !== undefined ? String(entry.answer) : '',
            explanation: entry.explanation || '先乘除後加減、括號要先算！',
            solved: false
        });
        this.saveUsers(users);
        this.setCurrentUser(u);
    },

    // 更新錯題筆記狀態 (例如重新作答訂正完成)
    updateNotebookEntry(userIdOrKey, entryId, updates) {
        const key = this.resolveUserKey(userIdOrKey);
        const users = this.getUsers();
        const u = users[key];
        if (!u || !u.notebook) return false;
        const item = u.notebook.find(e => e.id === entryId);
        if (!item) return false;
        Object.assign(item, updates);
        this.saveUsers(users);
        this.setCurrentUser(u);
        return true;
    },

    // 檢查成就 🏅07 不放棄的精神 (擊敗魔龍後，將錯題重新完成。若沒錯題則自動得到)
    checkAchievement7(userIdOrKey) {
        const key = this.resolveUserKey(userIdOrKey);
        const users = this.getUsers();
        const u = users[key];
        if (!u) return false;
        const bossCleared = (u.stats?.boss?.clearCount || 0) > 0;
        if (!bossCleared) return false;

        // 若沒錯題則自動得到
        if (!u.notebook || u.notebook.length === 0) {
            return this.unlockAchievement(key, '🏅07');
        }

        // 若有錯題，檢查是否全部已訂正完成
        const allSolved = u.notebook.every(e => e.solved === true);
        if (allSolved) {
            return this.unlockAchievement(key, '🏅07');
        }
        return false;
    },

    // 解鎖成就 (一般成就 🏅 在全部重新後會消失，隱藏成就 🏆 永久保留)
    unlockAchievement(userIdOrKey, code) {
        const def = ACHIEVEMENTS_DEF[code];
        if (!def) return { newlyUnlocked: false };

        const key = this.resolveUserKey(userIdOrKey);
        const users = this.getUsers();
        const u = users[key];
        if (!u) return { newlyUnlocked: false };

        if (!u.achievements) {
            u.achievements = { general: {}, hidden: {} };
        }
        if (!u.achievements.general) u.achievements.general = {};
        if (!u.achievements.hidden) u.achievements.hidden = {};

        const targetBucket = def.type === 'hidden' ? u.achievements.hidden : u.achievements.general;
        if (targetBucket[code]) {
            return { newlyUnlocked: false, achievement: def }; // 已解鎖過
        }

        targetBucket[code] = {
            unlockedAt: new Date().toISOString(),
            name: def.name,
            desc: def.desc
        };

        this.saveUsers(users);
        this.setCurrentUser(u);

        if (typeof window !== 'undefined' && window.dispatchEvent) {
            try {
                window.dispatchEvent(new CustomEvent('achievementUnlocked', { detail: def }));
            } catch (e) {}
        }

        return { newlyUnlocked: true, achievement: def };
    },

    // 玩家選擇「全部重新」開始冒險 (重置當前進度、一般成就、筆記本；但保留最佳記錄、歷史遊玩紀錄、隱藏成就)
    resetAdventureProgress(userIdOrKey) {
        const key = this.resolveUserKey(userIdOrKey);
        const users = this.getUsers();
        const u = users[key];
        if (!u) return null;

        // 重置當前地圖解鎖狀態
        u.unlockedLevels = {
            level1: true,
            level2: false,
            level3: false,
            boss: false
        };

        // 重置裝備
        u.inventory = {
            swordOfDoom: false,
            shieldOfRebirth: false
        };

        // 清空當前輪錯題筆記本
        u.notebook = [];

        // 依要求：隱藏成就保留，一般成就清空重置
        if (u.achievements) {
            u.achievements.general = {};
        }

        this.saveUsers(users);
        this.setCurrentUser(u);
        return u;
    },

    // 紀錄關卡成績與遊玩歷史
    recordLevelResult(userIdOrKey, levelKey, result) {
        const key = this.resolveUserKey(userIdOrKey);
        const users = this.getUsers();
        const u = users[key];
        if (!u) return;
        const s = u.stats[levelKey];
        if (!s) return;

        // 更新最佳紀錄
        if (result.score > (s.bestScore || 0)) {
            s.bestScore = result.score;
        }
        if (result.stars > (s.bestStars || 0)) {
            s.bestStars = result.stars;
        }
        if (result.passed) {
            if (s.minErrors === null || result.errorCount < s.minErrors) {
                s.minErrors = result.errorCount;
            }
            if (s.minTime === null || result.timeSeconds < s.minTime) {
                s.minTime = result.timeSeconds;
            }
            s.clearCount = (s.clearCount || 0) + 1;

            if (levelKey === 'level1') {
                u.unlockedLevels.level2 = true;
            } else if (levelKey === 'level2' && result.passed) {
                u.unlockedLevels.level3 = true;
                u.inventory.swordOfDoom = true;
            } else if (levelKey === 'level3' && result.passed) {
                u.unlockedLevels.boss = true;
                u.inventory.shieldOfRebirth = true;
            } else if (levelKey === 'boss' && result.passed) {
                u.title = this.evaluateTitle(u);
            }
        }

        // 紀錄最新一次紀錄
        if (!u.latestRecords) u.latestRecords = {};
        u.latestRecords[levelKey] = {
            score: result.score,
            stars: result.stars,
            timeSeconds: result.timeSeconds,
            errorCount: result.errorCount,
            passed: result.passed,
            timestamp: new Date().toISOString()
        };

        // 紀錄至歷史列表
        if (!u.history) u.history = [];
        const levelNames = {
            level1: '第1關 迷霧森林',
            level2: '第2關 魔法村莊',
            level3: '第3關 神殿祕寶',
            boss: '魔王關 討伐魔龍'
        };
        u.history.unshift({
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            timestamp: new Date().toISOString(),
            levelKey,
            levelName: levelNames[levelKey] || levelKey,
            score: result.score,
            stars: result.stars,
            timeSeconds: result.timeSeconds,
            errorCount: result.errorCount,
            passed: result.passed
        });

        // 先儲存基礎關卡成績與統計資料
        this.saveUsers(users);
        this.setCurrentUser(u);

        // 觸發成就解鎖 (unlockAchievement 會讀取並持久化成就資料)
        if (result.passed) {
            if (levelKey === 'level1') {
                this.unlockAchievement(key, '🏅01'); // 通過迷霧森林
                if (result.stars === 3) this.unlockAchievement(key, '🏅02'); // 迷霧森林3星
            } else if (levelKey === 'level2') {
                this.unlockAchievement(key, '🏅03'); // 通過魔法村莊 (獲得傳說之劍)
                if (result.stars === 3) this.unlockAchievement(key, '🏅04'); // 魔法村莊3星
            } else if (levelKey === 'level3') {
                this.unlockAchievement(key, '🏅05'); // 通過神殿秘寶 (獲得重生之盾)
                if (result.stars === 3) this.unlockAchievement(key, '🏅06'); // 神殿秘寶3星
            } else if (levelKey === 'boss') {
                this.unlockAchievement(key, '🏅08'); // 擊敗魔龍解救人質
                // 隱藏成就 🏆01: 未失誤任何一次就擊敗魔龍
                if (result.errorCount === 0) {
                    this.unlockAchievement(key, '🏆01');
                }
                // 成就 🏅07: 擊敗魔龍後，將錯題重新完成 (若沒錯題則自動得到)
                this.checkAchievement7(key);
            }

            // 隱藏成就 🏆02: {第一關到第三關的通關時間總和} < {第一關到第三關的題數 * 5秒}
            const cfg = this.getServerConfig(u.serverId || '001');
            const totalReqQuestions = cfg.l1Count + cfg.l2Count + cfg.l3Count;
            const freshU = this.getUser(key) || u;
            const l1Time = freshU.stats.level1.minTime;
            const l2Time = freshU.stats.level2.minTime;
            const l3Time = freshU.stats.level3.minTime;
            if (l1Time !== null && l2Time !== null && l3Time !== null) {
                const sumTime = l1Time + l2Time + l3Time;
                if (sumTime < totalReqQuestions * 5) {
                    this.unlockAchievement(key, '🏆02');
                }
            }
        }
    },

    // 評定勇者專屬稱號
    evaluateTitle(user) {
        if (!user || !user.stats) return '新手冒險者 🗡️';
        const { level1, level2, level3, boss } = user.stats;
        if ((boss.clearCount || 0) === 0) {
            const sumScore = (level1.bestScore || 0) + (level2.bestScore || 0) + (level3.bestScore || 0);
            if (sumScore >= 200) return '神殿探索先鋒 ⚔️';
            return '王國見習勇者 🗡️';
        }

        const totalStars = (level1.bestStars || 0) + (level2.bestStars || 0) + (level3.bestStars || 0) + (boss.bestStars || 0);
        const totalScore = (level1.bestScore || 0) + (level2.bestScore || 0) + (level3.bestScore || 0) + (boss.bestScore || 0);
        const totalRetries = (level1.retryCount || 0) + (level2.retryCount || 0) + (level3.retryCount || 0) + (boss.retryCount || 0);
        const totalTime = ((level1.minTime || 0) + (level2.minTime || 0) + (level3.minTime || 0) + (boss.minTime || 0));

        if (totalStars >= 11 && totalScore >= 380 && totalRetries === 0) {
            return '神話級・算術大聖皇 👑';
        }
        if (totalTime > 0 && totalTime <= 180 && totalStars >= 10) {
            return '疾風迅雷・神速破法使 🌪️';
        }
        if (totalScore >= 350 || totalStars >= 10) {
            return '四則奧義・大魔導劍士 ⚡';
        }
        if (totalRetries >= 2) {
            return '浴火重生・鐵血聖騎士 🛡️';
        }
        return '王國守護・破龍大勇者 ⚔️';
    },

    verifyAdmin(password) {
        return password === this.ADMIN_PWD;
    },

    deleteUser(userIdOrKey) {
        const key = this.resolveUserKey(userIdOrKey);
        const users = this.getUsers();
        if (users[key]) {
            const uid = users[key].id;
            delete users[key];
            this.saveUsers(users);

            if (uid) {
                const reservations = this.getReservations();
                delete reservations[uid];
                this.saveReservations(reservations);
            }

            const cur = this.getCurrentUser();
            const curKey = cur ? (cur.isGuest ? (cur.guestKey || cur.id) : cur.id) : '';
            if (curKey === key) {
                this.logout();
            }
            return true;
        }
        return false;
    },

    // 清空所有資料，流水號重設回 0 (重新從 AAA11111 開始，遊客重設回 0001)
    clearAllData() {
        localStorage.removeItem(this.USERS_KEY);
        localStorage.removeItem(this.RESERVATIONS_KEY);
        this.setIdCounter(0);
        this.setGuestCounter(1);
        this.logout();
    },

    // 匯出 CSV 格式字串 (帶有 UTF-8 BOM，Excel 直接開啟不亂碼)
    exportCsv(serverFilter = 'all') {
        const users = Object.values(this.getUsers());
        const filtered = (serverFilter === 'all') 
            ? users 
            : users.filter(u => u.serverId === serverFilter);

        const headers = [
            '伺服器',
            '勇者ID',
            '用戶名',
            '身分',
            '獲封稱號',
            '第1關最高分',
            '第1關星數',
            '第1關最少秒數',
            '第1關最少錯誤',
            '第1關重來次數',
            '第1關通關次數',
            '第2關最高分',
            '第2關星數',
            '第2關最少秒數',
            '第2關最少錯誤',
            '第2關重來次數',
            '第2關通關次數',
            '第3關最高分',
            '第3關星數',
            '第3關最少秒數',
            '第3關最少錯誤',
            '第3關重來次數',
            '第3關通關次數',
            'Boss關最高分',
            'Boss關星數',
            'Boss關最少秒數',
            'Boss關最少錯誤',
            'Boss關重來次數',
            'Boss關通關次數',
            '累計重來總數',
            '全破救出人質',
            '建立時間'
        ];

        const rows = filtered.map(u => {
            const l1 = u.stats.level1;
            const l2 = u.stats.level2;
            const l3 = u.stats.level3;
            const b = u.stats.boss;
            const totalRetries = (l1.retryCount || 0) + (l2.retryCount || 0) + (l3.retryCount || 0) + (b.retryCount || 0);
            const isCompletedAll = (b.clearCount || 0) > 0 ? '是' : '否';
            const userTitle = u.title || this.evaluateTitle(u);
            const displayId = u.isGuest ? '無' : (u.id || '無');

            return [
                u.serverId || '001',
                displayId,
                `"${(u.username || '').replace(/"/g, '""')}"`,
                u.isGuest ? '遊客' : '正式勇者',
                `"${userTitle.replace(/"/g, '""')}"`,
                l1.bestScore || 0,
                l1.bestStars || 0,
                l1.minTime !== null ? l1.minTime : '',
                l1.minErrors !== null ? l1.minErrors : '',
                l1.retryCount || 0,
                l1.clearCount || 0,
                l2.bestScore || 0,
                l2.bestStars || 0,
                l2.minTime !== null ? l2.minTime : '',
                l2.minErrors !== null ? l2.minErrors : '',
                l2.retryCount || 0,
                l2.clearCount || 0,
                l3.bestScore || 0,
                l3.bestStars || 0,
                l3.minTime !== null ? l3.minTime : '',
                l3.minErrors !== null ? l3.minErrors : '',
                l3.retryCount || 0,
                l3.clearCount || 0,
                b.bestScore || 0,
                b.bestStars || 0,
                b.minTime !== null ? b.minTime : '',
                b.minErrors !== null ? b.minErrors : '',
                b.retryCount || 0,
                b.clearCount || 0,
                totalRetries,
                isCompletedAll,
                u.createdAt || ''
            ].join(',');
        });

        // 加上 UTF-8 BOM \uFEFF
        return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    }
};

if (typeof window !== 'undefined') {
    window.StorageManager = StorageManager;
    window.ACHIEVEMENTS_DEF = ACHIEVEMENTS_DEF;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
}
