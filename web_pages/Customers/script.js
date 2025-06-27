document.addEventListener('DOMContentLoaded', () => {
    // ===================================
    // بخش ۱: تنظیمات و متغیرهای سراسری
    // ===================================
    const API_BASE_URL = 'https://customers.gacica1374.workers.dev'; 
    const TASKS_API_URL = 'https://mirshokraei.gacica1374.workers.dev'; 

    const TASK_QUOTAS = { high: 1, normal: 6, low: 12 };

    // المان‌های DOM
    const loginContainer = document.getElementById('login-container');
    const dashboardContainer = document.getElementById('dashboard-container');
    const pendingContainer = document.getElementById('pending-container');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    
    const modalBackdrop = document.getElementById('custom-modal-backdrop');
    const modalIcon = document.getElementById('modal-icon');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalButtons = document.getElementById('modal-buttons');

    let currentUser = null;
    let authToken = null;
    let isTaskSectionInitialized = false;
    let isBillingSectionInitialized = false;

    // ===================================
    // بخش ۲: توابع کمکی و مدیریت UI عمومی
    // ===================================

    function formatDuration(totalMinutes) {
        if (!totalMinutes || totalMinutes <= 0) return '';
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        let result = '';
        if (hours > 0) result += `${hours} ساعت `;
        if (minutes > 0) result += `${minutes} دقیقه`;
        return result.trim() || '0 دقیقه';
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }


    function showCustomModal({ type = 'error', title, message, buttons = [{ text: 'باشه', className: 'primary' }] }) {
        modalIcon.innerHTML = type === 'error' ? '<i class="fas fa-exclamation-circle"></i>' : '<i class="fas fa-check-circle"></i>';
        modalIcon.className = `modal-icon ${type}`;
        modalTitle.textContent = title;
        modalMessage.innerHTML = message;
        modalButtons.innerHTML = '';
        buttons.forEach(btnInfo => {
            const button = document.createElement('button');
            button.textContent = btnInfo.text;
            button.className = `modal-button ${btnInfo.className}`;
            button.onclick = () => {
                closeModal();
                if (btnInfo.onClick) btnInfo.onClick();
            };
            modalButtons.appendChild(button);
        });
        modalBackdrop.classList.add('visible');
    }

    function closeModal() {
        modalBackdrop.classList.remove('visible');
    }

    const showLogin = () => {
        loginContainer.classList.remove('hidden');
        dashboardContainer.classList.add('hidden');
        pendingContainer.classList.add('hidden');
        localStorage.clear();
        currentUser = null;
        authToken = null;
        isTaskSectionInitialized = false;
        isBillingSectionInitialized = false;
    };
    
    const showDashboardForUser = (user) => {
        loginContainer.classList.add('hidden');
        if (user.status === 'active') {
            dashboardContainer.classList.remove('hidden');
            pendingContainer.classList.add('hidden');
            document.getElementById('user-identifier').textContent = user.name;
            document.getElementById('logout-btn').addEventListener('click', showLogin);
            initializeTaskSection();
        } else if (user.status === 'pending') {
            dashboardContainer.classList.add('hidden');
            pendingContainer.classList.remove('hidden');
            document.getElementById('logout-pending-btn').addEventListener('click', showLogin);
        }
    };

    // =======================================================================
    // بخش ۳: منطق مدیریت وظایف (Task Manager)
    // =======================================================================
    function initializeTaskSection() {
        if (isTaskSectionInitialized) return;

        const activeContainer = document.getElementById('active-tasks');
        const archivedContainer = document.getElementById('archived-tasks');
        const activeEmpty = document.getElementById('active-empty');
        const archivedEmpty = document.getElementById('archived-empty');
        const taskTabs = document.querySelectorAll('.tasks-manager-container .tab-btn');
        const addTaskForm = document.getElementById('add-task-form');
        const taskQuotaInfo = document.getElementById('task-quota-info');

        const removeTaskCard = (cardElement) => { cardElement.classList.add('is-removing'); cardElement.addEventListener('animationend', () => { cardElement.remove(); checkEmptyStates(); }); };
        const checkEmptyStates = () => { activeEmpty.style.display = activeContainer.children.length === 0 ? 'block' : 'none'; archivedEmpty.style.display = archivedContainer.children.length === 0 ? 'block' : 'none'; };

        const createStepElement = (stepData) => {
            const li = document.createElement('li');
            li.className = `workflow-step ${stepData.done ? 'completed' : ''}`;
            li.dataset.stepId = stepData.id;

            const durationDisplay = stepData.duration > 0 
                ? `<span class="step-duration"><i class="fas fa-stopwatch"></i> ${formatDuration(stepData.duration)}</span>` 
                : '<span class="step-duration"></span>';

            const setTimeButton = currentUser.name === 'پشتیبانی' 
                ? `<button class="set-time-btn" title="ثبت زمان"><i class="fas fa-user-clock"></i></button>` 
                : '';
            
            li.innerHTML = `<span class="drag-handle"><i class="fas fa-grip-vertical"></i></span>
                            <div class="checkbox" role="checkbox" aria-checked="${stepData.done}"><i class="fas fa-check"></i></div>
                            <div class="step-main">
                                <span class="step-title">${escapeHtml(stepData.title)}</span>
                                ${durationDisplay}
                                <div class="step-actions">
                                    ${setTimeButton}
                                    <button class="delete-step-btn" title="حذف"><i class="fas fa-trash-alt"></i></button>
                                </div>
                            </div>
                            <input type="text" class="edit-input" value="${escapeHtml(stepData.title)}" />
                            <div class="time-input-form hidden">
                                <input type="number" class="time-input" placeholder="زمان (دقیقه)" min="0" value="${stepData.duration || ''}">
                                <button class="save-time-btn"><i class="fas fa-check"></i></button>
                                <button class="cancel-time-btn"><i class="fas fa-times"></i></button>
                            </div>`;
            return li;
        };

        const addTaskToDOM = (task) => {
            const div = document.createElement('div');
            div.className = 'task';
            div.dataset.taskId = task.id;
            const isArchived = task.archived;
            const shamsiDate = new persianDate(new Date(task.createdAt)).format('dddd D MMMM YYYY - HH:mm');
            
            const priorityMap = {
                high: '<span style="color:var(--danger);">فوری</span>',
                normal: '<span style="color:var(--warning);">عادی</span>',
                low: '<span style="color:var(--success);">کم</span>',
            };
            const priorityText = `<strong>اولویت:</strong> ${priorityMap[task.priority] || 'نامشخص'}`;
            
            let creatorDisplayName = task.creatorId; 
            if (task.creatorId === 'PMirshokraei') creatorDisplayName = 'مشتری';
            else if (task.creatorId === 'sajedsarvari') creatorDisplayName = 'پشتیبانی';
            const creatorInfo = task.creatorId ? `<div class="task-creator-info"><i class="fas fa-user-edit"></i> ایجاد شده توسط: <strong>${escapeHtml(creatorDisplayName)}</strong></div>` : '';

            const totalDurationMinutes = (task.workflow || []).reduce((acc, step) => acc + (step.duration || 0), 0);
            const totalDurationFormatted = formatDuration(totalDurationMinutes);
            const totalTimeDisplay = totalDurationMinutes > 0 ? `<span class="total-task-time"><i class="fas fa-clock"></i> ${totalDurationFormatted}</span>` : '';

            div.innerHTML = `
                <div class="task-header">
                    <span class="toggle-icon fas fa-chevron-down"></span>
                    <strong class="task-main-title" title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</strong>
                    <input type="text" class="edit-main-title-input" value="${escapeHtml(task.title)}" />
                    ${totalTimeDisplay}
                </div>
                <div class="task-details">
                    <div class="task-details-main-content">
                        <p>${escapeHtml(task.description) || '<i>بدون توضیحات</i>'}</p>
                        <p>${priorityText}</p>
                        <ul class="workflow-list"></ul>
                        ${creatorInfo}
                    </div>
                    <div class="actions-footer">
                        <div class="action-buttons">
                            ${!isArchived ? 
                                `<button class="action-btn add-step-trigger-btn" title="افزودن مرحله"><i class="fas fa-plus"></i></button>
                                <button class="action-btn edit-task" title="ویرایش وظیفه"><i class="fas fa-pencil-alt"></i></button>
                                <button class="action-btn archive" title="بایگانی"><i class="fas fa-archive"></i></button>
                                <button class="action-btn delete" title="حذف"><i class="fas fa-trash-alt"></i></button>` : 
                                `<button class="action-btn restore" title="بازیابی"><i class="fas fa-undo-alt"></i></button>
                                <button class="action-btn delete" title="حذف کامل"><i class="fas fa-trash-alt"></i></button>`
                            }
                        </div>
                        <span class="task-date-footer">${shamsiDate}</span>
                    </div>
                </div>`;
            
            const workflowList = div.querySelector('.workflow-list');
            (task.workflow || []).forEach(stepData => {
                const stepElement = createStepElement(stepData);
                workflowList.appendChild(stepElement);
            });
            
            return div;
        };
                
        const updateQuotaDisplay = (allTasks) => {
            const submitButton = addTaskForm.querySelector('button[type="submit"]');
            if (currentUser.id !== 'PMirshokraei') {
                taskQuotaInfo.style.display = 'none';
                submitButton.disabled = false;
                return;
            }
            taskQuotaInfo.style.display = 'block';
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            const customerTasksThisMonth = allTasks.filter(task => {
                if (task.creatorId !== 'PMirshokraei' || task.archived) return false;
                const taskDate = new Date(task.createdAt);
                return taskDate.getMonth() === currentMonth && taskDate.getFullYear() === currentYear;
            });
            const usedHigh = customerTasksThisMonth.filter(t => t.priority === 'high').length;
            const usedNormal = customerTasksThisMonth.filter(t => t.priority === 'normal').length;
            const usedLow = customerTasksThisMonth.filter(t => t.priority === 'low').length;
            const remainingHigh = TASK_QUOTAS.high - usedHigh;
            const remainingNormal = TASK_QUOTAS.normal - usedNormal;
            const remainingLow = TASK_QUOTAS.low - usedLow;
            taskQuotaInfo.innerHTML = `
                <span>سهمیه باقی‌مانده این ماه:</span> 
                <span>فوری: <strong>${remainingHigh}</strong> از ${TASK_QUOTAS.high}</span> 
                <span>عادی: <strong>${remainingNormal}</strong> از ${TASK_QUOTAS.normal}</span>
                <span>کم: <strong>${remainingLow}</strong> از ${TASK_QUOTAS.low}</span>`;
        };
        
        const renderTasks = (tasks, container) => { 
            container.innerHTML = ''; 
            tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            tasks.forEach(taskData => { 
                const taskElement = addTaskToDOM(taskData); 
                container.appendChild(taskElement); 
                initializeTaskInteractions(taskElement, taskData); 
            }); 
        };
        
        const fetchAndRender = async (only = null) => {
            try {
                const res = await fetch(`${TASKS_API_URL}/tasks`);
                if (!res.ok) throw new Error('خطا در دریافت داده‌ها');
                const allTasks = await res.json();
                const userVisibleTasks = allTasks;
                if (only !== 'archived') renderTasks(userVisibleTasks.filter(t => !t.archived), activeContainer);
                if (only !== 'active') renderTasks(userVisibleTasks.filter(t => t.archived), archivedContainer);
                checkEmptyStates();
                updateQuotaDisplay(allTasks);
            } catch (e) { 
                console.error(e); 
                activeContainer.innerHTML = `<div class="error-message">${e.message}</div>`; 
            }
        };
        
        const initializeTaskInteractions = (taskCard, taskData) => {
            const isArchived = taskData.archived;
            const workflowList = taskCard.querySelector('.workflow-list');

            taskCard.querySelector('.task-header').addEventListener('click', (e) => {
                if (!e.target.closest('.edit-main-title-input')) {
                    taskCard.classList.toggle('expanded');
                }
            });

            taskCard.querySelector('.actions-footer .delete').onclick = async () => {
                if (!confirm('آیا برای حذف این وظیفه مطمئن هستید؟ این عمل غیرقابل بازگشت است.')) return;
                removeTaskCard(taskCard);
                try {
                    await fetch(`${TASKS_API_URL}/tasks/${taskData.id}`, { method: 'DELETE' });
                } catch (err) {
                    alert("خطا در حذف وظیفه.");
                    fetchAndRender();
                }
            };

            taskCard.querySelectorAll('.workflow-step').forEach(stepElement => {
                initializeStepInteractions(stepElement, taskData, taskCard);
            });

            if (!isArchived) {
                new Sortable(workflowList, {
                    animation: 150,
                    handle: '.drag-handle',
                    ghostClass: 'step-ghost',
                    onEnd: async (evt) => {
                        const newOrderIds = Array.from(evt.target.children).map(li => li.dataset.stepId);
                        try {
                            await fetch(`${TASKS_API_URL}/tasks/${taskData.id}/workflow/reorder`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ order: newOrderIds }),
                            });
                        } catch (err) {
                            alert('خطا در ذخیره ترتیب جدید.');
                            fetchAndRender();
                        }
                    },
                });

                taskCard.querySelector('.actions-footer .archive').onclick = async () => {
                    removeTaskCard(taskCard);
                    try {
                        await fetch(`${TASKS_API_URL}/tasks/${taskData.id}/archive`, { method: 'POST' });
                        fetchAndRender('archived'); 
                    } catch (err) {
                        alert("خطا در بایگانی.");
                        fetchAndRender();
                    }
                };

                const addStepTriggerBtn = taskCard.querySelector('.add-step-trigger-btn');
                addStepTriggerBtn.addEventListener('click', () => {
                    if (workflowList.querySelector('.new-step-input-wrapper')) return;
                    const newStepLi = document.createElement('li');
                    newStepLi.className = 'new-step-input-wrapper';
                    newStepLi.innerHTML = `<input type="text" class="dynamic-new-step-input" placeholder="عنوان مرحله جدید..."><button class="save-new-step-btn" title="تایید"><i class="fas fa-check"></i></button><button class="cancel-new-step-btn" title="انصراف"><i class="fas fa-times"></i></button>`;
                    workflowList.appendChild(newStepLi);
                    const inputField = newStepLi.querySelector('.dynamic-new-step-input');
                    inputField.focus();

                    const saveNewStep = async () => {
                        const stepName = inputField.value.trim();
                        if (!stepName) return;
                        newStepLi.querySelector('.save-new-step-btn').disabled = true;
                        try {
                            const res = await fetch(`${TASKS_API_URL}/tasks/${taskData.id}/workflow`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ step: stepName }) });
                            if (!res.ok) throw new Error('خطا در افزودن مرحله');
                            const updatedTask = await res.json();
                            const newCard = addTaskToDOM(updatedTask);
                            taskCard.replaceWith(newCard);
                            initializeTaskInteractions(newCard, updatedTask);
                            newCard.classList.add('expanded');
                        } catch (err) {
                            alert(err.message);
                            newStepLi.remove();
                        }
                    };

                    newStepLi.querySelector('.save-new-step-btn').onclick = saveNewStep;
                    newStepLi.querySelector('.cancel-new-step-btn').onclick = () => newStepLi.remove();
                    inputField.onkeydown = (e) => {
                        if (e.key === 'Enter') saveNewStep();
                        if (e.key === 'Escape') newStepLi.remove();
                    };
                });

                const editTaskBtn = taskCard.querySelector('.action-btn.edit-task');
                const mainTitleSpan = taskCard.querySelector('.task-main-title');
                const mainTitleInput = taskCard.querySelector('.edit-main-title-input');
                let originalMainTitleValue = '';
                editTaskBtn.addEventListener('click', () => {
                    const isInEditMode = taskCard.classList.toggle('edit-mode');
                    if (isInEditMode) {
                        originalMainTitleValue = mainTitleSpan.textContent.trim();
                        taskCard.querySelectorAll('.step-title').forEach(st => st.style.cursor = 'pointer');
                    } else {
                         taskCard.querySelectorAll('.step-title').forEach(st => st.style.cursor = 'default');
                    }
                });
                const saveMainTitle = async () => {
                    const newTitle = mainTitleInput.value.trim();
                    if (newTitle && newTitle !== originalMainTitleValue) {
                        try {
                            await fetch(`${TASKS_API_URL}/tasks/${taskData.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTitle }) });
                            mainTitleSpan.textContent = newTitle;
                            mainTitleSpan.title = newTitle;
                            taskData.title = newTitle;
                        } catch (err) {
                            alert('خطا در ذخیره عنوان.');
                            mainTitleInput.value = originalMainTitleValue;
                        }
                    } else {
                        mainTitleInput.value = originalMainTitleValue;
                    }
                };
                mainTitleInput.addEventListener('blur', saveMainTitle);
                mainTitleInput.addEventListener('keydown', e => {
                    if (e.key === 'Enter') mainTitleInput.blur();
                    if (e.key === 'Escape') {
                        mainTitleInput.value = originalMainTitleValue;
                        mainTitleInput.blur();
                    }
                });
            } else {
                taskCard.querySelector('.actions-footer .restore').onclick = async () => {
                    removeTaskCard(taskCard);
                    try {
                        await fetch(`${TASKS_API_URL}/tasks/${taskData.id}/restore`, { method: 'POST' });
                        fetchAndRender('active');
                    } catch (err) {
                        alert("خطا در بازیابی.");
                        fetchAndRender();
                    }
                };
            }
        };

        const initializeStepInteractions = (stepElement, taskData, taskCard) => {
            const stepId = stepElement.dataset.stepId;
            const titleSpan = stepElement.querySelector('.step-title');

            stepElement.querySelector('.checkbox').onclick = async () => {
                const isCompleted = !stepElement.classList.contains('completed');
                try {
                    fetch(`${TASKS_API_URL}/tasks/${taskData.id}/workflow/${stepId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ done: isCompleted })
                    });
                    stepElement.classList.toggle('completed', isCompleted);
                    taskData.workflow.find(s => s.id === stepId).done = isCompleted;
                } catch (err) {
                    alert("خطا در به‌روزرسانی وضعیت. لطفا صفحه را رفرش کنید.");
                }
            };

            stepElement.querySelector('.delete-step-btn').onclick = async () => {
                if (!confirm(`آیا از حذف مرحله "${titleSpan.textContent}" مطمئن هستید؟`)) return;
                stepElement.classList.add('is-deleting');
                try {
                    await fetch(`${TASKS_API_URL}/tasks/${taskData.id}/workflow/${stepId}`, { method: 'DELETE' });
                    const stepIndex = taskData.workflow.findIndex(s => s.id === stepId);
                    if (stepIndex > -1) taskData.workflow.splice(stepIndex, 1);
                    const newCard = addTaskToDOM(taskData);
                    taskCard.replaceWith(newCard);
                    initializeTaskInteractions(newCard, taskData);
                    newCard.classList.add('expanded');
                } catch (err) {
                    alert("خطا در حذف مرحله.");
                    stepElement.classList.remove('is-deleting');
                    fetchAndRender();
                }
            };

            let originalStepTitle = '';
            const editInput = stepElement.querySelector('.edit-input');
            titleSpan.onclick = (e) => {
                if (taskCard.classList.contains('edit-mode')) {
                    e.stopPropagation();
                    originalStepTitle = titleSpan.textContent.trim();
                    stepElement.classList.add('editing');
                    editInput.focus();
                    editInput.select();
                }
            };
            const saveStepEdit = async () => {
                stepElement.classList.remove('editing');
                const newTitle = editInput.value.trim();
                if (newTitle && newTitle !== originalStepTitle) {
                    try {
                        await fetch(`${TASKS_API_URL}/tasks/${taskData.id}/workflow/${stepId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTitle }) });
                        titleSpan.textContent = newTitle;
                        taskData.workflow.find(s => s.id === stepId).title = newTitle;
                    } catch (err) {
                        alert(err.message);
                        editInput.value = originalStepTitle;
                    }
                } else {
                    editInput.value = originalStepTitle;
                }
            };
            editInput.onblur = saveStepEdit;
            editInput.onkeydown = (e) => {
                if (e.key === 'Enter') saveStepEdit();
                if (e.key === 'Escape') {
                    editInput.value = originalStepTitle;
                    editInput.blur();
                }
            };
            
            const setTimeBtn = stepElement.querySelector('.set-time-btn');
            if (setTimeBtn) {
                const timeForm = stepElement.querySelector('.time-input-form');
                const timeInput = timeForm.querySelector('.time-input');
                const saveTimeBtn = timeForm.querySelector('.save-time-btn');
                const cancelTimeBtn = timeForm.querySelector('.cancel-time-btn');

                setTimeBtn.onclick = () => {
                    timeForm.classList.toggle('hidden');
                    if (!timeForm.classList.contains('hidden')) {
                        timeInput.focus();
                        timeInput.select();
                    }
                };

                cancelTimeBtn.onclick = () => timeForm.classList.add('hidden');

                const saveTime = async () => {
                    const duration = parseInt(timeInput.value, 10);
                    if (isNaN(duration) || duration < 0) {
                        alert('لطفاً یک عدد معتبر برای دقیقه وارد کنید.');
                        return;
                    }
                    saveTimeBtn.disabled = true;
                    try {
                        const res = await fetch(`${TASKS_API_URL}/tasks/${taskData.id}/workflow/${stepId}/time`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ duration: duration })
                        });
                        if (!res.ok) throw new Error('خطا در ذخیره زمان');
                        const updatedTask = await res.json();
                        const newCard = addTaskToDOM(updatedTask);
                        taskCard.replaceWith(newCard);
                        initializeTaskInteractions(newCard, updatedTask);
                        newCard.classList.add('expanded');
                    } catch (err) {
                        alert(err.message);
                        saveTimeBtn.disabled = false;
                    }
                };
                saveTimeBtn.onclick = saveTime;
                timeInput.onkeydown = (e) => {
                    if (e.key === 'Enter') saveTime();
                    if (e.key === 'Escape') cancelTimeBtn.click();
                };
            }
        };

        document.getElementById('task-priority').addEventListener('change', () => {
            // برای سادگی، فقط لیست را رفرش میکنیم تا تابع updateQuotaDisplay کارش را بکند
            fetchAndRender();
        });

        taskTabs.forEach(tab => { 
            tab.addEventListener('click', () => { 
                taskTabs.forEach(t => t.classList.remove('active')); 
                tab.classList.add('active'); 
                const targetId = tab.getAttribute('data-target'); 
                document.querySelectorAll('.tasks-wrapper .tasks-section').forEach(section => { 
                    section.classList.toggle('active', section.id === targetId); 
                }); 
            }); 
        });

        addTaskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('task-title').value.trim();
            const priority = document.getElementById('task-priority').value;
            const description = document.getElementById('task-description').value.trim();

            if (!title) {
                showCustomModal({ type: 'error', title: 'خطای ورودی', message: 'عنوان وظیفه نمی‌تواند خالی باشد.' });
                return;
            }
            if (!currentUser || !currentUser.id) {
                showCustomModal({ type: 'error', title: 'خطای کاربر', message: 'اطلاعات کاربر یافت نشد.' });
                return;
            }
            
            // اینجا منطق بررسی سهمیه در کلاینت را اضافه میکنیم تا مودال را نمایش دهیم
            if(currentUser.id === 'PMirshokraei'){
                const quotaInfoText = taskQuotaInfo.innerHTML;
                let isQuotaReached = false;
                if(priority === 'high' && quotaInfoText.includes('فوری: <strong>0</strong>')) isQuotaReached = true;
                if(priority === 'normal' && quotaInfoText.includes('عادی: <strong>0</strong>')) isQuotaReached = true;
                if(priority === 'low' && quotaInfoText.includes('کم: <strong>0</strong>')) isQuotaReached = true;

                if(isQuotaReached){
                    showCustomModal({
                        type: 'error',
                        title: 'ظرفیت تکمیل شد',
                        message: 'متاسفانه ظرفیت شما برای این اولویت به پایان رسیده است.'
                    });
                    return;
                }
            }


            const submitButton = addTaskForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'در حال ثبت...';

            const newTaskPayload = {
                title, description, priority, creatorId: currentUser.id,
            };

            try {
                const response = await fetch(`${TASKS_API_URL}/tasks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newTaskPayload),
                });
                
                const resData = await response.json(); 
                if (!response.ok) {
                    throw new Error(resData.error || `خطا در سرور: ${response.status}`);
                }
                
                addTaskForm.reset();
                await fetchAndRender(); 

            } catch (err) {
                showCustomModal({
                    type: 'error',
                    title: 'عملیات ناموفق',
                    message: err.message
                });
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'ثبت وظیفه';
            }
        });

        fetchAndRender();
        isTaskSectionInitialized = true;
    }

    // =======================================================================
    // بخش ۴: منطق امور مالی (Billing)
    // =======================================================================
    function initializeBillingSection() {
        if (isBillingSectionInitialized) return;
        
        const HOURLY_RATE = 290000;

        const formContainer = document.getElementById('add-billing-item-form-container');
        const form = document.getElementById('add-billing-item-form');
        const tableBody = document.getElementById('billing-tbody');
        const tableFoot = document.getElementById('billing-tfoot');
        const billingEmptyMsg = document.getElementById('billing-empty');

        if (currentUser.name === 'پشتیبانی') {
            formContainer.classList.remove('hidden');
        }

        function renderBillingTable(tasks, billingItems) {
            tableBody.innerHTML = '';
            tableFoot.innerHTML = '';
            let totalCost = 0;
            let totalPayment = 0;
            let grandTotalMinutes = 0;

            // ثابت های جدید برای منطق محاسبه کف هزینه
            const MINIMUM_HOURS = 12;
            const MINIMUM_MINUTES = MINIMUM_HOURS * 60;
            const HOURLY_RATE = 290000;
            const UNUSED_HOURS_RATE = HOURLY_RATE / 2; // نرخ ساعت های استفاده نشده

            // مرحله ۱: رندر کردن وظایف فعال (بدون تغییر)
            const activeTasks = tasks.filter(task => !task.archived && task.workflow.reduce((acc, step) => acc + (step.duration || 0), 0) > 0);
            
            activeTasks.forEach(task => {
                const totalMinutes = task.workflow.reduce((acc, step) => acc + (step.duration || 0), 0);
                grandTotalMinutes += totalMinutes;
                const cost = (totalMinutes / 60) * HOURLY_RATE;
                totalCost += cost;

                const row = document.createElement('tr');
                row.className = 'task-row';
                row.innerHTML = `
                    <td><i class="fas fa-tasks task-icon"></i> ${escapeHtml(task.title)}</td>
                    <td>${formatDuration(totalMinutes)}</td>
                    <td class="amount">${Math.round(cost).toLocaleString('fa-IR')}</td>
                    <td></td>
                `;
                tableBody.appendChild(row);
            });

            // مرحله ۲: رندر کردن آیتم های مالی دستی (بدون تغییر)
            billingItems.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
            billingItems.forEach(item => {
                // ... (این بخش کد بدون تغییر باقی میماند)
                const row = document.createElement('tr');
                if (item.type === 'service') {
                    totalCost += item.amount;
                    row.className = 'service-row';
                    row.innerHTML = `
                        <td><i class="fas fa-plus-circle service-icon"></i> ${escapeHtml(item.description)}</td>
                        <td>-</td>
                        <td class="amount">${item.amount.toLocaleString('fa-IR')}</td>
                        <td></td>`;
                } else {
                    totalPayment += item.amount;
                    row.className = 'payment-row';
                    row.innerHTML = `
                        <td><i class="fas fa-check-circle payment-icon"></i> ${escapeHtml(item.description)}</td>
                        <td>-</td>
                        <td class="amount payment-amount">- ${item.amount.toLocaleString('fa-IR')}</td>
                        <td></td>`;
                }
                if (currentUser.name === 'پشتیبانی') {
                    const deleteBtnCell = row.cells[3];
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'delete-billing-item-btn';
                    deleteBtn.title = 'حذف این آیتم';
                    deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
                    deleteBtn.onclick = async () => {
                        if (!confirm(`آیا از حذف آیتم «${item.description}» مطمئن هستید؟`)) return;
                        try {
                            await fetch(`${TASKS_API_URL}/billing/${item.id}`, { method: 'DELETE' });
                            fetchAndRenderBillingData();
                        } catch (err) { alert('خطا در حذف آیتم.'); }
                    };
                    deleteBtnCell.appendChild(deleteBtn);
                }
                tableBody.appendChild(row);
            });

            // ================== مرحله ۳: محاسبه و افزودن هزینه ساعات باقی مانده ==================
            let unusedTimeCost = 0;
            if (grandTotalMinutes < MINIMUM_MINUTES) {
                const remainingMinutes = MINIMUM_MINUTES - grandTotalMinutes;
                unusedTimeCost = (remainingMinutes / 60) * UNUSED_HOURS_RATE;

                // افزودن ردیف جدید به بدنه جدول
                const unusedTimeRow = document.createElement('tr');
                unusedTimeRow.className = 'service-row';
                unusedTimeRow.innerHTML = `
                    <td><i class="fas fa-hourglass-half service-icon"></i> با ضریب نصف قیمت باقی مانده از حداقل ساعت پکیج</td>
                    <td>${formatDuration(remainingMinutes)}</td>
                    <td class="amount">${Math.round(unusedTimeCost).toLocaleString('fa-IR')}</td>
                    <td></td>
                `;
                tableBody.appendChild(unusedTimeRow);
            }
            
            // هزینه نهایی شامل هزینه واقعی کارها و هزینه ساعات استفاده نشده است
            const finalTotalCost = totalCost + unusedTimeCost;

            // ================== مرحله ۴: رندر کردن فوتر جدول (با منطق جدید) ==================
            const balance = finalTotalCost - totalPayment;
            tableFoot.innerHTML = `
                <tr class="summary-row">
                    <td><strong>جمع کل</strong></td>
                    <td><strong>${formatDuration(grandTotalMinutes)}</strong></td>
                    <td class="amount"><strong>${Math.round(finalTotalCost).toLocaleString('fa-IR')}</strong></td>
                    <td></td>
                </tr>
                <tr class="summary-row">
                    <td colspan="2">جمع کل واریزی‌ها</td>
                    <td class="amount payment-amount">- ${Math.round(totalPayment).toLocaleString('fa-IR')}</td>
                    <td></td>
                </tr>
                <tr class="balance-row">
                    <td colspan="2"><strong>مانده حساب نهایی</strong></td>
                    <td class="amount"><strong>${Math.round(balance).toLocaleString('fa-IR')}</strong></td>
                    <td></td>
                </tr>
            `;
            
            billingEmptyMsg.style.display = tableBody.children.length === 0 ? 'block' : 'none';
        }

        async function fetchAndRenderBillingData() {
            try {
                const [tasksRes, billingRes] = await Promise.all([
                    fetch(`${TASKS_API_URL}/tasks`),
                    fetch(`${TASKS_API_URL}/billing`)
                ]);

                if (!tasksRes.ok || !billingRes.ok) throw new Error('خطا در دریافت اطلاعات مالی');

                const tasks = await tasksRes.json();
                const billingItems = await billingRes.json();

                renderBillingTable(tasks, billingItems);

            } catch(err) {
                console.error(err);
                tableBody.innerHTML = `<tr><td colspan="4" class="error-message">${err.message}</td></tr>`;
            }
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const type = document.getElementById('billing-item-type').value;
            const description = document.getElementById('billing-item-description').value.trim();
            const amount = parseInt(document.getElementById('billing-item-amount').value, 10);
            
            if (!description || isNaN(amount) || amount <= 0) {
                alert('لطفا تمام فیلدها را با مقادیر معتبر پر کنید.');
                return;
            }

            const submitButton = form.querySelector('button[type="submit"]');
            submitButton.disabled = true;

            try {
                await fetch(`${TASKS_API_URL}/billing`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type, description, amount })
                });
                form.reset();
                fetchAndRenderBillingData();
            } catch (err) {
                alert('خطا در ثبت آیتم جدید.');
            } finally {
                submitButton.disabled = false;
            }
        });

        fetchAndRenderBillingData();
        isBillingSectionInitialized = true;
    }

    // ===================================
    // بخش ۵: راه اندازی اصلی و رویدادها
    // ===================================

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const username = form.elements.username.value.trim();
        const password = form.elements.password.value;
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'در حال بررسی...';
        loginError.textContent = '';
        try {
            const usersDataForLogin = {
                'PMirshokraei': 'mirshokraei@um.ac.ir',
                'sajedsarvari': 'sajed.the.nerd@gmail.com'
            };
            const email = usersDataForLogin[username];
            if (!email) throw new Error("نام کاربری یافت نشد.");
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'خطایی رخ داد');
            authToken = data.token;
            currentUser = data.user; 
            currentUser.id = username;
            currentUser.name = username === 'PMirshokraei' ? 'مشتری' : 'پشتیبانی';
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showDashboardForUser(currentUser);
        } catch (error) {
            loginError.textContent = error.message;
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'ورود';
        }
    });

    const navLinks = document.querySelectorAll('.nav-link');
    const contentSections = document.querySelectorAll('.content-section');
    navLinks.forEach(link => { 
        link.addEventListener('click', (e) => { 
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            const targetId = link.getAttribute('data-target');
            contentSections.forEach(section => { 
                section.classList.toggle('active', section.id === targetId); 
            });
            
            if (targetId === 'content-billing' && !isBillingSectionInitialized) {
                initializeBillingSection();
            }
        }); 
    });

    modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalBackdrop.classList.contains('visible')) closeModal(); });

    const checkLoginStatus = () => {
        const storedToken = localStorage.getItem('authToken');
        const storedUser = localStorage.getItem('currentUser');
        if (storedToken && storedUser) {
            authToken = storedToken;
            currentUser = JSON.parse(storedUser);
            showDashboardForUser(currentUser);
        } else {
            showLogin();
        }
    };
    checkLoginStatus();
});