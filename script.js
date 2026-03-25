document.addEventListener('DOMContentLoaded', () => {
    // =========================================================
    // 기존 DOM 요소 선택 (화면 구조 및 ID, class 유지)
    // =========================================================
    const viewDashboard = document.getElementById('view-dashboard');
    const viewSchedule = document.getElementById('view-schedule');
    const viewDaily = document.getElementById('view-daily');
    const viewHistory = document.getElementById('view-history');
    const deleteDayBtn = document.getElementById('delete-day-btn');
    const dailyViewTitle = document.getElementById('daily-view-title');
    
    const navItems = document.querySelectorAll('.nav-item');
    const hourlyScheduleContainer = document.getElementById('hourly-schedule');
    const dashDateDisplay = document.getElementById('dash-date');
    const dashDatePicker = document.getElementById('dash-date-picker');
    const scheduleDateDisplay = document.getElementById('schedule-date');
    const scheduleDatePicker = document.getElementById('schedule-date-picker');
    
    const widgetBtns = document.querySelectorAll('.widget-btn');
    widgetBtns.forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.target)));
    
    const editGoalBtn = document.getElementById('edit-goal-btn');
    const saveGoalBtn = document.getElementById('save-goal-btn');
    const goalDisplay = document.getElementById('goal-display');
    const goalInput = document.getElementById('goal-input');
    const dailyMemo = document.getElementById('daily-memo');
    const memoSavedIndicator = document.getElementById('memo-saved-indicator');
    
    const priorityToggle = document.getElementById('priority-toggle');
    const taskInput = document.getElementById('task-input');
    const addBtn = document.getElementById('add-btn');
    
    const sectionHigh = document.getElementById('section-high');
    const sectionNormal = document.getElementById('section-normal');
    const listHigh = document.getElementById('task-list-high');
    const listNormal = document.getElementById('task-list-normal');
    const emptyStateDaily = document.getElementById('empty-state-daily');
    
    const dateDisplay = document.getElementById('current-date');
    const dailyDatePicker = document.getElementById('daily-date-picker');
    const historyContainer = document.getElementById('history-container');

    // 테마 설정 (UI이므로 로컬스토리지 유지)
    const themeToggles = document.querySelectorAll('.theme-toggle');
    let isDark = localStorage.getItem('haruTheme') === 'dark';
    const applyTheme = () => {
        document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
        themeToggles.forEach(btn => btn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>');
    };
    themeToggles.forEach(btn => btn.addEventListener('click', () => {
        isDark = !isDark;
        localStorage.setItem('haruTheme', isDark ? 'dark' : 'light');
        applyTheme();
    }));
    applyTheme();

    const getTodayString = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const todayStr = getTodayString();
    let currentActiveDate = todayStr;
    let isHighPriority = false;

    // =========================================================
    // 1. 앱 전체 데이터 단일 상태 관리 객체
    // =========================================================
    let currentUid = null;
    let appData = {
        plans: {},
        schedule: {},
        memos: {},
        goal: ''
    };

    // 기존 localStorage 찌꺼기 청소
    ['haruPlans', 'haruSchedule', 'haruMemos', 'haruGoal', 'haruIsLoggedIn'].forEach(k => {
        try { localStorage.removeItem(k); } catch(e) {}
    });

    // =========================================================
    // 2. 저장/불러오기 로직 분리
    // =========================================================

    const getCurrentAppData = () => {
        return {
            plans: appData.plans || {},
            schedule: appData.schedule || {},
            memos: appData.memos || {},
            goal: appData.goal || ''
        };
    };

    // FIX: applyAppData(data) 덮어쓰기 로직 (이전 데이터 흔적 완전 초기화 후 적용)
    const applyAppData = (data) => {
        // 새 데이터 적용 전에 이전 appData 흔적이 남지 않도록 완전 초기화
        appData = {
            plans: {},
            schedule: {},
            memos: {},
            goal: ''
        };

        if (data && typeof data === 'object') {
            appData.plans = typeof data.plans === 'object' && data.plans !== null ? data.plans : {};
            appData.schedule = typeof data.schedule === 'object' && data.schedule !== null ? data.schedule : {};
            appData.memos = typeof data.memos === 'object' && data.memos !== null ? data.memos : {};
            appData.goal = typeof data.goal === 'string' ? data.goal : '';
        }

        // 기본값 보정 (앱 깨짐 방어)
        if (!appData.plans[todayStr]) appData.plans[todayStr] = [];
    };

    // FIX: saveCurrentState() 점검 - 로그인 여부에 따른 분리
    const saveCurrentState = () => {
        // 불필요한 빈 배열/빈 문자열 메모리에서 실시간 자동 청소
        Object.keys(appData.plans).forEach(date => {
            if (date !== todayStr && appData.plans[date].length === 0) delete appData.plans[date];
        });
        Object.keys(appData.schedule).forEach(date => {
            const isEmpty = Object.values(appData.schedule[date]).every(text => !text || text.trim() === '');
            if (date !== todayStr && isEmpty) delete appData.schedule[date];
        });
        Object.keys(appData.memos).forEach(date => {
            if (date !== todayStr && (!appData.memos[date] || appData.memos[date].trim() === '')) {
                delete appData.memos[date];
            }
        });

        const stateToSave = getCurrentAppData();

        if (currentUid !== null) {
            // FIX: 로그인 사용자 (Firestore 전용, haruDataSaved 이벤트 발생)
            console.log("Firestore 저장 이벤트 발생", { detail: stateToSave });
            window.dispatchEvent(new CustomEvent('haruDataSaved', { detail: stateToSave }));
        } else {
            // FIX: 게스트 사용자 (sessionStorage에만 저장)
            try {
                sessionStorage.setItem('guest_dayplan_session', JSON.stringify(stateToSave));
                console.log("게스트 세션 저장");
            } catch (e) {
                console.error("sessionStorage 저장 오류 방어:", e);
            }
        }
    };

    // =========================================================
    // 3. 로그인 ↔ 게스트 전환 (index.html에서 호출)
    // =========================================================

    // FIX: window.haruSetGuestMode (로그아웃 플래그 추가 및 완전 초기화)
    window.haruSetGuestMode = (isLogout = false) => {
        // 로그아웃으로 인한 상태 전환이거나, 직전에 로그인 상태였던 경우 완전 리셋
        if (isLogout || currentUid !== null) {
            console.log("게스트 초기화");
            currentUid = null;
            applyAppData(null); // 완전 초기 상태 적용
            try { sessionStorage.removeItem('guest_dayplan_session'); } catch(e){} // 게스트 기존 세션 삭제
            reRenderViews();
            return;
        }

        // 새로고침 등으로 연속된 게스트 상태 유지 시
        currentUid = null;
        let guestData = {};
        try {
            const stored = sessionStorage.getItem('guest_dayplan_session');
            if (stored) guestData = JSON.parse(stored);
        } catch (e) {
            console.error('sessionStorage 파싱 실패 복구:', e);
            guestData = {}; 
        }
        
        applyAppData(guestData);
        reRenderViews();
    };

    // FIX: window.haruSetUser (병합 로직 제거 및 cloudData 우선 적용)
    window.haruSetUser = (uid, cloudData) => {
        console.log("로그인 데이터 적용");
        currentUid = uid;
        
        // 로그인 시 기존 게스트 세션 데이터 자동 삭제 (자동 병합 방지)
        try { sessionStorage.removeItem('guest_dayplan_session'); } catch(e){}
        
        // 클라우드 데이터 적용 (없으면 빈 상태)
        applyAppData(cloudData || null);
        reRenderViews();
    };


    // =========================================================
    // 4. UI 렌더링 및 기능
    // =========================================================

    const reRenderViews = () => {
        renderGoal();
        if (!viewDashboard.classList.contains('hidden')) setDashAndScheduleHeader();
        if (!viewSchedule.classList.contains('hidden')) renderHourlySchedule();
        if (!viewDaily.classList.contains('hidden')) renderDailyTasks();
        if (!viewHistory.classList.contains('hidden')) {
            const gridDiv = historyContainer.querySelector('.history-grid');
            if(gridDiv) {
                viewHistory.classList.add('hidden');
                switchView('history');
            }
        }
    };

    const getFormattedDate = (dateStr) => {
        const [year, month, day] = dateStr.split('-');
        const dateObj = new Date(year, month - 1, day);
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' };
        return new Intl.DateTimeFormat('ko-KR', options).format(dateObj);
    };

    const setHeaderForDate = () => {
        dateDisplay.textContent = getFormattedDate(currentActiveDate);
        dailyDatePicker.value = currentActiveDate;
        if (currentActiveDate === todayStr) {
            dailyViewTitle.textContent = "To do list";
            deleteDayBtn.style.display = 'none';
        } else {
            dailyViewTitle.textContent = "과거 To do list";
            deleteDayBtn.style.display = 'flex';
        }
    };

    const setDashAndScheduleHeader = () => {
        const formatted = getFormattedDate(currentActiveDate);
        dashDateDisplay.textContent = formatted;
        dashDatePicker.value = currentActiveDate;
        scheduleDateDisplay.textContent = formatted;
        scheduleDatePicker.value = currentActiveDate;
        dailyMemo.value = appData.memos[currentActiveDate] || '';
    };

    // --- 목표 설정 뷰 ---
    const renderGoal = () => {
        if (appData.goal && appData.goal.trim()) {
            goalDisplay.textContent = appData.goal;
        } else {
            goalDisplay.innerHTML = '아직 설정된 목표가 없습니다.<br>수정 버튼을 눌러 목표를 작성해보세요!';
        }
    };

    editGoalBtn.addEventListener('click', () => {
        goalDisplay.classList.add('hidden');
        goalInput.classList.remove('hidden');
        saveGoalBtn.classList.remove('hidden');
        goalInput.value = appData.goal;
        goalInput.focus();
        editGoalBtn.style.display = 'none';
    });

    saveGoalBtn.addEventListener('click', () => {
        appData.goal = goalInput.value.trim();
        saveCurrentState();
        renderGoal();
        
        goalDisplay.classList.remove('hidden');
        goalInput.classList.add('hidden');
        saveGoalBtn.classList.add('hidden');
        editGoalBtn.style.display = 'block';
    });

    // --- 일일 메모 뷰 ---
    let memoTimeout;
    dailyMemo.addEventListener('input', (e) => {
        appData.memos[currentActiveDate] = e.target.value;
        saveCurrentState();
        
        memoSavedIndicator.classList.remove('hidden');
        memoSavedIndicator.style.animation = 'none';
        void memoSavedIndicator.offsetWidth; 
        memoSavedIndicator.style.animation = 'fadeInOut 2s ease forwards';
        
        clearTimeout(memoTimeout);
        memoTimeout = setTimeout(() => {
            memoSavedIndicator.classList.add('hidden');
        }, 2000);
    });

    // --- 시간 단위 스케줄 뷰 ---
    const renderHourlySchedule = () => {
        setDashAndScheduleHeader();
        hourlyScheduleContainer.innerHTML = '';
        
        if (!appData.schedule[currentActiveDate]) {
            appData.schedule[currentActiveDate] = {};
        }
        
        const currentData = appData.schedule[currentActiveDate];
        const currentHour = new Date().getHours();
        
        for (let i = 0; i < 24; i++) {
            const hourStr = String(i).padStart(2, '0') + ':00';
            const slot = document.createElement('div');
            const isCurrentHour = (currentActiveDate === todayStr && i === currentHour);
            slot.className = `time-slot ${isCurrentHour ? 'current-hour' : ''}`;
            
            slot.innerHTML = `
                <div class="time-label">${hourStr}</div>
                <div class="time-input-container">
                    <input type="text" class="time-input" placeholder="이 시간의 계획을 입력하세요" value="${currentData[hourStr] || ''}">
                </div>
            `;
            
            const input = slot.querySelector('.time-input');
            input.addEventListener('input', (e) => {
                currentData[hourStr] = e.target.value;
                saveCurrentState();
            });
            
            hourlyScheduleContainer.appendChild(slot);
        }
        
        if (currentActiveDate === todayStr && !viewSchedule.classList.contains('hidden')) {
            setTimeout(() => {
                const currentSlot = hourlyScheduleContainer.querySelector('.current-hour');
                if (currentSlot) {
                    currentSlot.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }
    };

    // --- To Do List 뷰 ---
    const createTaskElement = (task, index, dateKey) => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''} ${task.priority === 'high' ? 'high-priority' : 'normal-priority'}`;
        
        li.innerHTML = `
            <div class="check-icon" title="${task.completed ? '취소' : '완료'}">
                <i class="fas fa-check"></i>
            </div>
            <span class="task-content"></span>
            <div class="task-item-actions">
                <button class="action-icon star ${task.priority === 'high' ? 'active' : ''}" title="중요도 변경"><i class="${task.priority === 'high' ? 'fas' : 'far'} fa-star"></i></button>
                <button class="action-icon edit" title="수정"><i class="fas fa-edit"></i></button>
                <button class="action-icon delete" title="삭제"><i class="fas fa-trash"></i></button>
            </div>
        `;
        
        const contentSpan = li.querySelector('.task-content');
        contentSpan.textContent = task.text;

        const toggleComplete = (e) => {
            if (e.target.closest('.task-item-actions') || e.target.tagName.toLowerCase() === 'input') return;
            appData.plans[dateKey][index].completed = !appData.plans[dateKey][index].completed;
            saveCurrentState();
            if (!viewDaily.classList.contains('hidden')) renderDailyTasks();
        };

        li.querySelector('.check-icon').addEventListener('click', toggleComplete);
        contentSpan.addEventListener('click', toggleComplete);

        li.querySelector('.star').addEventListener('click', (e) => {
            e.stopPropagation();
            appData.plans[dateKey][index].priority = appData.plans[dateKey][index].priority === 'high' ? 'normal' : 'high';
            saveCurrentState();
            if (!viewDaily.classList.contains('hidden')) renderDailyTasks();
        });

        li.querySelector('.edit').addEventListener('click', (e) => {
            e.stopPropagation();
            const currentText = appData.plans[dateKey][index].text;
            const actionContainer = li.querySelector('.task-item-actions');
            
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'task-edit-input';
            input.value = currentText;
            
            li.replaceChild(input, contentSpan);
            actionContainer.style.display = 'none';
            input.focus();

            const val = input.value;
            input.value = '';
            input.value = val;

            const saveEdit = () => {
                const newText = input.value.trim();
                if (newText && newText !== currentText) {
                    appData.plans[dateKey][index].text = newText;
                    saveCurrentState();
                }
                renderDailyTasks();
            };

            input.addEventListener('blur', saveEdit);
            input.addEventListener('keypress', (ev) => {
                if (ev.key === 'Enter') input.blur(); 
            });
        });

        li.querySelector('.delete').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('이 플랜을 삭제하시겠습니까?')) {
                appData.plans[dateKey].splice(index, 1);
                saveCurrentState();
                renderDailyTasks();
            }
        });

        return li;
    };

    const renderDailyTasks = () => {
        setHeaderForDate();
        listHigh.innerHTML = '';
        listNormal.innerHTML = '';
        
        sectionHigh.classList.add('hidden');
        sectionNormal.classList.add('hidden');
        emptyStateDaily.classList.add('hidden');

        const dailyTasks = appData.plans[currentActiveDate] || [];
        
        if (dailyTasks.length === 0) {
            emptyStateDaily.innerHTML = currentActiveDate === todayStr 
                ? '오늘은 아직 등록된 플랜이 없습니다.<br>알찬 하루를 계획해보세요!' 
                : '이 날짜에 등록된 플랜이 없습니다.<br>새로운 플랜을 추가해보세요.';
            emptyStateDaily.classList.remove('hidden');
            return;
        }

        const highTasks = dailyTasks.map((t, i) => ({...t, originalIndex: i})).filter(t => t.priority === 'high');
        const normalTasks = dailyTasks.map((t, i) => ({...t, originalIndex: i})).filter(t => t.priority !== 'high');

        if (highTasks.length > 0) {
            sectionHigh.classList.remove('hidden');
            highTasks.forEach(task => listHigh.appendChild(createTaskElement(task, task.originalIndex, currentActiveDate)));
        }
        
        if (normalTasks.length > 0) {
            sectionNormal.classList.remove('hidden');
            normalTasks.forEach(task => listNormal.appendChild(createTaskElement(task, task.originalIndex, currentActiveDate)));
        }
    };

    priorityToggle.addEventListener('click', () => {
        isHighPriority = !isHighPriority;
        if(isHighPriority) {
            priorityToggle.classList.add('active');
            priorityToggle.innerHTML = '<i class="fas fa-star"></i>';
        } else {
            priorityToggle.classList.remove('active');
            priorityToggle.innerHTML = '<i class="far fa-star"></i>';
        }
    });

    const addTask = () => {
        const text = taskInput.value.trim();
        if (text === '') return;

        if (!appData.plans[currentActiveDate]) {
            appData.plans[currentActiveDate] = [];
        }

        appData.plans[currentActiveDate].push({ 
            text, 
            completed: false, 
            priority: isHighPriority ? 'high' : 'normal' 
        });
        saveCurrentState();
        renderDailyTasks();

        taskInput.value = '';
        taskInput.focus();
    };

    addBtn.addEventListener('click', addTask);
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });

    deleteDayBtn.addEventListener('click', () => {
        if (confirm(`${getFormattedDate(currentActiveDate)}의 모든 하루 일정과 일기를 삭제하시겠습니까?`)) {
            delete appData.plans[currentActiveDate];
            delete appData.schedule[currentActiveDate];
            delete appData.memos[currentActiveDate];
            saveCurrentState();
            switchView('history'); 
        }
    });

    // --- 히스토리 통계 시각화 뷰 ---
    const renderHistory = () => {
        historyContainer.innerHTML = '';
        
        const allDates = new Set([
            ...Object.keys(appData.plans),
            ...Object.keys(appData.schedule),
            ...Object.keys(appData.memos)
        ]);
        
        const sortedDates = Array.from(allDates)
            .filter(date => {
                const hasPlans = appData.plans[date] && appData.plans[date].length > 0;
                const hasSchedule = appData.schedule[date] && Object.keys(appData.schedule[date]).length > 0;
                const hasMemos = appData.memos[date] && appData.memos[date].trim().length > 0;
                return hasPlans || hasSchedule || hasMemos;
            })
            .sort((a, b) => new Date(b) - new Date(a));
        
        if (sortedDates.length === 0) {
            historyContainer.innerHTML = '<div class="empty-state">아직 작성된 플랜 기록이 없습니다.</div>';
            return;
        }

        const gridDiv = document.createElement('div');
        gridDiv.className = 'history-grid';

        sortedDates.forEach(date => {
            const tasks = appData.plans[date] || [];
            const completedCount = tasks.filter(t => t.completed).length;
            const totalCount = tasks.length;
            const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
            const isFull = percent === 100 && totalCount > 0;

            const block = document.createElement('div');
            block.className = `history-block ${isFull ? 'full' : ''}`;
            
            block.innerHTML = `
                <div class="block-date">${getFormattedDate(date)}</div>
                <div class="block-stats">
                    <span class="completion-rate">
                        ${totalCount > 0 ? `${completedCount}/${totalCount} (${percent}%)` : `0/0 (0%)`}
                    </span>
                </div>
            `;
            
            block.addEventListener('click', () => {
                currentActiveDate = date;
                switchView('dashboard');
            });
            
            gridDiv.appendChild(block);
        });

        historyContainer.appendChild(gridDiv);
    };

    // --- 통합 네비게이션 제어 ---
    const switchView = (targetView) => {
        viewDashboard.classList.add('hidden');
        viewSchedule.classList.add('hidden');
        viewDaily.classList.add('hidden');
        viewHistory.classList.add('hidden');
        
        viewDashboard.classList.remove('active');
        viewSchedule.classList.remove('active');
        viewDaily.classList.remove('active');
        viewHistory.classList.remove('active');
        
        navItems.forEach(item => item.classList.remove('active'));
        const activeNav = document.querySelector(`.bottom-nav .nav-item[data-target="${targetView}"]`);
        if (activeNav) activeNav.classList.add('active');

        if (targetView === 'history') {
            renderHistory();
            viewHistory.classList.remove('hidden');
            viewHistory.classList.add('active');
        } else if (targetView === 'daily') {
            renderDailyTasks();
            viewDaily.classList.remove('hidden');
            viewDaily.classList.add('active');
        } else if (targetView === 'schedule') {
            renderHourlySchedule();
            viewSchedule.classList.remove('hidden');
            viewSchedule.classList.add('active');
        } else {
            setDashAndScheduleHeader();
            viewDashboard.classList.remove('hidden');
            viewDashboard.classList.add('active');
        }
    };

    navItems.forEach(item => { item.addEventListener('click', () => switchView(item.dataset.target)); });
    widgetBtns.forEach(btn => { btn.addEventListener('click', () => switchView(btn.dataset.target)); });

    const handleDateChange = (e) => {
        if (e.target.value) {
            currentActiveDate = e.target.value;
            if (!viewDashboard.classList.contains('hidden')) setDashAndScheduleHeader();
            else if (!viewSchedule.classList.contains('hidden')) renderHourlySchedule();
            else if (!viewDaily.classList.contains('hidden')) renderDailyTasks();
        }
    };

    dashDatePicker.addEventListener('change', handleDateChange);
    scheduleDatePicker.addEventListener('change', handleDateChange);
    dailyDatePicker.addEventListener('change', handleDateChange);

    // =========================================================
    // 5. 프로그램 최초 구동 시 초기화 분리 
    // =========================================================
    
    // FIX: Firebase onAuthStateChanged 호출 전 비어있는 UI로 대기
    const initAppRender = () => {
        applyAppData(null);
        switchView('dashboard');
    }
    
    initAppRender();
});
