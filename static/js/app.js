const API_BASE = "http://localhost:8000";

// ── helpers ──────────────────────────────────────────────────────────────────
function getUser() {
    try {
        const data = localStorage.getItem("user");
        return data ? JSON.parse(data) : null;
    } catch { return null; }
}
function setUser(user) { localStorage.setItem("user", JSON.stringify(user)); }
function clearUser() { localStorage.removeItem("user"); }

async function apiFetch(path, options = {}) {
    const headers = { ...options.headers };
    if (options.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }
    const res = await fetch(API_BASE + path, { ...options, headers });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
}

function getIconUrl(icon) {
    if (!icon) return "";
    
    // 1. Уже полный URL
    if (icon.startsWith("http://") || icon.startsWith("https://")) return icon;
    
    // 2. Эмодзи (не содержит расширение файла)
    if (!icon.match(/\.(svg|png|jpg|jpeg|webp|gif)$/i)) return icon;
    
    // Нормализуем путь — убираем ведущий слэш
    let path = icon.replace(/^\/+/, "");
    
    // 3. Убираем "static/" из начала, если есть
    path = path.replace(/^static\//, "");
    
    // 4. Убираем старые "icon/" — заменяем на "icons/"
    path = path.replace(/^icon\//, "icons/");
    
    // 5. Если путь не начинается с "icons/" — добавляем
    if (!path.startsWith("icons/")) {
        path = "icons/" + path;
    }
    
    // Финальный результат: API_BASE + /static/icons/имя_файла
    return `${API_BASE}/static/${path}`;

}

function isIconPath(icon) {
    return icon && /\.(svg|png|jpg|jpeg|webp|gif)$/i.test(icon);
}

// ── auth ─────────────────────────────────────────────────────────────────────
async function login(name, password) {
    const params = new URLSearchParams({ name, password });
    const res = await fetch(`${API_BASE}/api/login?${params}`, { method: "POST" });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(err.detail || "Ошибка входа");
    }
    const data = await res.json();
    if (data.user_id && data.role) {
        setUser({ id: data.user_id, username: name, role: data.role });
        return { id: data.user_id, username: name, role: data.role };
    }
    const profile = await findUserProfileByName(name);
    if (!profile) throw new Error("Не удалось найти пользователя");
    setUser({ id: profile.id, username: name, role: profile.role });
    return profile;
}

async function findUserProfileByName(username) {
    for (let id = 1; id <= 100; id++) {
        try {
            const res = await fetch(`${API_BASE}/api/user/profile?user_id=${id}`);
            if (res.ok) {
                const profile = await res.json();
                if (profile.username === username) {
                    return { id, username, role: profile.role };
                }
            }
        } catch (e) { }
    }
    return null;
}

async function register(name, password) {
    const params = new URLSearchParams({ name, password });
    const res = await fetch(`${API_BASE}/api/register?${params}`, { method: "POST" });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(err.detail || "Ошибка регистрации");
    }
    return res.json();
}

function logout() {
    clearUser();
    window.location.href = "auth.html";
}

// ── state ─────────────────────────────────────────────────────────────────────
let selectedCategory = null;
let currentTask = null;
let currentTab = "saved";

// ── views ─────────────────────────────────────────────────────────────────────
function showSection(id) {
    document.querySelectorAll(".view-section").forEach(s => s.classList.add("hidden"));
    const section = document.getElementById(id);
    if (section) section.classList.remove("hidden");
}

// ── admin panel ───────────────────────────────────────────────────────────────
async function initAdminPanel() {
    const user = getUser();
    const accessDenied = document.getElementById("admin-access-denied");
    const adminContent = document.getElementById("admin-content");
    
    if (!user) {
        window.location.href = "auth.html";
        return;
    }
    
    let isAdmin = user.role === "admin";
    if (!isAdmin) {
        try {
            const profile = await apiFetch(`/api/user/profile?user_id=${user.id}`);
            isAdmin = profile.role === "admin";
            if (isAdmin) setUser({ ...user, role: "admin" });
        } catch (e) { console.error("Ошибка проверки прав:", e); }
    }
    
    if (!isAdmin) {
        accessDenied.classList.remove("hidden");
        adminContent.classList.add("hidden");
        return;
    }
    
    accessDenied.classList.add("hidden");
    adminContent.classList.remove("hidden");
    
    await Promise.all([
        loadAdminCategories(),
        loadAdminIcons()
    ]);
    
    setupAdminForms();
}

async function loadAdminCategories() {
    try {
        const categories = await apiFetch("/api/categories");
        const listEl = document.getElementById("categories-list");
        const countEl = document.getElementById("categories-count");
        const selectEl = document.getElementById("task-category");
        
        if (countEl) countEl.textContent = categories.length;
        
        if (listEl) {
            if (categories.length === 0) {
                listEl.innerHTML = `<p class="empty-message">Пока нет категорий</p>`;
            } else {
                listEl.innerHTML = "";
                categories.forEach(cat => {
                    const item = document.createElement("div");
                    item.className = "admin-list-item";
                    
                    // ИСПОЛЬЗУЕМ НОВУЮ ФУНКЦИЮ getIconUrl
                    const iconUrl = getIconUrl(cat.icon);
                    const iconHtml = isIconPath(cat.icon)
                        ? `<img src="${iconUrl}" style="width:1.5rem;height:1.5rem;object-fit:contain;">`
                        : cat.icon;
                    
                    item.innerHTML = `
                        <div class="admin-list-item__icon">${iconHtml}</div>
                        <div class="admin-list-item__info">
                            <div class="admin-list-item__name">${cat.name}</div>
                            <div class="admin-list-item__slug">/${cat.slug}</div>
                        </div>
                    `;
                    listEl.appendChild(item);
                });
            }
        }
        
        if (selectEl) {
            selectEl.innerHTML = "";
            if (categories.length === 0) {
                selectEl.innerHTML = `<option value="">Сначала создайте категорию</option>`;
            } else {
                categories.forEach(cat => {
                    const opt = document.createElement("option");
                    opt.value = cat.id;
                    opt.textContent = cat.name;
                    selectEl.appendChild(opt);
                });
            }
        }
    } catch (e) { console.error("Ошибка загрузки категорий:", e); }
}

// ── ЗАГРУЗКА ИКОНОК ИЗ /static/icons/ ──
async function loadAdminIcons() {
    const selectEl = document.getElementById("cat-icon");
    const previewEl = document.getElementById("icon-preview");
    if (!selectEl) return;
    
    try {
        const icons = await apiFetch("/api/icons");
        
        if (!icons || icons.length === 0) {
            selectEl.innerHTML = `<option value="">Нет иконок в static/icons/</option>`;
            return;
        }
        
        selectEl.innerHTML = `<option value="">— Выберите иконку —</option>`;
        icons.forEach(icon => {
            const opt = document.createElement("option");
            // Сохраняем путь в формате /static/icons/xxx.svg
            opt.value = `/static/icons/${icon.filename}`;
            opt.textContent = icon.filename;
            selectEl.appendChild(opt);
        });
        
        selectEl.addEventListener("change", () => {
            if (!previewEl) return;
            const value = selectEl.value;
            if (!value) {
                previewEl.innerHTML = `<span class="icon-preview__placeholder">Выберите иконку</span>`;
                return;
            }
            // Путь уже правильный: /static/icons/xxx.svg
            const iconUrl = API_BASE + value;
            previewEl.innerHTML = `
                <img 
                    src="${iconUrl}" 
                    alt="preview"
                    onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\'icon-preview__placeholder\\'>Не найдена</span>';"
                >
            `;
        });
        
        console.log(`Загружено иконок: ${icons.length}`);
    } catch (e) {
        console.error("Ошибка загрузки иконок:", e);
        selectEl.innerHTML = `<option value="">Ошибка загрузки</option>`;
    }
}

function showAdminMessage(elementId, text, type = "success") {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = text;
    el.className = `admin-message admin-message--${type}`;
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 4000);
}

function setupAdminForms() {
    const catForm = document.getElementById("category-form");
    const taskForm = document.getElementById("task-form");
    const user = getUser();
    
    if (catForm) {
        catForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("cat-name").value.trim();
            const slug = document.getElementById("cat-slug").value.trim().toLowerCase();
            const icon = document.getElementById("cat-icon").value;  // путь /static/icons/xxx.svg
            
            if (!name || !slug || !icon) {
                showAdminMessage("category-message", "Заполните все поля и выберите иконку", "error");
                return;
            }
            
            const submitBtn = catForm.querySelector("button[type=submit]");
            submitBtn.disabled = true;
            submitBtn.textContent = "Создание…";
            
            try {
                const params = new URLSearchParams({ user_id: user.id, name, slug, icon });
                await apiFetch(`/api/admin/category?${params}`, { method: "POST" });
                showAdminMessage("category-message", `Категория "${name}" создана!`, "success");
                catForm.reset();
                await loadAdminCategories();
            } catch (err) {
                showAdminMessage("category-message", err.message, "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Создать категорию";
            }
        });
    }
    
    if (taskForm) {
        taskForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const categoryId = document.getElementById("task-category").value;
            const title = document.getElementById("task-title").value.trim();
            const description = document.getElementById("task-description").value.trim();
            const difficulty = document.getElementById("task-difficulty").value;
            
            if (!categoryId || !title || !description) {
                showAdminMessage("task-message", "Заполните все поля", "error");
                return;
            }
            
            const submitBtn = taskForm.querySelector("button[type=submit]");
            submitBtn.disabled = true;
            submitBtn.textContent = "Добавление…";
            
            try {
                const params = new URLSearchParams({
                    user_id: user.id, category_id: categoryId,
                    title, description, difficulty
                });
                await apiFetch(`/api/admin/tasks?${params}`, { method: "POST" });
                showAdminMessage("task-message", `Задача "${title}" добавлена!`, "success");
                taskForm.reset();
            } catch (err) {
                showAdminMessage("task-message", err.message, "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Добавить задачу";
            }
        });
    }
}

// ── profile ───────────────────────────────────────────────────────────────────
async function loadProfile() {
    const user = getUser();
    if (!user) { window.location.href = "auth.html"; return; }
    const usernameEl = document.getElementById("profile-username");
    const roleEl = document.getElementById("profile-role");
    const statSaved = document.getElementById("stat-saved");
    const statCompleted = document.getElementById("stat-completed");
    if (usernameEl) usernameEl.textContent = user.username;
    try {
        const profile = await apiFetch(`/api/user/profile?user_id=${user.id}`);
        if (roleEl) roleEl.textContent = profile.role === "admin" ? "Администратор" : "Пользователь";
        if (statSaved) statSaved.textContent = profile.total_saved || 0;
        if (statCompleted) statCompleted.textContent = profile.total_completed || 0;
        currentTab = "saved";
        await loadUserTasks("saved");
        const tabs = document.querySelectorAll(".tab-btn");
        tabs.forEach(tab => {
            tab.addEventListener("click", async () => {
                tabs.forEach(t => t.classList.remove("active"));
                tab.classList.add("active");
                currentTab = tab.dataset.status;
                await loadUserTasks(currentTab);
            });
        });
    } catch (err) { console.error("Ошибка загрузки профиля:", err); }
}

async function loadUserTasks(status) {
    const user = getUser();
    if (!user) return;
    const listEl = document.getElementById("tasks-list");
    if (!listEl) return;
    listEl.innerHTML = `<p class="empty-message">Загрузка задач…</p>`;
    try {
        const tasks = await apiFetch(`/api/user/tasks?user_id=${user.id}&status=${status}`);
        if (!tasks || tasks.length === 0) {
            const emptyText = status === "completed" ? "Вы пока не выполнили ни одной задачи" : "Нет сохранённых задач";
            listEl.innerHTML = `<p class="empty-message">${emptyText}</p>`;
            return;
        }
        listEl.innerHTML = "";
        tasks.forEach(task => {
            const item = document.createElement("div");
            item.className = "history-item";
            const difficultyDots = Array.from({ length: 3 }, (_, i) =>
                `<div class="difficulty-dot ${i < task.difficulty ? 'active' : ''}"></div>`
            ).join('');
            let actionsHtml = "";
            if (status === "saved") {
                actionsHtml = `
                    <div class="task-actions">
                        <button class="action-btn action-btn--complete" data-task-id="${task.id}" data-action="complete">Выполнено</button>
                        <button class="action-btn action-btn--delete" data-task-id="${task.id}" data-action="delete">Удалить</button>
                    </div>`;
            } else {
                actionsHtml = `
                    <div class="task-actions">
                        <button class="action-btn action-btn--uncomplete" data-task-id="${task.id}" data-action="uncomplete">Вернуть</button>
                        <button class="action-btn action-btn--delete" data-task-id="${task.id}" data-action="delete">Удалить</button>
                    </div>`;
            }
            item.innerHTML = `
                <div class="history-item__text">
                    <div class="history-item__title">${task.title}</div>
                    <div class="history-item__description">${task.description}</div>
                </div>
                <div class="history-item__meta">
                    <span class="badge">${task.name}</span>
                    <div class="difficulty-indicator">${difficultyDots}</div>
                </div>
                ${actionsHtml}`;
            listEl.appendChild(item);
        });
        listEl.querySelectorAll(".action-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                const taskId = parseInt(btn.dataset.taskId);
                const action = btn.dataset.action;
                await handleTaskAction(action, taskId, btn);
            });
        });
    } catch (err) {
        console.error("Ошибка загрузки задач:", err);
        listEl.innerHTML = `<p class="empty-message" style="color:#f87171">Не удалось загрузить задачи</p>`;
    }
}

async function handleTaskAction(action, taskId, btnElement) {
    const user = getUser();
    if (!user) return;
    const originalText = btnElement.textContent;
    btnElement.disabled = true;
    btnElement.textContent = "…";
    try {
        if (action === "complete") {
            await apiFetch(`/api/user/task/complete?user_id=${user.id}&task_id=${taskId}`, { method: "PATCH" });
        } else if (action === "uncomplete") {
            await apiFetch(`/api/user/task/not_complete?user_id=${user.id}&task_id=${taskId}`, { method: "PATCH" });
        } else if (action === "delete") {
            if (!confirm("Удалить задачу из профиля?")) {
                btnElement.disabled = false;
                btnElement.textContent = originalText;
                return;
            }
            await apiFetch(`/api/user/task/delete?user_id=${user.id}&task_id=${taskId}`, { method: "DELETE" });
        }
        const profile = await apiFetch(`/api/user/profile?user_id=${user.id}`);
        const statSaved = document.getElementById("stat-saved");
        const statCompleted = document.getElementById("stat-completed");
        if (statSaved) statSaved.textContent = profile.total_saved || 0;
        if (statCompleted) statCompleted.textContent = profile.total_completed || 0;
        await loadUserTasks(currentTab);
    } catch (err) {
        alert("Ошибка: " + err.message);
        btnElement.disabled = false;
        btnElement.textContent = originalText;
    }
}

// ── nav ───────────────────────────────────────────────────────────────────────
function updateNavAuth() {
    const authLink = document.getElementById("nav-auth-link");
    const adminLink = document.getElementById("nav-admin-link");
    const user = getUser();
    
    if (authLink) {
        if (user) {
            authLink.textContent = user.username;
            authLink.href = "profile.html";
        } else {
            authLink.textContent = "Войти";
            authLink.href = "auth.html";
        }
    }
    
    if (adminLink) {
        if (user && user.role === "admin") {
            adminLink.style.display = "";
        } else {
            adminLink.style.display = "none";
        }
    }
}

// ── categories (index.html) ──────────────────────────────────────────────────
async function loadCategories() {
    const grid = document.getElementById("categories-grid");
    if (!grid) return;
    grid.innerHTML = `<p style="color:var(--muted); grid-column:1/-1;">Загрузка категорий…</p>`;
    try {
        const categories = await apiFetch("/api/categories");
        grid.innerHTML = "";
        categories.forEach(cat => {
            const btn = document.createElement("button");
            btn.className = "cat-btn";
            btn.dataset.slug = cat.slug;
            
            // ИСПОЛЬЗУЕМ НОВУЮ ФУНКЦИЮ getIconUrl для исправления старых путей
            const iconUrl = getIconUrl(cat.icon);
            const iconHtml = isIconPath(cat.icon)
                ? `<img src="${iconUrl}" alt="${cat.name}" style="width:2rem;height:2rem;object-fit:contain;">`
                : (cat.icon || "📁");
            
            btn.innerHTML = `<span class="cat-btn__icon">${iconHtml}</span><span>${cat.name}</span>`;
            btn.addEventListener("click", () => selectCategory(cat));
            grid.appendChild(btn);
        });
    } catch {
        grid.innerHTML = `<p style="color:#f87171; grid-column:1/-1;">Не удалось загрузить категории</p>`;
    }
}

function selectCategory(cat) {
    selectedCategory = cat;
    const title = document.getElementById("selected-category-title");
    if (title) title.textContent = cat.name;
    showSection("step-params");
}

// ── task generation ───────────────────────────────────────────────────────────
async function generateTask() {
    if (!selectedCategory) return;
    const difficultyInput = document.querySelector('input[name="difficulty"]:checked');
    const difficulty = difficultyInput ? difficultyInput.value : 1;
    const btn = document.getElementById("btn-generate-start");
    if (btn) { btn.textContent = "Генерирую…"; btn.disabled = true; }
    try {
        const task = await apiFetch(
            `/api/tasks/random?category_slug=${selectedCategory.slug}&difficulty=${difficulty}`
        );
        currentTask = task;
        renderTask(task, difficulty);
        showSection("step-task");
    } catch (err) {
        alert("Не удалось получить задачу: " + err.message);
    } finally {
        if (btn) { btn.textContent = "Сгенерировать задачу"; btn.disabled = false; }
    }
}

function renderTask(task, difficulty) {
    const diffLabels = { "1": "Низкая", "2": "Средняя", "3": "Высокая" };
    const title = document.getElementById("task-title");
    const desc = document.getElementById("task-description");
    const catBadge = document.getElementById("task-category-badge");
    const diffBadge = document.getElementById("task-difficulty-badge");
    if (title) title.textContent = task.title;
    if (desc) desc.textContent = task.description;
    if (catBadge) catBadge.textContent = selectedCategory?.name ?? "";
    if (diffBadge) diffBadge.textContent =
        diffLabels[String(difficulty ?? task.difficulty)] ?? `Сложность ${task.difficulty}`;
}

async function rerollTask() {
    const difficultyInput = document.querySelector('input[name="difficulty"]:checked');
    const difficulty = difficultyInput ? difficultyInput.value : 1;
    const btn = document.getElementById("btn-reroll-task");
    if (btn) { btn.textContent = "Загрузка…"; btn.disabled = true; }
    try {
        const task = await apiFetch(
            `/api/tasks/random?category_slug=${selectedCategory.slug}&difficulty=${difficulty}`
        );
        currentTask = task;
        renderTask(task, difficulty);
    } catch { alert("Не удалось получить задачу."); }
    finally { if (btn) { btn.textContent = "Другой вариант"; btn.disabled = false; } }
}

async function saveTask() {
    const user = getUser();
    if (!user) { alert("Сначала войдите в аккаунт!"); window.location.href = "auth.html"; return; }
    if (!currentTask) return;
    const btn = document.getElementById("btn-save-task");
    if (btn) { btn.textContent = "Сохраняю…"; btn.disabled = true; }
    try {
        await apiFetch(`/api/user/tasks/save?user_id=${user.id}&task_id=${currentTask.id}`, { method: "POST" });
        alert("Задача сохранена в профиле!");
        if (btn) {
            btn.textContent = "Сохранено!";
            btn.disabled = true;
            setTimeout(() => { btn.textContent = "Сохранить в профиль"; btn.disabled = false; }, 2000);
        }
    } catch (err) {
        alert("Не удалось сохранить: " + err.message);
        if (btn) { btn.textContent = "Сохранить в профиль"; btn.disabled = false; }
    }
}

// ── initialization ────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    updateNavAuth();
    
    if (document.getElementById("admin-content")) { initAdminPanel(); return; }
    
    if (document.getElementById("profile-username")) {
        loadProfile();
        const logoutBtn = document.getElementById("btn-logout");
        if (logoutBtn) logoutBtn.addEventListener("click", (e) => { e.preventDefault(); logout(); });
        return;
    }
    
    const stepCategories = document.getElementById("step-categories");
    if (stepCategories) {
        const btnBackToCategories = document.getElementById("btn-back-to-categories");
        const btnBackToParams = document.getElementById("btn-back-to-params");
        const btnGenerateStart = document.getElementById("btn-generate-start");
        const btnRerollTask = document.getElementById("btn-reroll-task");
        const btnSaveTask = document.getElementById("btn-save-task");
        const btnResetMenu = document.getElementById("btn-reset-menu");
        if (btnBackToCategories) btnBackToCategories.addEventListener("click", () => showSection("step-categories"));
        if (btnBackToParams) btnBackToParams.addEventListener("click", () => showSection("step-params"));
        if (btnGenerateStart) btnGenerateStart.addEventListener("click", generateTask);
        if (btnRerollTask) btnRerollTask.addEventListener("click", rerollTask);
        if (btnSaveTask) btnSaveTask.addEventListener("click", saveTask);
        if (btnResetMenu) btnResetMenu.addEventListener("click", () => {
            selectedCategory = null; currentTask = null; showSection("step-categories");
        });
        showSection("step-categories");
        loadCategories();
        return;
    }
    
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const wrapperLogin = document.getElementById("form-wrapper-login");
    const wrapperRegister = document.getElementById("form-wrapper-register");
    if (tabLogin && tabRegister) {
        tabLogin.addEventListener("click", () => {
            tabLogin.classList.add("active"); tabRegister.classList.remove("active");
            wrapperLogin.classList.remove("hidden"); wrapperRegister.classList.add("hidden");
            document.getElementById("login-error")?.classList.add("hidden");
        });
        tabRegister.addEventListener("click", () => {
            tabRegister.classList.add("active"); tabLogin.classList.remove("active");
            wrapperRegister.classList.remove("hidden"); wrapperLogin.classList.add("hidden");
            document.getElementById("register-error")?.classList.add("hidden");
        });
    }
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("login-name")?.value.trim();
            const password = document.getElementById("login-password")?.value.trim();
            const errorEl = document.getElementById("login-error");
            if (!name || !password) {
                if (errorEl) { errorEl.textContent = "Заполните все поля"; errorEl.classList.remove("hidden"); }
                return;
            }
            try { await login(name, password); window.location.href = "index.html"; }
            catch (err) {
                if (errorEl) { errorEl.textContent = err.message; errorEl.classList.remove("hidden"); }
            }
        });
    }
    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("register-name")?.value.trim();
            const password = document.getElementById("register-password")?.value.trim();
            const password2 = document.getElementById("register-password2")?.value.trim();
            const errorEl = document.getElementById("register-error");
            const successEl = document.getElementById("register-success");
            if (!name || !password || !password2) {
                if (errorEl) { errorEl.textContent = "Заполните все поля"; errorEl.classList.remove("hidden"); }
                return;
            }
            if (password !== password2) {
                if (errorEl) { errorEl.textContent = "Пароли не совпадают"; errorEl.classList.remove("hidden"); }
                return;
            }
            try {
                await register(name, password);
                if (errorEl) errorEl.classList.add("hidden");
                if (successEl) { successEl.textContent = "Аккаунт создан! Выполняем вход…"; successEl.classList.remove("hidden"); }
                await login(name, password);
                window.location.href = "index.html";
            } catch (err) {
                if (errorEl) { errorEl.textContent = err.message; errorEl.classList.remove("hidden"); }
                if (successEl) successEl.classList.add("hidden");
            }
        });
    }
});