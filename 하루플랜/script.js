document.addEventListener('DOMContentLoaded', () => {
    // 뷰 관련 요소
    const viewDashboard = document.getElementById('view-dashboard');
    const viewSchedule = document.getElementById('view-schedule');
    const viewDaily = document.getElementById('view-daily');
    const viewHistory = document.getElementById('view-history');
    const deleteDayBtn = document.getElementById('delete-day-btn');
    const dailyViewTitle = document.getElementById('daily-view-title');
    
    // 네비게이션
    const navItems = document.querySelectorAll('.nav-item');

    // 스케줄 및 대시보드 리소스
    const hourlyScheduleContainer = document.getElementById('hourly-schedule');
    const dashDateDisplay = document.getElementById('dash-date');
    const dashDatePicker = document.getElementById('dash-date-picker');
    const scheduleDateDisplay = document.getElementById('schedule-date');
    const scheduleDatePicker = document.getElementById('schedule-date-picker');

    // 대시보드 위젯
    const widgetBtns = document.querySelectorAll('.widget-btn');
    widgetBtns.forEach(btn => btn.addEventListener('click', () => {
        switchView(btn.dataset.target);
    }));

    // 목표 및 메모 리소스
    const editGoalBtn = document.getElementById('edit-goal-btn');
    const saveGoalBtn = document.getElementById('save-goal-btn');
    const goalDisplay = document.getElementById('goal-display');
    const goalInput = document.getElementById('goal-input');
    const dailyMemo = document.getElementById('daily-memo');
    const memoSavedIndicator = document.getElementById('memo-saved-indicator');

    // 테마 리소스
    const themeToggles = document.querySelectorAll('.theme-toggle');
    let isDark = localStorage.getItem('haruTheme') === 'dark';

    // 우선순위/입력 리소스
    const priorityToggle = document.getElementById('priority-toggle');
    const taskInput = document.getElementById('task-input');
    const addBtn = document.getElementById('add-btn');

    // 렌더링 리소스
    const sectionHigh = document.getElementById('section-high');
    const sectionNormal = document.getElementById('section-normal');
    const listHigh = document.getElementById('task-list-high');
    const listNormal = document.getElementById('task-list-normal');
    const emptyStateDaily = document.getElementById('empty-state-daily');
    
    const dateDisplay = document.getElementById('current-date');
    const dailyDatePicker = document.getElementById('daily-date-picker');
    const historyContainer = document.getElementById('history-container');

    // 상태 관리 (localStorage 데이터)
    let plansData = JSON.parse(localStorage.getItem('haruPlans')) || {};
    let scheduleData = JSON.parse(localStorage.getItem('haruSchedule')) || {};
    let memosData = JSON.parse(localStorage.getItem('haruMemos')) || {};
    let goalData = localStorage.getItem('haruGoal') || '';
    let isHighPriority = false;
    
    // 테마 적용 함수
    const applyTheme = () => {
        document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
        themeToggles.forEach(btn => {
            btn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        });
    };

    themeToggles.forEach(btn => btn.addEventListener('click', () => {
        isDark = !isDark;
        localStorage.setItem('haruTheme', isDark ? 'dark' : 'light');
        applyTheme();
    }));
    applyTheme();

    // 우선순위 토글 액션
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

    // 오늘 날짜 문자열 포맷 (YYYY-MM-DD)
    const getTodayString = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const todayStr = getTodayString();
    let currentActiveDate = todayStr;

    const getFormattedDate = (dateStr) => {
        const [year, month, day] = dateStr.split('-');
        const dateObj = new Date(year, month - 1, day);
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' };
        return new Intl.DateTimeFormat('ko-KR', options).format(dateObj);
    };

    if (!plansData[todayStr]) {
        plansData[todayStr] = [];
    }

    const saveData = () => {
        Object.keys(plansData).forEach(date => {
            if (date !== todayStr && plansData[date].length === 0) {
                delete plansData[date];
            }
        });
        localStorage.setItem('haruPlans', JSON.stringify(plansData));
        if (!viewDaily.classList.contains('hidden')) {
            renderDailyTasks(); 
        }
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
        
        // 메모 필드 렌더링
        dailyMemo.value = memosData[currentActiveDate] || '';
    };

    const saveMemosData = () => {
        Object.keys(memosData).forEach(date => {
            if (date !== todayStr && (!memosData[date] || memosData[date].trim() === '')) {
                delete memosData[date];
            }
        });
        localStorage.setItem('haruMemos', JSON.stringify(memosData));
    };

    const saveGoalData = () => {
        localStorage.setItem('haruGoal', goalData);
    };

    // 목표 렌더링 및 이벤트
    const renderGoal = () => {
        if (goalData.trim()) {
            goalDisplay.textContent = goalData;
        } else {
            goalDisplay.innerHTML = '아직 설정된 목표가 없습니다.<br>수정 버튼을 눌러 목표를 작성해보세요!';
        }
    };

    renderGoal();

    editGoalBtn.addEventListener('click', () => {
        goalDisplay.classList.add('hidden');
        goalInput.classList.remove('hidden');
        saveGoalBtn.classList.remove('hidden');
        goalInput.value = goalData;
        goalInput.focus();
        editGoalBtn.style.display = 'none';
    });

    saveGoalBtn.addEventListener('click', () => {
        goalData = goalInput.value.trim();
        saveGoalData();
        renderGoal();
        
        goalDisplay.classList.remove('hidden');
        goalInput.classList.add('hidden');
        saveGoalBtn.classList.add('hidden');
        editGoalBtn.style.display = 'block';
    });

    // 메모 이벤트
    let memoTimeout;
    dailyMemo.addEventListener('input', (e) => {
        memosData[currentActiveDate] = e.target.value;
        saveMemosData();
        
        memoSavedIndicator.classList.remove('hidden');
        memoSavedIndicator.style.animation = 'none';
        void memoSavedIndicator.offsetWidth; 
        memoSavedIndicator.style.animation = 'fadeInOut 2s ease forwards';
        
        clearTimeout(memoTimeout);
        memoTimeout = setTimeout(() => {
            memoSavedIndicator.classList.add('hidden');
        }, 2000);
    });

    const saveScheduleData = () => {
        Object.keys(scheduleData).forEach(date => {
            const isEmpty = Object.values(scheduleData[date]).every(text => (!text || text.trim() === ''));
            if (date !== todayStr && isEmpty) {
                delete scheduleData[date];
            }
        });
        localStorage.setItem('haruSchedule', JSON.stringify(scheduleData));
    };

    const renderHourlySchedule = () => {
        setDashAndScheduleHeader();
        hourlyScheduleContainer.innerHTML = '';
        
        if (!scheduleData[currentActiveDate]) {
            scheduleData[currentActiveDate] = {};
        }
        
        const currentData = scheduleData[currentActiveDate];
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
                saveScheduleData();
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

    // ======================================
    // 데일리 뷰 및 플랜 아이템 기능
    // ======================================
    
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
            plansData[dateKey][index].completed = !plansData[dateKey][index].completed;
            saveData();
        };

        li.querySelector('.check-icon').addEventListener('click', toggleComplete);
        contentSpan.addEventListener('click', toggleComplete);

        // 중요도 변경
        li.querySelector('.star').addEventListener('click', (e) => {
            e.stopPropagation();
            plansData[dateKey][index].priority = plansData[dateKey][index].priority === 'high' ? 'normal' : 'high';
            saveData();
        });

        // 수정 기능
        li.querySelector('.edit').addEventListener('click', (e) => {
            e.stopPropagation();
            const currentText = plansData[dateKey][index].text;
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
                    plansData[dateKey][index].text = newText;
                    saveData();
                } else {
                    renderDailyTasks();
                }
            };

            input.addEventListener('blur', saveEdit);
            input.addEventListener('keypress', (ev) => {
                if (ev.key === 'Enter') input.blur(); 
            });
        });

        // 삭제 기능
        li.querySelector('.delete').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('이 플랜을 삭제하시겠습니까?')) {
                plansData[dateKey].splice(index, 1);
                saveData();
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

        const dailyTasks = plansData[currentActiveDate] || [];
        
        if (dailyTasks.length === 0) {
            if (currentActiveDate === todayStr) {
                emptyStateDaily.innerHTML = '오늘은 아직 등록된 플랜이 없습니다.<br>알찬 하루를 계획해보세요!';
            } else {
                emptyStateDaily.innerHTML = '이 날짜에 등록된 플랜이 없습니다.<br>새로운 플랜을 추가해보세요.';
            }
            emptyStateDaily.classList.remove('hidden');
            return;
        }

        const highTasks = dailyTasks.map((t, i) => ({...t, originalIndex: i})).filter(t => t.priority === 'high');
        const normalTasks = dailyTasks.map((t, i) => ({...t, originalIndex: i})).filter(t => t.priority !== 'high');

        if (highTasks.length > 0) {
            sectionHigh.classList.remove('hidden');
            highTasks.forEach(task => {
                listHigh.appendChild(createTaskElement(task, task.originalIndex, currentActiveDate));
            });
        }
        
        if (normalTasks.length > 0) {
            sectionNormal.classList.remove('hidden');
            normalTasks.forEach(task => {
                listNormal.appendChild(createTaskElement(task, task.originalIndex, currentActiveDate));
            });
        }
    };

    const addTask = () => {
        const text = taskInput.value.trim();
        if (text === '') return;

        if (!plansData[currentActiveDate]) {
            plansData[currentActiveDate] = [];
        }

        plansData[currentActiveDate].push({ 
            text, 
            completed: false, 
            priority: isHighPriority ? 'high' : 'normal' 
        });
        saveData();

        taskInput.value = '';
        taskInput.focus();
    };

    addBtn.addEventListener('click', addTask);
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });

    deleteDayBtn.addEventListener('click', () => {
        if (confirm(`${getFormattedDate(currentActiveDate)}의 모든 플랜과 스케줄을 삭제하시겠습니까?`)) {
            delete plansData[currentActiveDate];
            delete scheduleData[currentActiveDate];
            delete memosData[currentActiveDate];
            saveData();
            saveScheduleData();
            saveMemosData();
            switchView('history'); 
        }
    });

    // ======================================
    // 전체 기록(히스토리) 뷰
    // ======================================

    const renderHistory = () => {
        historyContainer.innerHTML = '';
        
        const allDates = new Set([...Object.keys(plansData), ...Object.keys(scheduleData), ...Object.keys(memosData)]);
        const sortedDates = Array.from(allDates)
            .filter(date => (plansData[date] && plansData[date].length > 0) || (scheduleData[date] && Object.keys(scheduleData[date]).length > 0) || (memosData[date] && memosData[date].trim().length > 0))
            .sort((a, b) => new Date(b) - new Date(a));
        
        if (sortedDates.length === 0) {
            historyContainer.innerHTML = '<div class="empty-state">아직 작성된 플랜 기록이 없습니다.</div>';
            return;
        }

        const gridDiv = document.createElement('div');
        gridDiv.className = 'history-grid';

        sortedDates.forEach(date => {
            const tasks = plansData[date] || [];
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

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            switchView(item.dataset.target);
        });
    });

    // 날짜 변경 이벤트
    const handleDateChange = (e) => {
        if (e.target.value) {
            currentActiveDate = e.target.value;
            if (!viewDashboard.classList.contains('hidden')) {
                setDashAndScheduleHeader();
            } else if (!viewSchedule.classList.contains('hidden')) {
                renderHourlySchedule();
            } else if (!viewDaily.classList.contains('hidden')) {
                renderDailyTasks();
            }
        }
    };

    dashDatePicker.addEventListener('change', handleDateChange);
    scheduleDatePicker.addEventListener('change', handleDateChange);
    dailyDatePicker.addEventListener('change', handleDateChange);

    // 앱 초기화 구동
    switchView('dashboard');
});
