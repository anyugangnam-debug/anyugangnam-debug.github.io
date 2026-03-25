document.addEventListener('DOMContentLoaded', () => {
    // =========================================================
    // 기존 DOM 요소 선택 (화면 구조 유지)
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

    // 테마는 UI 환경 설정이므로 로컬스토리지 유지
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
    // 1. 앱 전체 데이터 단일 상태 객체 (요구사항 1)
    // =========================================================
    let currentUid = null;
    let appData = {
        plans: {},
        schedule: {},
        memos: {},
        goal: ''
    };

    // 기존 찌꺼기 localStorage 정리 (요구사항 5: 로컬스토리지 사용 금지)
    ['haruPlans', 'haruSchedule', 'haruMemos', 'haruGoal', 'haruIsLoggedIn'].forEach(k => {
        try { localStorage.removeItem(k); } catch(e) {}
    });

    // =========================================================
    // 2. 데이터 저장/불러오기 분리 모듈 로직 (요구사항 2, 3, 4, 9)
    // =========================================================

    // 현재 상태 반환본 생성
    const getCurrentAppData = () => {
        return {
            plans: appData.plans || {},
            schedule: appData.schedule || {},
            memos: appData.memos || {},
            goal: appData.goal || ''
        };
    };

    // 주입된 데이터를 앱 상태에 안전하게 덮어쓰기 (방어 코드 포함)
    const applyAppData = (data) => {
        if (!data) data = {}; // null 방어
        appData.plans = typeof data.plans === 'object' && data.plans !== null ? data.plans : {};
        appData.schedule = typeof data.schedule === 'object' && data.schedule !== null ? data.schedule : {};
        appData.memos = typeof data.memos === 'object' && data.memos !== null ? data.memos : {};
        appData.goal = typeof data.goal === 'string' ? data.goal : '';

        // 기본값 보정 (오늘 날짜의 plans 배열 보장)
        if (!appData.plans[todayStr]) appData.plans[todayStr] = [];
    };

    // 상태를 저장 (게스트는 sessionStorage, 로그인은 Firebase 이벤트 전송)
    const saveCurrentState = () => {
        // 불필요한 빈 배열/문자열 자동 정리
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
            // 로그인 상태: index.html 에 haruDataSaved 이벤트 전달 (Firebase에 자동 저장됨)
            window.dispatchEvent(new CustomEvent('haruDataSaved', { detail: stateToSave }));
        } else {
            // 게스트 상태: 일회성 sessionStorage 하나만 사용 (브라우저 종료 시 증발)
            try {
                sessionStorage.setItem('guest_dayplan_session', JSON.stringify(stateToSave));
            } catch (e) {
                console.error('sessionStorage 저장 오류:', e);
            }
        }
    };

    // ---------------------------------------------------------
    // 로그인 / 게스트 전환 인터페이스 (index.html에서 onAuthStateChanged로 호출됨)
    // ---------------------------------------------------------

    // 게스트 모드 진입 시 (요구사항 4)
    window.haruSetGuestMode = () => {
        currentUid = null;
        let guestData = {};
        
        try {
            const stored = sessionStorage.getItem('guest_dayplan_session');
            if (stored) guestData = JSON.parse(stored);
        } catch (e) {
            console.error('sessionStorage 파싱 실패 복구:', e);
            guestData = {}; // 파싱 실패 시 빈 데이터로 복구
        }
        
        applyAppData(guestData); // 불러오기(없을 경우 빈 초기상태)
        reRenderViews();
    };

    // 로그인 유저 셋업 (요구사항 3)
    window.haruSetUser = (uid, cloudData) => {
        // 기존 게스트 데이터 존재 여부 판단
        let hasGuestData = false;
        try {
            const stored = sessionStorage.getItem('guest_dayplan_session');
            if (stored) {
                const parsed = JSON.parse(stored);
                const p = Object.keys(parsed.plans || {}).some(d => parsed.plans[d].length > 0);
                const s = Object.keys(parsed.schedule || {}).some(d => Object.keys(parsed.schedule[d]).length > 0);
                const m = Object.keys(parsed.memos || {}).length > 0;
                const g = !!(parsed.goal);
                hasGuestData = p || s || m || g;
            }
        } catch(e) {}

        const useCloudOnly = () => {
            currentUid = uid;
            applyAppData(cloudData); // 우선 Firestore 데이터 적용
            try { sessionStorage.removeItem('guest_dayplan_session'); } catch(e){}
            reRenderViews();
        };

        if (hasGuestData) {
            // 게스트 데이터가 남아있을 경우 confirm 으로 덮어쓰기 허가 받기
            if (confirm('게스트에서 작성한 임시 데이터를 계정에 저장할까요?\n(확인 시 기존 데이터에 통합되어 저장됩니다)')) {
                currentUid = uid;
                // 클라우드 데이터를 바탕으로, 현재 앱(게스트) 데이터를 덮어씌움
                const merged = cloudData ? { ...cloudData } : {};
                merged.plans = { ...(merged.plans || {}), ...appData.plans };
                merged.schedule = { ...(merged.schedule || {}), ...appData.schedule };
                merged.memos = { ...(merged.memos || {}), ...appData.memos };
                if (appData.goal) merged.goal = appData.goal;
                
                applyAppData(merged);
                try { sessionStorage.removeItem('guest_dayplan_session'); } catch(e){}
                saveCurrentState(); // 확인한 경우에만 덮어쓰기 후 저장 이벤트 발생!
                reRenderViews();
            } else {
                useCloudOnly(); // 취소한 경우 게스트 데이터 완전 파기 후 클라우드 내용 복원
            }
        } else {
            useCloudOnly(); // 남은 게스트 데이터가 없으면 클라우드 내용 즉시 복원
        }
    };

    // =========================================================
    // UI 업데이트 및 기능 동작 (기능 완료마다 saveCurrentState() 호출)
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

    // --- 목표 메모 뷰 ---
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
        saveCurrentState(); // 앱 데이터 변경됨 (요구사항 6)
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
        saveCurrentState(); // 앱 데이터 변경됨 (요구사항 6)
        
        memoSavedIndicator.classList.remove('hidden');
        memoSavedIndicator.style.animation = 'none';
        void memoSavedIndicator.offsetWidth; 
        memoSavedIndicator.style.animation = 'fadeInOut 2s ease forwards';
        
        clearTimeout(memoTimeout);
        memoTimeout = setTimeout(() => {
            memoSavedIndicator.classList.add('hidden');
        }, 2000);
    });

    // --- 스케줄 뷰 ---
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
                saveCurrentState(); // 스케줄 변경 시 자동 저장 (요구사항 6)
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
            saveCurrentState(); // 완료 상태 변경
            if (!viewDaily.classList.contains('hidden')) renderDailyTasks();
        };

        li.querySelector('.check-icon').addEventListener('click', toggleComplete);
        contentSpan.addEventListener('click', toggleComplete);

        li.querySelector('.star').addEventListener('click', (e) => {
            e.stopPropagation();
            appData.plans[dateKey][index].priority = appData.plans[dateKey][index].priority === 'high' ? 'normal' : 'high';
            saveCurrentState(); // 중요도 변경
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

            const saveEdit = () => {
                const newText = input.value.trim();
                if (newText && newText !== currentText) {
                    appData.plans[dateKey][index].text = newText;
                    saveCurrentState(); // 할 일 텍스트 수정 완료
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
                saveCurrentState(); // 할 일 삭제 시 자동 저장 (요구사항 6)
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

    // 추가 뷰
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
        saveCurrentState(); // 새로운 할 일 추가 완료 (요구사항 6)
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
            saveCurrentState(); // 일별 전체 삭제
            switchView('history'); 
        }
    });

    // --- 히스토리 통계 뷰 ---
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

    // --- 공용 뷰 전환기 ---
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

    // ===================================
    // 프로그램 시작 셋업
    // ===================================
    // 초기에는 무조건 빈 데이터 (또는 게스트세션)로 기초 렌더링 한 번 진행
    window.haruSetGuestMode();
    switchView('dashboard');
    // 사용자는 곧바로 index.html Firebase 훅에서 haruSetGuestMode/haruSetUser() 로 넘어가며 로드됨
});
