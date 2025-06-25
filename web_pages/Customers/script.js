// ===================================
// تنظیمات و متغیرهای سراسری
// ===================================
const WORKER_URL = 'https://customers.gacica1374.workers.dev'; // آدرس ورکر خود را اینجا قرار دهید

// ===================================
// المنت‌های اصلی DOM
// ===================================
// صفحات اصلی
const loginContainer = document.getElementById('login-container');
const dashboardContainer = document.getElementById('dashboard-container');
const pendingContainer = document.getElementById('pending-container');

// فرم‌ها و دکمه‌ها
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const logoutPendingBtn = document.getElementById('logout-pending-btn');

// ناوبری و اطلاعات کاربر
const navLinks = document.querySelectorAll('.nav-link');
const contentSections = document.querySelectorAll('.content-section');
const userIdentifierElement = document.getElementById('user-identifier');

// بخش چت
const chatHistory = document.getElementById('chat-history');
const chatForm = document.getElementById('chat-form');
const chatMessageInput = document.getElementById('chat-message-input');

// بخش وظایف
const tasksList = document.getElementById('tasks-list');
const addTaskForm = document.getElementById('add-task-form');
const addTaskError = document.getElementById('add-task-error');
const taskQuotaInfo = document.getElementById('task-quota-info');

// Modal ویرایش وظیفه
const editModal = document.getElementById('edit-task-modal');
const editTaskForm = document.getElementById('edit-task-form');
const closeModalBtn = document.getElementById('close-modal-btn');

// ===================================
// رویدادها (Event Listeners)
// ===================================
document.addEventListener('DOMContentLoaded', checkLoginStatus);
loginForm.addEventListener('submit', handleLogin);
logoutBtn.addEventListener('click', handleLogout);
logoutPendingBtn.addEventListener('click', handleLogout);
chatForm.addEventListener('submit', handleSendMessage);
addTaskForm.addEventListener('submit', handleAddTask);
tasksList.addEventListener('click', handleTaskActions);
editTaskForm.addEventListener('submit', handleSaveTask);
closeModalBtn.addEventListener('click', () => editModal.classList.add('hidden'));

// رویداد برای مدیریت تب‌ها
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navLinks.forEach(l => l.classList.remove('active'));
        contentSections.forEach(s => s.classList.remove('active'));
        link.classList.add('active');
        const targetSection = document.getElementById(link.dataset.target);
        if (targetSection) {
            targetSection.classList.add('active');
        }
    });
});

// ===================================
// مدیریت وضعیت و نمایش صفحات
// ===================================
function checkLoginStatus() {
    const token = localStorage.getItem('user_token');
    const userStatus = localStorage.getItem('user_status');
    if (token && userStatus) {
        if (userStatus === 'active') {
            showDashboard();
            fetchAllData(token);
            updateUserInfo();
        } else {
            showPendingPage();
        }
    } else {
        showLogin();
    }
}

function showLogin() {
    loginContainer.style.display = 'flex';
    dashboardContainer.classList.add('hidden');
    pendingContainer.classList.add('hidden');
}

function showDashboard() {
    loginContainer.style.display = 'none';
    dashboardContainer.classList.remove('hidden');
    pendingContainer.classList.add('hidden');
    document.querySelector('.nav-link')?.click();
}

function showPendingPage() {
    loginContainer.style.display = 'none';
    dashboardContainer.classList.add('hidden');
    pendingContainer.classList.remove('hidden');
}

// ===================================
// مدیریت احراز هویت (ورود و خروج)
// ===================================
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginError = document.getElementById('login-error');
    loginError.textContent = '';

    try {
        const response = await fetch(`${WORKER_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const result = await response.json();
        
        if (response.ok) {
            localStorage.setItem('user_token', result.token);
            localStorage.setItem('user_email', result.user.email);

            // مهم: ذخیره وضعیت کاربر
            localStorage.setItem('user_status', result.user.status);
            
            if (result.user.status === 'active') {
                showDashboard();
                fetchAllData(result.token);
                updateUserInfo();
            } else {
                showPendingPage();
            }
        } else {
            throw new Error(result.error || 'خطا در ورود');
        }
    } catch (error) {
        loginError.textContent = error.message;
    }
}

function handleLogout() {
    localStorage.removeItem('user_token');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_status');
    if (userIdentifierElement) userIdentifierElement.textContent = '';
    showLogin();
}

function updateUserInfo() {
    const userEmail = localStorage.getItem('user_email');
    if (userEmail && userIdentifierElement) {
        userIdentifierElement.textContent = userEmail;
    }
}

// ===================================
// توابع دریافت و نمایش داده‌ها
// ===================================
function fetchAllData(token) {
    fetchChatHistory(token);
    fetchTasks(token);
    fetchCommitment(token);
}

async function fetchWithAuth(endpoint, token, options = {}) {
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
        }
    };
    const finalOptions = { ...defaultOptions, ...options };
    if (finalOptions.body) {
        finalOptions.headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${WORKER_URL}${endpoint}`, finalOptions);
    const result = await response.json();

    if (!response.ok) {
        if (response.status === 401) handleLogout();
        // اگر کاربر در انتظار تایید باشد و درخواستی بفرستد
        if (result.errorCode === 'ACCOUNT_PENDING') {
            showPendingPage();
        }
        throw new Error(result.error || 'خطا در ارتباط با سرور');
    }
    return result;
}

// --- بخش چت ---
async function fetchChatHistory(token) {
    chatHistory.innerHTML = '<p>در حال بارگذاری تاریخچه چت...</p>';
    try {
        const data = await fetchWithAuth('/chat', token);
        chatHistory.innerHTML = '';
        if (data.messages && data.messages.length > 0) {
            data.messages.forEach(renderMessage);
        } else {
            chatHistory.innerHTML = '<p class="no-message">هنوز پیامی رد و بدل نشده است.</p>';
        }
    } catch (error) {
        chatHistory.innerHTML = `<p class="error-message">خطا در بارگذاری چت: ${error.message}</p>`;
    }
}

async function handleSendMessage(e) {
    e.preventDefault();
    const messageText = chatMessageInput.value.trim();
    if (!messageText) return;

    chatMessageInput.value = '';
    const token = localStorage.getItem('user_token');
    try {
        await fetchWithAuth('/chat', token, {
            method: 'POST',
            body: JSON.stringify({ text: messageText })
        });
        await fetchChatHistory(token); // رفرش چت برای نمایش پیام جدید
    } catch (error) {
        console.error('Failed to send message:', error);
    }
}

function renderMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${message.sender === 'customer' ? 'sent' : 'received'}`;
    const statusIcon = message.sender === 'customer' ? `<span class="status-ticks"><i class="fas fa-check"></i>${message.status === 'seen' ? '<i class="fas fa-check-double"></i>' : ''}</span>` : '';
    messageDiv.innerHTML = `
        <div class="message-text">${message.text}</div>
        <div class="message-meta">
            <span>${new Date(message.timestamp).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</span>
            ${statusIcon}
        </div>
    `;
    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// --- بخش وظایف ---
async function fetchTasks(token) {
    try {
        const data = await fetchWithAuth('/tasks', token);
        const myUserId = localStorage.getItem('user_token').replace('fake-token-for-', '');
        
        tasksList.innerHTML = '';
        if (data.tasks.length === 0) {
            tasksList.innerHTML = '<p>هیچ وظیفه‌ای ثبت نشده است.</p>';
        } else {
            data.tasks.sort((a, b) => new Date(b.date) - new Date(a.date)); // مرتب‌سازی بر اساس جدیدترین
            data.tasks.forEach(task => {
                const taskDiv = document.createElement('div');
                taskDiv.className = `task-item ${task.completed ? 'completed' : ''} ${task.priority === 'high' ? 'high-priority' : ''}`;

                let controlsHTML = '<div class="task-controls">';
                if (myUserId === 'PMirshokraei') { // مشتری
                    if (!task.completed) controlsHTML += `<button class="task-control-btn delete" data-task-id="${task.id}" title="حذف"><i class="fas fa-trash-alt"></i></button>`;
                } else { // پشتیبان
                    const completeIcon = task.completed ? 'fa-undo' : 'fa-check';
                    const completeTitle = task.completed ? 'بازگردانی' : 'تکمیل';
                    const completeClass = task.completed ? 'uncomplete' : 'complete';
                    controlsHTML += `<button class="task-control-btn edit" data-task-id="${task.id}" title="ویرایش"><i class="fas fa-pencil-alt"></i></button>`;
                    controlsHTML += `<button class="task-control-btn ${completeClass}" data-task-id="${task.id}" title="${completeTitle}"><i class="fas ${completeIcon}"></i></button>`;
                }
                controlsHTML += '</div>';
                
                const createdByText = task.createdBy === 'PMirshokraei' ? 'توسط مشتری' : 'توسط پشتیبانی';
                const createdByClass = task.createdBy === 'PMirshokraei' ? 'by-customer' : 'by-support';

                taskDiv.innerHTML = `
                    ${controlsHTML}
                    <p><strong>${task.title}</strong></p>
                    <div class="task-meta">
                        <small>تاریخ ثبت: ${new Date(task.date).toLocaleDateString('fa-IR')}</small>
                        <span class="created-by ${createdByClass}">${createdByText}</span>
                    </div>
                    ${task.note ? `<div class="note"><strong>نکته:</strong> ${task.note}</div>` : ''}
                `;
                tasksList.appendChild(taskDiv);
            });
        }
        updateQuotaInfo(data.quota);
    } catch (error) {
        tasksList.innerHTML = `<p class="error-message">${error.message}</p>`;
    }
}

async function handleAddTask(e) {
    e.preventDefault();
    const title = document.getElementById('task-title').value;
    const priority = document.getElementById('task-priority').value;
    const token = localStorage.getItem('user_token');
    addTaskError.textContent = '';
    
    try {
        await fetchWithAuth('/tasks', token, {
            method: 'POST',
            body: JSON.stringify({ title, priority })
        });
        addTaskForm.reset();
        await fetchTasks(token);
    } catch (error) {
        addTaskError.textContent = error.message;
    }
}

function updateQuotaInfo(quota) {
    const remainingNormal = quota.normal.total - quota.normal.used;
    const remainingHigh = quota.high.total - quota.high.used;
    taskQuotaInfo.innerHTML = `
        <div class="quota-item ${remainingNormal <= 0 ? 'limit-reached' : ''}">
            <strong>${remainingNormal}</strong><span>وظیفه عادی باقی‌مانده</span>
        </div>
        <div class="quota-item ${remainingHigh <= 0 ? 'limit-reached' : ''}">
            <strong>${remainingHigh}</strong><span>وظیفه با اولویت باقی‌مانده</span>
        </div>
    `;
}

async function handleTaskActions(event) {
    const button = event.target.closest('.task-control-btn');
    if (!button) return;
    const taskId = button.dataset.taskId;
    
    if (button.classList.contains('delete')) {
        if (confirm('آیا از حذف این وظیفه مطمئن هستید؟')) await handleDeleteTask(taskId);
    } else if (button.classList.contains('edit')) {
        await openEditModal(taskId);
    } else if (button.classList.contains('complete') || button.classList.contains('uncomplete')) {
        await handleToggleComplete(taskId, button.classList.contains('complete'));
    }
}

async function handleDeleteTask(taskId) {
    const token = localStorage.getItem('user_token');
    await fetchWithAuth(`/tasks/${taskId}`, token, { method: 'DELETE' });
    await fetchTasks(token);
}

async function handleToggleComplete(taskId, completed) {
    const token = localStorage.getItem('user_token');
    await fetchWithAuth(`/tasks/${taskId}`, token, { method: 'PUT', body: JSON.stringify({ completed }) });
    await fetchTasks(token);
}

// --- بخش Modal ویرایش ---
async function openEditModal(taskId) {
    const token = localStorage.getItem('user_token');
    const data = await fetchWithAuth('/tasks', token);
    const task = data.tasks.find(t => t.id === taskId);
    if (task) {
        document.getElementById('edit-task-id').value = task.id;
        document.getElementById('edit-task-title').value = task.title;
        document.getElementById('edit-task-note').value = task.note || '';
        editModal.classList.remove('hidden');
    }
}

async function handleSaveTask(event) {
    event.preventDefault();
    const taskId = document.getElementById('edit-task-id').value;
    const title = document.getElementById('edit-task-title').value;
    const note = document.getElementById('edit-task-note').value;
    const token = localStorage.getItem('user_token');
    await fetchWithAuth(`/tasks/${taskId}`, token, {
        method: 'PUT',
        body: JSON.stringify({ title, note })
    });
    editModal.classList.add('hidden');
    await fetchTasks(token);
}

// --- بخش زمان تعهد ---
async function fetchCommitment(token) {
    const commitmentInfo = document.getElementById('commitment-info');
    try {
        const data = await fetchWithAuth('/commitment', token);
        commitmentInfo.textContent = `قرارداد همکاری ما تا تاریخ ${new Date(data.date).toLocaleDateString('fa-IR')} معتبر است.`;
    } catch (error) {
        commitmentInfo.textContent = error.message;
    }
}