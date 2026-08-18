// BAKEWEB 웹 저장 기능에서 사용할 설정과 세션 키입니다.
const bwkCloudConfig = window.BAKEWEB_CONFIG || {};
const bwkSessionKey = 'bakeweb-admin-session-v1';

// 현재 로그인 세션과 편집 중인 서버 견적서 ID를 메모리에 보관합니다.
let bwkCloudSession = null;
let bwkActiveQuoteId = null;
let bwkCloudQuotes = [];
let bwkToastTimer = null;

// 설정값 끝의 슬래시를 제거해 API 주소가 이중 슬래시가 되지 않게 합니다.
const bwkCloudBaseUrl = String(bwkCloudConfig.supabaseUrl || '').replace(/\/$/, '');

// 공개 프로젝트 URL과 키가 모두 입력되었는지 확인합니다.
const bwkCloudIsConfigured = () => Boolean(bwkCloudBaseUrl && bwkCloudConfig.supabasePublishableKey);

// Supabase API에 공통으로 사용할 헤더를 생성합니다.
const bwkCloudHeaders = (includeAuth = true) => {
  // 공개 키는 프로젝트 식별용 apikey 헤더에만 넣습니다.
  const headers = {
    apikey: bwkCloudConfig.supabasePublishableKey,
    'Content-Type': 'application/json'
  };
  // 로그인한 요청에는 사용자 JWT를 Authorization 헤더에 추가합니다.
  if (includeAuth && bwkCloudSession?.access_token) {
    headers.Authorization = `Bearer ${bwkCloudSession.access_token}`;
  }
  return headers;
};

// 서버가 반환한 오류를 사용자가 이해할 수 있는 한국어 문구로 정리합니다.
const bwkCloudErrorMessage = (payload, fallback = '요청을 처리하지 못했습니다.') => {
  const raw = payload?.msg || payload?.message || payload?.error_description || payload?.error || '';
  if (/invalid login credentials/i.test(raw)) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (/email not confirmed/i.test(raw)) return '이메일 인증을 완료한 뒤 다시 로그인해 주세요.';
  if (/jwt expired/i.test(raw)) return '로그인 시간이 만료되었습니다. 다시 로그인해 주세요.';
  return raw || fallback;
};

// 짧은 작업 결과를 화면 우측 하단에 표시합니다.
const bwkShowToast = (message) => {
  const toast = bwkGet('bwk-toast');
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(bwkToastTimer);
  bwkToastTimer = window.setTimeout(() => { toast.hidden = true; }, 2600);
};

// 세션을 sessionStorage에 저장해 브라우저 탭을 닫으면 자동 로그아웃되게 합니다.
const bwkStoreSession = (session) => {
  bwkCloudSession = session;
  sessionStorage.setItem(bwkSessionKey, JSON.stringify(session));
};

// 저장된 refresh token으로 만료된 사용자 세션을 갱신합니다.
const bwkRefreshSession = async () => {
  if (!bwkCloudSession?.refresh_token) return false;
  const response = await fetch(`${bwkCloudBaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: bwkCloudHeaders(false),
    body: JSON.stringify({ refresh_token: bwkCloudSession.refresh_token })
  });
  if (!response.ok) return false;
  const refreshed = await response.json();
  bwkStoreSession(refreshed);
  return true;
};

// 데이터 API 요청 중 인증이 만료되면 한 번 갱신한 뒤 동일 요청을 재시도합니다.
const bwkCloudFetch = async (path, options = {}, retry = true) => {
  const response = await fetch(`${bwkCloudBaseUrl}${path}`, {
    ...options,
    headers: { ...bwkCloudHeaders(true), ...(options.headers || {}) }
  });
  if (response.status === 401 && retry && await bwkRefreshSession()) {
    return bwkCloudFetch(path, options, false);
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(bwkCloudErrorMessage(payload));
  }
  if (response.status === 204) return null;
  return response.json();
};

// 로그인 화면과 견적 앱을 상호 배타적으로 전환합니다.
const bwkSetAuthenticatedView = (authenticated) => {
  bwkGet('bwk-login-gate').hidden = authenticated;
  bwkGet('bwk-quote-app').hidden = !authenticated;
  if (authenticated) bwkGet('bwk-editor-nav').focus();
};

// 이메일과 비밀번호를 검사하고 접근성 오류 문구를 연결합니다.
const bwkValidateLogin = () => {
  const emailInput = bwkGet('bwk-login-email');
  const passwordInput = bwkGet('bwk-login-password');
  let valid = true;
  bwkGet('bwk-login-email-error').textContent = '';
  bwkGet('bwk-login-password-error').textContent = '';
  emailInput.removeAttribute('aria-invalid');
  passwordInput.removeAttribute('aria-invalid');
  if (!emailInput.validity.valid) {
    bwkGet('bwk-login-email-error').textContent = '올바른 이메일 주소를 입력해 주세요.';
    emailInput.setAttribute('aria-invalid', 'true');
    valid = false;
  }
  if (!passwordInput.value) {
    bwkGet('bwk-login-password-error').textContent = '비밀번호를 입력해 주세요.';
    passwordInput.setAttribute('aria-invalid', 'true');
    valid = false;
  }
  if (!valid) (emailInput.validity.valid ? passwordInput : emailInput).focus();
  return valid;
};

// 관리자 이메일과 비밀번호로 Supabase Auth에 로그인합니다.
const bwkSignIn = async (email, password) => {
  const response = await fetch(`${bwkCloudBaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: bwkCloudHeaders(false),
    body: JSON.stringify({ email, password })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(bwkCloudErrorMessage(payload));
  bwkStoreSession(payload);
  return payload;
};

// 세션의 JWT가 실제로 유효한지 사용자 API로 확인합니다.
const bwkVerifySession = async () => {
  if (!bwkCloudSession?.access_token) return false;
  const response = await fetch(`${bwkCloudBaseUrl}/auth/v1/user`, { headers: bwkCloudHeaders(true) });
  if (response.ok) return true;
  if (response.status === 401 && await bwkRefreshSession()) return true;
  return false;
};

// 편집 상태에서 서버 목록용 총액을 계산합니다.
const bwkCloudCalculateTotal = (state) => {
  const enteredTotal = state.items.reduce((sum, item) => sum + (Math.max(1, Number(item.quantity) || 1) * Math.max(0, Number(item.price) || 0)), 0);
  if (state.taxIncluded !== false) return enteredTotal;
  return enteredTotal + Math.round(enteredTotal * 0.1);
};

// 현재 편집 내용을 quotes 테이블 형식으로 변환합니다.
const bwkBuildQuotePayload = () => {
  const state = bwkCollectState();
  return {
    user_id: bwkCloudSession.user.id,
    quote_number: state.quoteNumber.trim() || '번호 없음',
    issue_date: state.issueDate || null,
    status: state.status || 'draft',
    project_name: state.projectName.trim(),
    client_name: state.clientName.trim(),
    total_amount: bwkCloudCalculateTotal(state),
    quote_data: state,
    updated_at: new Date().toISOString()
  };
};

// 현재 견적서를 새로 저장하거나 기존 서버 행을 수정합니다.
const bwkSaveQuoteToCloud = async () => {
  const saveButton = bwkGet('bwk-cloud-save');
  const originalText = saveButton.innerHTML;
  saveButton.disabled = true;
  saveButton.textContent = '저장 중...';
  try {
    const payload = bwkBuildQuotePayload();
    const path = bwkActiveQuoteId ? `/rest/v1/quotes?id=eq.${encodeURIComponent(bwkActiveQuoteId)}` : '/rest/v1/quotes';
    const method = bwkActiveQuoteId ? 'PATCH' : 'POST';
    const result = await bwkCloudFetch(path, {
      method,
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    });
    if (!bwkActiveQuoteId && result?.[0]?.id) bwkActiveQuoteId = result[0].id;
    bwkShowToast(bwkActiveQuoteId ? '견적서를 웹에 저장했습니다.' : '견적서를 저장했습니다.');
    await bwkLoadQuoteList();
  } catch (error) {
    bwkShowToast(`저장 실패: ${error.message}`);
  } finally {
    saveButton.disabled = false;
    saveButton.innerHTML = originalText;
  }
};

// 상태 코드에 대응하는 한국어 표시 이름을 반환합니다.
const bwkStatusLabel = (status) => ({ draft: '작성 중', sent: '발송 완료', approved: '승인', cancelled: '취소' }[status] || '작성 중');

// 견적 목록을 검색어에 맞춰 안전한 카드 HTML로 렌더링합니다.
const bwkRenderQuoteList = () => {
  const keyword = bwkGet('bwk-list-search').value.trim().toLocaleLowerCase('ko-KR');
  const filtered = bwkCloudQuotes.filter((quote) => [quote.quote_number, quote.client_name, quote.project_name]
    .some((value) => String(value || '').toLocaleLowerCase('ko-KR').includes(keyword)));
  bwkGet('bwk-empty-state').hidden = filtered.length > 0;
  bwkGet('bwk-quote-list').innerHTML = filtered.map((quote) => `
    <article class="bwk-quote-card" data-id="${bwkEscapeHtml(quote.id)}">
      <!-- 견적번호는 문서를 빠르게 식별하는 보조 정보입니다. -->
      <span class="bwk-quote-card__number">${bwkEscapeHtml(quote.quote_number || '번호 없음')}</span>
      <!-- 고객명과 프로젝트명을 한 묶음으로 표시합니다. -->
      <div class="bwk-quote-card__main">
        <strong>${bwkEscapeHtml(quote.client_name || '고객명 없음')}</strong>
        <span>${bwkEscapeHtml(quote.project_name || '프로젝트명 없음')}</span>
      </div>
      <!-- 서버에 저장한 최종 총액을 원화로 표시합니다. -->
      <strong class="bwk-quote-card__amount">${bwkFormatCurrency(quote.total_amount)}</strong>
      <!-- 상태는 텍스트와 색상을 함께 사용합니다. -->
      <span class="bwk-status bwk-status--${bwkEscapeHtml(quote.status)}">${bwkStatusLabel(quote.status)}</span>
      <div class="bwk-quote-card__actions">
        <button class="bwk-card-action bwk-open-quote" type="button">열기</button>
        <button class="bwk-card-action bwk-card-action--delete bwk-delete-quote" type="button">삭제</button>
      </div>
    </article>
  `).join('');
};

// 로그인한 사용자의 견적서만 최신 수정 순으로 조회합니다.
const bwkLoadQuoteList = async () => {
  bwkGet('bwk-cloud-message').textContent = '견적서를 불러오는 중입니다.';
  try {
    bwkCloudQuotes = await bwkCloudFetch('/rest/v1/quotes?select=id,quote_number,issue_date,status,project_name,client_name,total_amount,quote_data,updated_at&order=updated_at.desc');
    bwkRenderQuoteList();
    bwkGet('bwk-cloud-message').textContent = `${bwkCloudQuotes.length}개의 견적서가 저장되어 있습니다.`;
  } catch (error) {
    bwkGet('bwk-cloud-message').textContent = `목록을 불러오지 못했습니다: ${error.message}`;
    bwkCloudQuotes = [];
    bwkRenderQuoteList();
  }
};

// 작성 화면과 저장 목록 화면을 동일한 DOM 안에서 전환합니다.
const bwkSwitchWorkspace = (view) => {
  const isEditor = view === 'editor';
  bwkGet('bwk-editor').closest('.bwk-workspace').hidden = !isEditor;
  bwkGet('bwk-list-view').hidden = isEditor;
  bwkGet('bwk-editor-nav').classList.toggle('is-active', isEditor);
  bwkGet('bwk-list-nav').classList.toggle('is-active', !isEditor);
  bwkGet('bwk-editor-nav').toggleAttribute('aria-current', isEditor);
  bwkGet('bwk-list-nav').toggleAttribute('aria-current', !isEditor);
  bwkGet('bwk-cloud-save').hidden = !isEditor;
  bwkGet('bwk-print-button').hidden = !isEditor;
  if (!isEditor) bwkLoadQuoteList();
};

// 새로운 견적서에 사용할 날짜 기반 번호를 만듭니다.
const bwkCreateQuoteNumber = () => {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  return `BW-${date}-${time}`;
};

// 서버 견적과 분리된 새 문서를 기본값으로 시작합니다.
const bwkStartNewQuote = () => {
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  bwkActiveQuoteId = null;
  bwkApplyState({
    quoteNumber: bwkCreateQuoteNumber(),
    issueDate: localToday,
    validDays: 14,
    projectName: '',
    status: 'draft',
    clientName: '',
    clientManager: '',
    clientPhone: '',
    clientEmail: '',
    scope: bwkDefaultScope,
    paymentTerms: '계약금 50% 입금 후 작업을 시작하며, 잔금 50% 입금 후 사이트를 최종 이전합니다.',
    note: '본 견적은 협의된 작업 범위를 기준으로 하며, 범위 변경 시 비용과 일정이 조정될 수 있습니다.',
    taxIncluded: true,
    items: bwkDefaultItems
  });
  bwkSaveState();
  bwkSwitchWorkspace('editor');
  bwkShowToast('새 견적서를 시작했습니다.');
};

// 로그인 폼 제출 시 로딩 상태와 오류 피드백을 제공합니다.
bwkGet('bwk-login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!bwkCloudIsConfigured() || !bwkValidateLogin()) return;
  const button = bwkGet('bwk-login-submit');
  const errorBox = bwkGet('bwk-login-error');
  button.disabled = true;
  button.textContent = '로그인 중...';
  errorBox.textContent = '';
  try {
    await bwkSignIn(bwkGet('bwk-login-email').value.trim(), bwkGet('bwk-login-password').value);
    bwkGet('bwk-login-password').value = '';
    bwkSetAuthenticatedView(true);
    bwkShowToast('로그인했습니다.');
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.focus();
  } finally {
    button.disabled = false;
    button.textContent = '로그인';
  }
});

// 상단 메뉴와 저장 버튼의 동작을 연결합니다.
bwkGet('bwk-editor-nav').addEventListener('click', () => bwkSwitchWorkspace('editor'));
bwkGet('bwk-list-nav').addEventListener('click', () => bwkSwitchWorkspace('list'));
bwkGet('bwk-cloud-save').addEventListener('click', bwkSaveQuoteToCloud);
bwkGet('bwk-new-quote').addEventListener('click', bwkStartNewQuote);
bwkGet('bwk-list-search').addEventListener('input', bwkRenderQuoteList);

// 목록의 열기와 삭제 버튼은 이벤트 위임으로 처리합니다.
bwkGet('bwk-quote-list').addEventListener('click', async (event) => {
  const card = event.target.closest('.bwk-quote-card');
  if (!card) return;
  const quote = bwkCloudQuotes.find((item) => item.id === card.dataset.id);
  if (!quote) return;
  if (event.target.closest('.bwk-open-quote')) {
    bwkActiveQuoteId = quote.id;
    bwkApplyState(quote.quote_data);
    bwkSaveState();
    bwkSwitchWorkspace('editor');
    bwkShowToast('저장된 견적서를 열었습니다.');
  }
  if (event.target.closest('.bwk-delete-quote')) {
    const confirmed = window.confirm(`‘${quote.client_name || quote.quote_number}’ 견적서를 삭제할까요? 삭제 후 복구할 수 없습니다.`);
    if (!confirmed) return;
    try {
      await bwkCloudFetch(`/rest/v1/quotes?id=eq.${encodeURIComponent(quote.id)}`, { method: 'DELETE' });
      if (bwkActiveQuoteId === quote.id) bwkActiveQuoteId = null;
      await bwkLoadQuoteList();
      bwkShowToast('견적서를 삭제했습니다.');
    } catch (error) {
      bwkShowToast(`삭제 실패: ${error.message}`);
    }
  }
});

// 로그아웃 시 현재 탭의 인증 세션만 제거하고 로그인 화면으로 돌아갑니다.
bwkGet('bwk-logout').addEventListener('click', async () => {
  try {
    await fetch(`${bwkCloudBaseUrl}/auth/v1/logout`, { method: 'POST', headers: bwkCloudHeaders(true) });
  } catch (error) {
    // 네트워크가 끊겨도 로컬 세션은 제거해 화면 접근을 차단합니다.
  }
  sessionStorage.removeItem(bwkSessionKey);
  bwkCloudSession = null;
  bwkActiveQuoteId = null;
  bwkSetAuthenticatedView(false);
  bwkGet('bwk-login-email').focus();
});

// 페이지 진입 시 연결 설정과 기존 로그인 세션을 확인합니다.
const bwkInitializeCloud = async () => {
  if (!bwkCloudIsConfigured()) {
    bwkGet('bwk-setup-notice').hidden = false;
    bwkGet('bwk-login-submit').disabled = true;
    return;
  }
  try {
    bwkCloudSession = JSON.parse(sessionStorage.getItem(bwkSessionKey) || 'null');
  } catch (error) {
    bwkCloudSession = null;
  }
  if (await bwkVerifySession()) {
    bwkSetAuthenticatedView(true);
  } else {
    sessionStorage.removeItem(bwkSessionKey);
    bwkCloudSession = null;
    bwkSetAuthenticatedView(false);
  }
};

// 견적 앱의 초기 렌더링 뒤에 인증 초기화를 실행합니다.
bwkInitializeCloud();
