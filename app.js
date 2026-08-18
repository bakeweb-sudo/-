// BAKEWEB 견적서 앱에서 사용할 브라우저 저장 키입니다.
const bwkStorageKey = 'bakeweb-quote-draft-v2';

// 견적 항목의 초기 예시 데이터입니다.
const bwkDefaultItems = [
  { name: '홈페이지 기획 및 설계', description: '사이트 구조 설계 및 콘텐츠 흐름 구성', quantity: 1, price: 500000 },
  { name: '반응형 웹디자인', description: 'PC·노트북·모바일 화면 최적화', quantity: 1, price: 1200000 },
  { name: '아임웹 구축', description: '페이지 제작 및 기본 기능 설정', quantity: 1, price: 800000 }
];

// 모든 홈페이지 제작 견적에 공통으로 사용할 기본 작업 범위입니다.
const bwkDefaultScope = `- 홈페이지 기획 및 페이지 구조 구성
- PC·노트북·모바일 반응형 디자인
- 아임웹 페이지 제작 및 기본 설정
- 제공된 원고 및 이미지 적용
- 메뉴·버튼·문의 링크 연결
- 화면 크기별 반응형 및 기본 동작 점검
- 최종 검수 및 오픈 전 확인

※ 세부 페이지 수와 추가 기능은 견적 항목에 기재된 범위를 기준으로 합니다.`;

// 현재 편집 중인 견적 항목을 메모리에 보관합니다.
let bwkItems = [];

// 자주 사용하는 DOM 탐색을 짧고 명확하게 처리합니다.
const bwkGet = (id) => document.getElementById(id);

// 숫자를 대한민국 원화 표기법으로 변환합니다.
const bwkFormatCurrency = (value) => `${Math.round(Number(value) || 0).toLocaleString('ko-KR')}원`;

// 날짜 입력값을 견적서에서 읽기 쉬운 형식으로 변환합니다.
const bwkFormatDate = (value) => {
  // 날짜가 비어 있으면 대시를 반환합니다.
  if (!value) return '-';
  // 타임존에 따른 날짜 밀림을 피하기 위해 문자열을 직접 분리합니다.
  const [year, month, day] = value.split('-');
  // 한국어 문서 형식으로 조합해 반환합니다.
  return `${year}. ${month}. ${day}.`;
};

// 입력한 날짜에 유효 일수를 더한 날짜를 계산합니다.
const bwkCalculateValidDate = (dateValue, daysValue) => {
  // 날짜가 없다면 유효기간을 표시하지 않습니다.
  if (!dateValue) return '-';
  // 현지 시간 기준으로 안전하게 날짜 객체를 만듭니다.
  const [year, month, day] = dateValue.split('-').map(Number);
  const result = new Date(year, month - 1, day);
  // 최소 1일을 적용해 잘못된 입력을 방어합니다.
  result.setDate(result.getDate() + Math.max(1, Number(daysValue) || 1));
  // 계산된 날짜를 한국어 문서 형식으로 반환합니다.
  return `${result.getFullYear()}. ${String(result.getMonth() + 1).padStart(2, '0')}. ${String(result.getDate()).padStart(2, '0')}.`;
};

// HTML 삽입 전 특수 문자를 이스케이프해 사용자 입력을 안전하게 표시합니다.
const bwkEscapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

// 견적 항목 편집 행을 화면에 생성합니다.
const bwkRenderItemEditor = () => {
  // 모든 항목을 입력 가능한 카드 행으로 변환합니다.
  bwkGet('bwk-items').innerHTML = bwkItems.map((item, index) => `
    <div class="bwk-item-row" data-index="${index}">
      <!-- 항목명은 견적 표의 첫 번째 열에 표시됩니다. -->
      <input class="bwk-item-name" type="text" value="${bwkEscapeHtml(item.name)}" aria-label="${index + 1}번 항목명" placeholder="항목명">
      <!-- 수량은 1 이상의 숫자만 입력할 수 있습니다. -->
      <input class="bwk-item-quantity" type="number" value="${item.quantity}" min="1" inputmode="numeric" aria-label="${index + 1}번 수량">
      <!-- 단가는 음수가 되지 않도록 제한합니다. -->
      <input class="bwk-item-price" type="number" value="${item.price}" min="0" step="1000" inputmode="numeric" aria-label="${index + 1}번 단가">
      <!-- 삭제 버튼에는 화면낭독기용 항목 번호를 제공합니다. -->
      <button class="bwk-remove-item" type="button" aria-label="${index + 1}번 견적 항목 삭제">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <!-- 설명은 카드의 전체 너비를 사용해 긴 문장도 안정적으로 입력합니다. -->
      <input class="bwk-item-description" type="text" value="${bwkEscapeHtml(item.description)}" aria-label="${index + 1}번 항목 설명" placeholder="작업 설명">
    </div>
  `).join('');
};

// 편집기의 현재 값을 견적서 미리보기에 반영합니다.
const bwkUpdatePreview = () => {
  // 고객 기본 정보를 빈 값에 대한 안내 문구와 함께 표시합니다.
  const clientName = bwkGet('bwk-client-name').value.trim() || '고객명을 입력해 주세요';
  const manager = bwkGet('bwk-client-manager').value.trim();
  const phone = bwkGet('bwk-client-phone').value.trim();
  const email = bwkGet('bwk-client-email').value.trim();
  bwkGet('bwk-preview-client').textContent = clientName;
  bwkGet('bwk-preview-manager').textContent = manager ? `${manager} 담당자님` : '담당자 정보';
  bwkGet('bwk-preview-contact').textContent = [phone, email].filter(Boolean).join(' · ') || '연락처 · 이메일';

  // 문서번호, 날짜, 프로젝트명을 각각 대응하는 영역에 표시합니다.
  bwkGet('bwk-preview-number').textContent = bwkGet('bwk-quote-number').value.trim() || '-';
  bwkGet('bwk-preview-date').textContent = bwkFormatDate(bwkGet('bwk-issue-date').value);
  bwkGet('bwk-preview-valid').textContent = bwkCalculateValidDate(bwkGet('bwk-issue-date').value, bwkGet('bwk-valid-days').value);
  bwkGet('bwk-preview-project').textContent = bwkGet('bwk-project-name').value.trim() || '프로젝트명을 입력해 주세요';

  // 각 견적 항목의 금액을 수량과 단가의 곱으로 계산합니다.
  bwkGet('bwk-preview-items').innerHTML = bwkItems.map((item) => {
    const lineTotal = Math.max(1, Number(item.quantity) || 1) * Math.max(0, Number(item.price) || 0);
    return `<tr><td><strong>${bwkEscapeHtml(item.name || '-')}</strong></td><td>${bwkEscapeHtml(item.description || '-')}</td><td>${Math.max(1, Number(item.quantity) || 1)}</td><td>${bwkFormatCurrency(item.price)}</td><td><strong>${bwkFormatCurrency(lineTotal)}</strong></td></tr>`;
  }).join('');

  // 입력 금액의 전체 합계를 먼저 계산합니다.
  const enteredTotal = bwkItems.reduce((sum, item) => sum + (Math.max(1, Number(item.quantity) || 1) * Math.max(0, Number(item.price) || 0)), 0);
  // 기본 체크 상태에서는 입력 금액을 부가세가 이미 포함된 최종 금액으로 해석합니다.
  const taxIncluded = bwkGet('bwk-tax-included').checked;
  // 포함 모드에서는 1.1로 나누고, 별도 모드에서는 입력 금액을 공급가액으로 사용합니다.
  const subtotal = taxIncluded ? Math.round(enteredTotal / 1.1) : enteredTotal;
  // 부가세는 포함 모드에서 차액으로, 별도 모드에서 공급가액의 10%로 계산합니다.
  const tax = taxIncluded ? enteredTotal - subtotal : Math.round(subtotal * 0.1);
  // 최종 합계는 포함 모드에서는 입력 합계 그대로, 별도 모드에서는 부가세를 더해 표시합니다.
  const total = taxIncluded ? enteredTotal : subtotal + tax;
  bwkGet('bwk-preview-subtotal').textContent = bwkFormatCurrency(subtotal);
  bwkGet('bwk-preview-tax').textContent = bwkFormatCurrency(tax);
  bwkGet('bwk-preview-total').textContent = bwkFormatCurrency(total);
  // 현재 계산 기준이 표만 보아도 명확하도록 단가와 부가세의 라벨을 함께 변경합니다.
  bwkGet('bwk-preview-price-label').textContent = taxIncluded ? '단가(부가세 포함)' : '단가(부가세 별도)';
  bwkGet('bwk-preview-tax-label').textContent = taxIncluded ? '부가세 (포함)' : '부가세 (10%)';

  // 여러 줄 입력 내용을 그대로 유지해 안내 영역에 표시합니다.
  bwkGet('bwk-preview-scope').textContent = bwkGet('bwk-scope').value.trim() || '입력된 작업 범위가 표시됩니다.';
  bwkGet('bwk-preview-payment').textContent = bwkGet('bwk-payment-terms').value.trim() || '입력된 결제 조건이 표시됩니다.';
  bwkGet('bwk-preview-note').textContent = bwkGet('bwk-note').value.trim() || '입력된 안내 사항이 표시됩니다.';
};

// 현재 양식 상태를 하나의 객체로 수집합니다.
const bwkCollectState = () => ({
  quoteNumber: bwkGet('bwk-quote-number').value,
  issueDate: bwkGet('bwk-issue-date').value,
  validDays: bwkGet('bwk-valid-days').value,
  projectName: bwkGet('bwk-project-name').value,
  status: bwkGet('bwk-quote-status').value,
  clientName: bwkGet('bwk-client-name').value,
  clientManager: bwkGet('bwk-client-manager').value,
  clientPhone: bwkGet('bwk-client-phone').value,
  clientEmail: bwkGet('bwk-client-email').value,
  scope: bwkGet('bwk-scope').value,
  paymentTerms: bwkGet('bwk-payment-terms').value,
  note: bwkGet('bwk-note').value,
  taxIncluded: bwkGet('bwk-tax-included').checked,
  items: bwkItems
});

// 저장된 견적서 상태를 편집 화면 전체에 적용합니다.
const bwkApplyState = (saved) => {
  // 각 저장 필드를 대응하는 입력 요소에 안전하게 연결합니다.
  const mapping = {
    'bwk-quote-number': saved.quoteNumber,
    'bwk-issue-date': saved.issueDate,
    'bwk-valid-days': saved.validDays,
    'bwk-project-name': saved.projectName,
    'bwk-quote-status': saved.status || 'draft',
    'bwk-client-name': saved.clientName,
    'bwk-client-manager': saved.clientManager,
    'bwk-client-phone': saved.clientPhone,
    'bwk-client-email': saved.clientEmail,
    'bwk-scope': saved.scope?.trim() ? saved.scope : bwkDefaultScope,
    'bwk-payment-terms': saved.paymentTerms,
    'bwk-note': saved.note
  };
  // 값이 존재하는 필드만 변경해 누락된 이전 버전 데이터도 불러올 수 있습니다.
  Object.entries(mapping).forEach(([id, value]) => { if (value !== undefined) bwkGet(id).value = value; });
  // 부가세 설정과 견적 항목 배열을 복원합니다.
  bwkGet('bwk-tax-included').checked = saved.taxIncluded !== false;
  bwkItems = Array.isArray(saved.items) && saved.items.length ? structuredClone(saved.items) : structuredClone(bwkDefaultItems);
  // 편집 항목과 PDF 미리보기를 즉시 새 값으로 다시 그립니다.
  bwkRenderItemEditor();
  bwkUpdatePreview();
};

// 상태를 브라우저 localStorage에 저장합니다.
const bwkSaveState = () => {
  // 로컬 저장이 차단된 브라우저에서도 편집은 계속 가능하도록 예외를 처리합니다.
  try {
    localStorage.setItem(bwkStorageKey, JSON.stringify(bwkCollectState()));
    bwkGet('bwk-save-status').textContent = '저장됨';
  } catch (error) {
    bwkGet('bwk-save-status').textContent = '자동 저장 불가';
  }
};

// 저장된 초안을 현재 입력 요소에 복원합니다.
const bwkLoadState = () => {
  // 저장된 값이 손상된 경우 기본값으로 시작할 수 있도록 예외를 처리합니다.
  try {
    const saved = JSON.parse(localStorage.getItem(bwkStorageKey) || 'null');
    if (!saved) return false;
    // 공통 적용 함수를 사용해 브라우저 초안을 복원합니다.
    bwkApplyState(saved);
    return true;
  } catch (error) {
    return false;
  }
};

// 항목 편집기에서 발생한 입력과 삭제를 이벤트 위임으로 처리합니다.
bwkGet('bwk-items').addEventListener('input', (event) => {
  const row = event.target.closest('.bwk-item-row');
  if (!row) return;
  const item = bwkItems[Number(row.dataset.index)];
  if (event.target.classList.contains('bwk-item-name')) item.name = event.target.value;
  if (event.target.classList.contains('bwk-item-description')) item.description = event.target.value;
  if (event.target.classList.contains('bwk-item-quantity')) item.quantity = Math.max(1, Number(event.target.value) || 1);
  if (event.target.classList.contains('bwk-item-price')) item.price = Math.max(0, Number(event.target.value) || 0);
  bwkUpdatePreview();
  bwkSaveState();
});

// 삭제 버튼을 눌렀을 때 최소 한 개 항목은 남도록 처리합니다.
bwkGet('bwk-items').addEventListener('click', (event) => {
  const button = event.target.closest('.bwk-remove-item');
  if (!button) return;
  const row = button.closest('.bwk-item-row');
  if (bwkItems.length === 1) {
    button.setAttribute('aria-label', '견적 항목은 최소 한 개가 필요합니다');
    return;
  }
  bwkItems.splice(Number(row.dataset.index), 1);
  bwkRenderItemEditor();
  bwkUpdatePreview();
  bwkSaveState();
});

// 모든 일반 입력 변경을 실시간 미리보기와 자동 저장에 연결합니다.
bwkGet('bwk-editor').addEventListener('input', (event) => {
  if (event.target.closest('#bwk-items')) return;
  bwkUpdatePreview();
  bwkSaveState();
});

// 새 견적 항목을 기본값과 함께 마지막에 추가합니다.
bwkGet('bwk-add-item').addEventListener('click', () => {
  bwkItems.push({ name: '새 작업 항목', description: '작업 내용을 입력해 주세요.', quantity: 1, price: 0 });
  bwkRenderItemEditor();
  bwkUpdatePreview();
  bwkSaveState();
  const lastNameInput = bwkGet('bwk-items').querySelector('.bwk-item-row:last-child .bwk-item-name');
  lastNameInput?.focus();
  lastNameInput?.select();
});

// PDF 버튼은 브라우저의 인쇄 대화상자를 열어 PDF 저장을 지원합니다.
bwkGet('bwk-print-button').addEventListener('click', () => window.print());

// 초기화 버튼은 실수 방지를 위해 한 번 확인한 후 기본 상태로 복원합니다.
bwkGet('bwk-reset-button').addEventListener('click', () => {
  const shouldReset = window.confirm('작성 중인 견적 내용을 모두 초기화할까요?');
  if (!shouldReset) return;
  localStorage.removeItem(bwkStorageKey);
  window.location.reload();
});

// 페이지 최초 실행 시 오늘 날짜와 기본 항목을 준비합니다.
const bwkInitialize = () => {
  // 저장된 초안이 없을 때만 기본 날짜와 항목을 적용합니다.
  if (!bwkLoadState()) {
    const today = new Date();
    const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    bwkGet('bwk-issue-date').value = localToday;
    bwkItems = structuredClone(bwkDefaultItems);
  }
  // 저장된 초안이 없을 때만 초기 입력 화면과 미리보기를 새로 렌더링합니다.
  if (!bwkGet('bwk-items').children.length) {
    bwkRenderItemEditor();
    bwkUpdatePreview();
  }
};

// 필요한 DOM이 준비된 현재 시점에 앱을 시작합니다.
bwkInitialize();
