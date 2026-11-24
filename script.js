/**
 * ==========================================================================
 * My Task Manager - JavaScript
 * 태그 및 상태 복합 필터링 기능이 포함된 개인용 할 일 관리 위젯
 * 작성자: 10년차 시니어 프론트엔드 개발자
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // ------------------------------------------------------------------------
  // 1. 상수 및 전역 설정
  // ------------------------------------------------------------------------
  const STORAGE_KEY_TODOS = 'my_task_manager_todos';
  const STORAGE_KEY_INITIALIZED = 'my_task_manager_initialized';

  /**
   * 태그 메타데이터 (이모지 및 레이블 정보)
   */
  const TAG_METADATA = {
    '공부': { label: '공부', emoji: '📚' },
    '운동': { label: '운동', emoji: '💪' },
    '개인': { label: '개인', emoji: '🏠' },
    '업무': { label: '업무', emoji: '💼' },
    '기타': { label: '기타', emoji: '📌' }
  };

  /**
   * 최초 실행 시 제공되는 4가지 샘플 데이터 (Few-shot 예시 기반)
   */
  const DEFAULT_SAMPLE_TODOS = [
    {
      id: 'sample-1',
      text: '파이썬 과제 완료하기',
      tag: '공부',
      completed: false,
      createdAt: 1700000001000
    },
    {
      id: 'sample-2',
      text: '헬스장 가기',
      tag: '운동',
      completed: false,
      createdAt: 1700000002000
    },
    {
      id: 'sample-3',
      text: '프로젝트 보고서 작성',
      tag: '업무',
      completed: true,
      createdAt: 1700000003000
    },
    {
      id: 'sample-4',
      text: '자료구조 복습하기',
      tag: '공부',
      completed: true,
      createdAt: 1700000004000
    }
  ];

  // ------------------------------------------------------------------------
  // 2. 애플리케이션 상태 (State)
  // ------------------------------------------------------------------------
  let todos = [];
  let currentTagFilter = 'ALL';       // 'ALL' | '공부' | '운동' | '개인' | '업무' | '기타'
  let currentStatusFilter = 'ALL';    // 'ALL' | 'ACTIVE' | 'COMPLETED'
  let editingTodoId = null;           // 현재 인라인 편집 중인 할 일 ID

  // ------------------------------------------------------------------------
  // 3. DOM 요소 참조 캐싱
  // ------------------------------------------------------------------------
  const currentDateDisplay = document.getElementById('current-date-display');
  
  // 통계 및 진행률 요소
  const statTotal = document.getElementById('stat-total');
  const statCompleted = document.getElementById('stat-completed');
  const statPending = document.getElementById('stat-pending');
  const progressText = document.getElementById('progress-text');
  const progressFill = document.getElementById('progress-fill');

  // 입력 폼 요소
  const todoForm = document.getElementById('todo-form');
  const todoInput = document.getElementById('todo-input');
  const todoTagSelect = document.getElementById('todo-tag-select');
  const inputErrorMsg = document.getElementById('input-error');

  // 필터 버튼 그룹 요소
  const tagFilterGroup = document.getElementById('tag-filter-group');
  const statusFilterGroup = document.getElementById('status-filter-group');

  // 목록 및 빈 상태 요소
  const todoList = document.getElementById('todo-list');
  const listCountBadge = document.getElementById('list-count-badge');
  const emptyState = document.getElementById('empty-state');
  const emptyTitle = document.getElementById('empty-title');
  const emptyDesc = document.getElementById('empty-desc');

  // ------------------------------------------------------------------------
  // 4. 데이터 영속화 (LocalStorage 핸들러)
  // ------------------------------------------------------------------------
  /**
   * 로컬 스토리지에서 할 일 목록을 불러옵니다.
   * 첫 방문 시에만 기본 샘플 데이터를 등록하며, 이후에는 빈 배열이어도 재생성하지 않습니다.
   * 브라우저 보안 정책이나 시크릿 모드 등으로 인한 LocalStorage 접근 차단 시에도
   * 프로그램이 중단되지 않도록 안전하게 예외 처리(Fallback)되어 있습니다.
   */
  function loadTodosFromStorage() {
    try {
      const isInitialized = localStorage.getItem(STORAGE_KEY_INITIALIZED);

      if (!isInitialized) {
        // 최초 실행인 경우: 샘플 데이터 저장 및 초기화 플래그 설정
        todos = [...DEFAULT_SAMPLE_TODOS];
        saveTodosToStorage();
        try {
          localStorage.setItem(STORAGE_KEY_INITIALIZED, 'true');
        } catch (e) {
          console.warn('초기화 플래그 저장 실패:', e);
        }
      } else {
        // 이미 초기화된 적이 있는 경우: 저장된 데이터 불러오기
        const stored = localStorage.getItem(STORAGE_KEY_TODOS);
        todos = stored ? JSON.parse(stored) : [];
      }
    } catch (error) {
      console.warn('LocalStorage 접근 제한 또는 파싱 오류 발생. 메모리 모드로 전환합니다:', error);
      if (!todos || todos.length === 0) {
        todos = [...DEFAULT_SAMPLE_TODOS];
      }
    }
  }

  /**
   * 현재 상태의 todos 배열을 로컬스토리지에 저장합니다.
   */
  function saveTodosToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_TODOS, JSON.stringify(todos));
    } catch (error) {
      console.warn('LocalStorage 데이터 저장 실패:', error);
    }
  }

  // ------------------------------------------------------------------------
  // 5. 날짜 표시 유틸리티
  // ------------------------------------------------------------------------
  function renderCurrentDate() {
    if (!currentDateDisplay) return;
    try {
      const now = new Date();
      const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' };
      currentDateDisplay.textContent = now.toLocaleDateString('ko-KR', options);
    } catch (error) {
      console.warn('날짜 렌더링 오류:', error);
    }
  }

  // ------------------------------------------------------------------------
  // 6. 통계 및 진행률 계산 및 렌더링
  // ------------------------------------------------------------------------
  function updateDashboardStats() {
    const totalCount = todos.length;
    const completedCount = todos.filter(t => t.completed).length;
    const pendingCount = totalCount - completedCount;
    const percentage = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

    // 텍스트 업데이트 (방어적 DOM 접근)
    if (statTotal) statTotal.textContent = totalCount;
    if (statCompleted) statCompleted.textContent = completedCount;
    if (statPending) statPending.textContent = pendingCount;
    if (progressText) progressText.textContent = `${percentage}%`;

    // 프로그레스 바 너비 및 접근성 속성 업데이트
    if (progressFill) progressFill.style.width = `${percentage}%`;
    const progressTrack = document.querySelector('.progress-bar-track');
    if (progressTrack) {
      progressTrack.setAttribute('aria-valuenow', percentage);
    }
  }

  // ------------------------------------------------------------------------
  // 7. 필터링 및 할 일 목록 렌더링
  // ------------------------------------------------------------------------
  /**
   * 태그 및 상태 복합 필터 조건에 맞게 할 일 항목을 필터링하고 정렬합니다.
   * - 1순위: 미완료 항목을 목록 상단, 완료 항목을 목록 하단에 배치
   * - 2순위: 동일한 완료 상태 내에서는 기존 등록 순서를 온전히 유지
   */
  function getFilteredTodos() {
    // 1단계: 태그 및 상태 조건에 따른 필터링
    const filtered = todos.filter(todo => {
      // 1) 태그 필터 검사
      const matchTag = (currentTagFilter === 'ALL') || (todo.tag === currentTagFilter);

      // 2) 완료 상태 필터 검사
      let matchStatus = true;
      if (currentStatusFilter === 'ACTIVE') {
        matchStatus = !todo.completed;
      } else if (currentStatusFilter === 'COMPLETED') {
        matchStatus = todo.completed;
      }

      return matchTag && matchStatus;
    });

    // 2단계: 완료 상태 기준 정렬 (미완료 상단, 완료 하단 / 동일 상태 내 등록 순서 유지)
    const activeList = filtered.filter(todo => !todo.completed);
    const completedList = filtered.filter(todo => todo.completed);

    return [...activeList, ...completedList];
  }

  /**
   * 전체 화면(통계, 목록, 빈 상태 등)을 재렌더링합니다.
   */
  function render() {
    // 1) 대시보드 통계 업데이트
    updateDashboardStats();

    // 2) 필터링된 할 일 목록 조회
    const filteredTodos = getFilteredTodos();
    listCountBadge.textContent = `${filteredTodos.length}개 항목`;

    // 3) 목록 컨테이너 초기화
    todoList.innerHTML = '';

    // 4) 빈 상태 처리 (Empty State)
    if (todos.length === 0) {
      // 전체 등록된 할 일이 없는 경우
      emptyState.style.display = 'flex';
      todoList.style.display = 'none';
      emptyTitle.textContent = '등록된 할 일이 없습니다.';
      emptyDesc.textContent = '새로운 할 일을 추가하여 오늘 하루를 계획해 보세요!';
      return;
    }

    if (filteredTodos.length === 0) {
      // 등록된 할 일은 있으나 현재 필터 조건에 맞는 항목이 없는 경우
      emptyState.style.display = 'flex';
      todoList.style.display = 'none';
      emptyTitle.textContent = '해당 조건의 할 일이 없습니다.';
      emptyDesc.textContent = '다른 태그나 상태 필터를 선택하여 확인해 보세요.';
      return;
    }

    // 조건에 맞는 항목이 있는 경우
    emptyState.style.display = 'none';
    todoList.style.display = 'flex';

    // 5) 각 할 일 아이템 생성 및 삽입
    filteredTodos.forEach(todo => {
      const itemElement = createTodoItemElement(todo);
      todoList.appendChild(itemElement);
    });
  }

  /**
   * 개별 할 일 아이템의 DOM 요소를 생성합니다.
   * 인라인 수정 모드인 경우 편집 폼으로 렌더링합니다.
   */
  function createTodoItemElement(todo) {
    const li = document.createElement('li');
    li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
    li.dataset.id = todo.id;

    // 만약 현재 아이템이 수정 중인 경우 -> 인라인 편집 UI 렌더링
    if (editingTodoId === todo.id) {
      li.appendChild(createInlineEditForm(todo));
      return li;
    }

    // 일반 표시 모드 ----------------------------------------------------
    // 체크박스
    const checkboxWrapper = document.createElement('label');
    checkboxWrapper.className = 'checkbox-container';
    checkboxWrapper.title = todo.completed ? '미완료로 변경' : '완료로 변경';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'todo-checkbox';
    checkbox.checked = todo.completed;
    checkbox.setAttribute('aria-label', `${todo.text} 완료 여부`);
    checkbox.addEventListener('change', () => handleToggleTodo(todo.id));

    checkboxWrapper.appendChild(checkbox);

    // 내용 및 태그 영역
    const contentArea = document.createElement('div');
    contentArea.className = 'todo-content-area';

    // 태그 배지
    const tagBadge = document.createElement('span');
    tagBadge.className = 'tag-badge';
    tagBadge.dataset.tag = todo.tag;
    const tagInfo = TAG_METADATA[todo.tag] || { label: todo.tag, emoji: '📌' };
    tagBadge.textContent = `${tagInfo.emoji} ${tagInfo.label}`;

    // 할 일 텍스트
    const todoText = document.createElement('span');
    todoText.className = 'todo-text';
    todoText.textContent = todo.text;

    contentArea.appendChild(tagBadge);
    contentArea.appendChild(todoText);

    // 작업 버튼 영역 (수정, 삭제)
    const actionsArea = document.createElement('div');
    actionsArea.className = 'todo-actions';

    // 수정 버튼
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'action-btn edit-btn';
    editBtn.title = '할 일 수정';
    editBtn.setAttribute('aria-label', '할 일 수정');
    editBtn.innerHTML = `
      <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    `;
    editBtn.addEventListener('click', () => handleStartEdit(todo.id));

    // 삭제 버튼
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'action-btn delete-btn';
    deleteBtn.title = '할 일 삭제';
    deleteBtn.setAttribute('aria-label', '할 일 삭제');
    deleteBtn.innerHTML = `
      <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
    `;
    deleteBtn.addEventListener('click', () => handleDeleteTodo(todo.id));

    actionsArea.appendChild(editBtn);
    actionsArea.appendChild(deleteBtn);

    // 조립
    li.appendChild(checkboxWrapper);
    li.appendChild(contentArea);
    li.appendChild(actionsArea);

    return li;
  }

  /**
   * 할 일 카드 내부의 인라인 수정 폼을 생성합니다.
   */
  function createInlineEditForm(todo) {
    const form = document.createElement('form');
    form.className = 'todo-edit-form';

    // 텍스트 인풋
    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.className = 'edit-input';
    editInput.value = todo.text;
    editInput.maxLength = 150;
    editInput.required = true;

    // 태그 선택 셀렉트박스
    const editSelect = document.createElement('select');
    editSelect.className = 'edit-select';
    Object.keys(TAG_METADATA).forEach(tagName => {
      const option = document.createElement('option');
      option.value = tagName;
      option.textContent = `${TAG_METADATA[tagName].emoji} ${TAG_METADATA[tagName].label}`;
      if (tagName === todo.tag) {
        option.selected = true;
      }
      editSelect.appendChild(option);
    });

    // 버튼 액션 그룹
    const actions = document.createElement('div');
    actions.className = 'edit-actions';

    // 저장 버튼
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'btn btn-sm btn-save';
    saveBtn.textContent = '저장';

    // 취소 버튼
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-sm btn-cancel';
    cancelBtn.textContent = '취소';
    cancelBtn.addEventListener('click', () => {
      editingTodoId = null;
      render();
    });

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);

    form.appendChild(editInput);
    form.appendChild(editSelect);
    form.appendChild(actions);

    // 폼 제출(저장) 이벤트
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSaveEdit(todo.id, editInput.value, editSelect.value);
    });

    // Esc 키 누를 때 수정 취소
    editInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        editingTodoId = null;
        render();
      }
    });

    // 인라인 인풋에 자동 포커스
    setTimeout(() => {
      editInput.focus();
      editInput.select();
    }, 50);

    return form;
  }

  // ------------------------------------------------------------------------
  // 8. 할 일 동작 핸들러 (CRUD 로직)
  // ------------------------------------------------------------------------
  /**
   * 새로운 할 일 등록 처리
   */
  function handleAddTodo(e) {
    e.preventDefault();

    const text = todoInput.value.trim();
    const tag = todoTagSelect.value;

    // 내용 유효성 검사 (공백만 있는 경우 차단)
    if (!text) {
      showInputError('할 일 내용을 입력해 주세요.');
      todoInput.focus();
      return;
    }

    hideInputError();

    // 새 Todo 객체 생성
    const newTodo = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      text: text,
      tag: tag,
      completed: false,
      createdAt: Date.now()
    };

    // 목록 맨 앞에 추가
    todos.unshift(newTodo);
    saveTodosToStorage();

    // 폼 초기화 및 렌더링
    todoInput.value = '';
    todoInput.focus();
    render();
  }

  /**
   * 완료 여부 토글 처리
   */
  function handleToggleTodo(id) {
    const target = todos.find(t => t.id === id);
    if (!target) return;

    target.completed = !target.completed;
    saveTodosToStorage();
    render();
  }

  /**
   * 할 일 삭제 처리 (확인 메시지 포함)
   */
  function handleDeleteTodo(id) {
    const target = todos.find(t => t.id === id);
    if (!target) return;

    const confirmed = confirm(`"${target.text}"\n이 할 일을 정말 삭제하시겠습니까?`);
    if (!confirmed) return;

    todos = todos.filter(t => t.id !== id);
    if (editingTodoId === id) {
      editingTodoId = null;
    }

    saveTodosToStorage();
    render();
  }

  /**
   * 수정 모드 진입
   */
  function handleStartEdit(id) {
    editingTodoId = id;
    render();
  }

  /**
   * 수정 저장 처리
   */
  function handleSaveEdit(id, newText, newTag) {
    const trimmedText = newText.trim();
    if (!trimmedText) {
      alert('할 일 내용은 비어 있을 수 없습니다.');
      return;
    }

    const target = todos.find(t => t.id === id);
    if (target) {
      target.text = trimmedText;
      target.tag = newTag;
      saveTodosToStorage();
    }

    editingTodoId = null;
    render();
  }

  // ------------------------------------------------------------------------
  // 9. 입력 검증 에러 메시지 유틸리티
  // ------------------------------------------------------------------------
  function showInputError(message) {
    inputErrorMsg.textContent = message;
    inputErrorMsg.style.display = 'block';
  }

  function hideInputError() {
    inputErrorMsg.style.display = 'none';
  }

  // ------------------------------------------------------------------------
  // 10. 필터 이벤트 리스너 바인딩
  // ------------------------------------------------------------------------
  /**
   * 태그 필터 버튼 클릭 이벤트 위임
   */
  tagFilterGroup.addEventListener('click', (e) => {
    const button = e.target.closest('.filter-chip');
    if (!button) return;

    const selectedTag = button.dataset.tag;
    if (currentTagFilter === selectedTag) return;

    // 활성 클래스 전환
    tagFilterGroup.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    currentTagFilter = selectedTag;
    render();
  });

  /**
   * 완료 상태 필터 버튼 클릭 이벤트 위임
   */
  statusFilterGroup.addEventListener('click', (e) => {
    const button = e.target.closest('.filter-chip');
    if (!button) return;

    const selectedStatus = button.dataset.status;
    if (currentStatusFilter === selectedStatus) return;

    // 활성 클래스 전환
    statusFilterGroup.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    currentStatusFilter = selectedStatus;
    render();
  });

  // ------------------------------------------------------------------------
  // 11. 폼 이벤트 바인딩
  // ------------------------------------------------------------------------
  todoForm.addEventListener('submit', handleAddTodo);

  // 실시간 입력 시 에러 메시지 해제
  todoInput.addEventListener('input', () => {
    if (inputErrorMsg.style.display !== 'none' && todoInput.value.trim().length > 0) {
      hideInputError();
    }
  });

  // ------------------------------------------------------------------------
  // 12. 초기 실행 (Bootstrap)
  // ------------------------------------------------------------------------
  renderCurrentDate();
  loadTodosFromStorage();
  render();
});
