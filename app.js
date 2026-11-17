/* ========================================
   부흥고등학교 분실물 센터 - JavaScript
   보관 장소: 2층 교무실(생활안전부) 일괄 통일
   ======================================== */

const DEFAULT_KEEP_LOCATION = '2층 교무실(생활안전부)';
let currentRegistrantType = 'student'; // 'student' | 'teacher'

// ── 데이터 관리 ──
function getLostItems() {
    return JSON.parse(localStorage.getItem('buhung_lost') || '[]');
}

function saveLostItems(items) {
    localStorage.setItem('buhung_lost', JSON.stringify(items));
}

function getFoundItems() {
    let items = JSON.parse(localStorage.getItem('buhung_found') || '[]');
    // 보관장소 일괄 통일 보정 (기존 데이터 호환)
    let updated = false;
    items.forEach(item => {
        if (!item.keepLocation || !item.keepLocation.includes('2층 교무실')) {
            item.keepLocation = DEFAULT_KEEP_LOCATION + (item.keepLocation ? ` (${item.keepLocation})` : '');
            updated = true;
        }
    });
    if (updated) {
        localStorage.setItem('buhung_found', JSON.stringify(items));
    }
    return items;
}

function saveFoundItems(items) {
    localStorage.setItem('buhung_found', JSON.stringify(items));
}

// ── 유틸 함수 ──
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${year}년 ${month}월 ${day}일`;
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const period = hour < 12 ? '오전' : '오후';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${period} ${displayHour}시 ${m}분`;
}

function timeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return formatDate(new Date(timestamp).toISOString().split('T')[0]);
}

function getCategoryEmoji(category) {
    const map = {
        '전자기기': '📱', '의류': '🧥', '학용품': '📚',
        '지갑/카드': '💳', '열쇠': '🔑', '음식/음료': '🍱', '기타': '📌'
    };
    return map[category] || '📌';
}

// ── 탭 전환 ──
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(section => {
        section.classList.toggle('active', section.id === 'tab-' + tabName);
    });
    if (tabName === 'lost-list') renderLostList();
    if (tabName === 'found-list') renderFoundList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── 등록 주체 전환 (학생 습득 vs 생활안전부 직접 등록) ──
function setRegistrantType(type) {
    currentRegistrantType = type;
    const btnStudent = document.getElementById('toggle-student');
    const btnTeacher = document.getElementById('toggle-teacher');
    const studentRow = document.getElementById('student-info-row');
    const teacherRow = document.getElementById('teacher-info-row');
    const reporterInput = document.getElementById('found-reporter');
    const gradeSelect = document.getElementById('found-grade');
    const classInput = document.getElementById('found-class');

    if (type === 'student') {
        btnStudent.classList.add('active');
        btnTeacher.classList.remove('active');
        studentRow.style.display = 'block';
        teacherRow.style.display = 'none';
        reporterInput.required = true;
        gradeSelect.required = true;
        classInput.required = true;
    } else {
        btnStudent.classList.remove('active');
        btnTeacher.classList.add('active');
        studentRow.style.display = 'none';
        teacherRow.style.display = 'block';
        reporterInput.required = false;
        gradeSelect.required = false;
        classInput.required = false;
    }
}

// ── 통계 업데이트 ──
function updateStats() {
    const lost = getLostItems();
    const found = getFoundItems();
    const activeFound = found.filter(i => i.status !== 'returned').length;
    const activeLost = lost.filter(i => i.status !== 'resolved').length;
    const resolvedTotal = (found.length - activeFound) + (lost.length - activeLost);
    
    document.getElementById('stat-found').textContent = activeFound;
    document.getElementById('stat-lost').textContent = activeLost;
    document.getElementById('stat-resolved').textContent = resolvedTotal;
}

// ── 스마트 매칭 알고리즘 ──
function findMatches(targetItem, isTargetLost) {
    const candidates = isTargetLost ? getFoundItems() : getLostItems();
    const activeCandidates = candidates.filter(c => 
        isTargetLost ? c.status !== 'returned' : c.status !== 'resolved'
    );

    const matches = [];
    const targetWords = (targetItem.itemName + ' ' + (targetItem.description || ''))
        .toLowerCase()
        .replace(/[^가-힣a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 2);

    for (const cand of activeCandidates) {
        let score = 0;
        
        // 1. 카테고리 일치
        if (targetItem.category === cand.category) {
            score += 3;
        }

        // 2. 장소 일치
        if (targetItem.location && cand.location && targetItem.location === cand.location) {
            score += 2;
        }

        // 3. 키워드 일치
        const candWords = (cand.itemName + ' ' + (cand.description || '')).toLowerCase();
        for (const w of targetWords) {
            if (candWords.includes(w)) {
                score += 3;
            }
        }

        if (score >= 3) {
            matches.push({ item: cand, score });
        }
    }

    matches.sort((a, b) => b.score - a.score);
    return matches.map(m => m.item).slice(0, 3);
}

// ── 1. 현재 보관물품 목록 렌더링 (생활안전부 보관) ──
function renderFoundList() {
    const container = document.getElementById('found-list');
    const emptyState = document.getElementById('found-empty');
    const searchQuery = (document.getElementById('search-found')?.value || '').toLowerCase().trim();
    const categoryFilter = document.getElementById('filter-found-category')?.value || 'all';
    const statusFilter = document.getElementById('filter-found-status')?.value || 'all';
    
    let items = getFoundItems();
    
    // 필터링
    if (searchQuery) {
        items = items.filter(i => 
            i.itemName.toLowerCase().includes(searchQuery) || 
            (i.description && i.description.toLowerCase().includes(searchQuery)) ||
            (i.location && i.location.toLowerCase().includes(searchQuery)) ||
            (i.locationDetail && i.locationDetail.toLowerCase().includes(searchQuery)) ||
            (i.keepLocation && i.keepLocation.toLowerCase().includes(searchQuery))
        );
    }
    if (categoryFilter !== 'all') {
        items = items.filter(i => i.category === categoryFilter);
    }
    if (statusFilter !== 'all') {
        items = items.filter(i => i.status === statusFilter);
    }
    
    // 최신순 정렬
    items.sort((a, b) => b.createdAt - a.createdAt);
    
    if (items.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    container.innerHTML = items.map(item => {
        const isReturned = item.status === 'returned';
        const badgeClass = isReturned ? 'badge-returned' : 'badge-waiting';
        const badgeText = isReturned ? '✅ 주인 수령 완료' : '🏢 보관 중 (수령 가능)';
        const locationText = item.locationDetail 
            ? `${item.location} (${item.locationDetail})` 
            : (item.location || '교내');
        
        const thumbHtml = item.photo 
            ? `<img src="${item.photo}" class="card-thumb" alt="보관물품 사진">` 
            : '';

        // 매칭되는 분실 신고 확인
        const matches = !isReturned ? findMatches(item, false) : [];
        const matchBadge = matches.length > 0 
            ? `<span style="font-size:0.75rem; background:#eff6ff; color:#1d4ed8; padding:2px 8px; border-radius:10px; font-weight:600; margin-left:6px;">💡 분실 신고 매칭 ${matches.length}건</span>` 
            : '';

        const reporterText = item.grade && item.classNum 
            ? `${item.grade}학년 ${item.classNum}반 ${escapeHtml(item.reporterName)}` 
            : escapeHtml(item.reporterName || '생활안전부');

        return `
        <div class="item-card found-card ${isReturned ? 'returned' : ''}">
            <div class="card-main-content" onclick="showFoundDetail('${item.id}')">
                <div class="card-body-row">
                    ${thumbHtml}
                    <div style="flex:1; min-width:0;">
                        <div class="card-top">
                            <span class="card-title">${getCategoryEmoji(item.category)} ${escapeHtml(item.itemName)} ${matchBadge}</span>
                            <span class="card-badge ${badgeClass}">${badgeText}</span>
                        </div>
                        <div class="card-keep-pill">
                            📍 보관처: ${escapeHtml(item.keepLocation || DEFAULT_KEEP_LOCATION)}
                        </div>
                        <div class="card-category">${item.category} · 등록: ${reporterText}</div>
                        <div class="card-info">
                            <span>🔍 발견장소: ${escapeHtml(locationText)}</span>
                            <span>📅 ${formatDate(item.foundDate)}${item.foundTime ? ' ' + formatTime(item.foundTime) : ''}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="card-footer-action">
                ${!isReturned ? `
                    <button type="button" class="btn-card-quick btn-card-resolve" onclick="event.stopPropagation(); markFoundReturned('${item.id}')">
                        ✅ 본인 수령 확인
                    </button>
                ` : `
                    <button type="button" class="btn-card-quick" style="background:#f3f4f6; color:#4b5563;" onclick="event.stopPropagation(); markFoundWaiting('${item.id}')">
                        ↩️ 보관 중으로 되돌리기
                    </button>
                `}
                <button type="button" class="btn-card-quick btn-share" onclick="event.stopPropagation(); copyShareText('found', '${item.id}')">
                    📋 단톡방 공유
                </button>
            </div>
        </div>`;
    }).join('');
    
    updateStats();
}

// ── 2. 분실물 목록 렌더링 ──
function renderLostList() {
    const container = document.getElementById('lost-list');
    const emptyState = document.getElementById('lost-empty');
    const searchQuery = (document.getElementById('search-lost')?.value || '').toLowerCase().trim();
    const categoryFilter = document.getElementById('filter-lost-category')?.value || 'all';
    const statusFilter = document.getElementById('filter-lost-status')?.value || 'all';
    
    let items = getLostItems();
    
    // 필터링
    if (searchQuery) {
        items = items.filter(i => 
            i.itemName.toLowerCase().includes(searchQuery) || 
            (i.description && i.description.toLowerCase().includes(searchQuery)) ||
            (i.location && i.location.toLowerCase().includes(searchQuery)) ||
            (i.locationDetail && i.locationDetail.toLowerCase().includes(searchQuery))
        );
    }
    if (categoryFilter !== 'all') {
        items = items.filter(i => i.category === categoryFilter);
    }
    if (statusFilter !== 'all') {
        items = items.filter(i => i.status === statusFilter);
    }
    
    items.sort((a, b) => b.createdAt - a.createdAt);
    
    if (items.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    container.innerHTML = items.map(item => {
        const isResolved = item.status === 'resolved';
        const badgeClass = isResolved ? 'badge-resolved' : 'badge-searching';
        const badgeText = isResolved ? '✅ 찾음 완료' : '🔍 찾는 중';
        const locationText = item.locationDetail 
            ? `${item.location} (${item.locationDetail})` 
            : item.location;
        
        // 매칭되는 보관물품 확인
        const matches = !isResolved ? findMatches(item, true) : [];
        const matchBadge = matches.length > 0 
            ? `<span style="font-size:0.75rem; background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:10px; font-weight:600; margin-left:6px;">💡 생활안전부 보관 매칭 ${matches.length}건</span>` 
            : '';

        return `
        <div class="item-card ${isResolved ? 'resolved' : ''}">
            <div class="card-main-content" onclick="showLostDetail('${item.id}')">
                <div class="card-top">
                    <span class="card-title">${getCategoryEmoji(item.category)} ${escapeHtml(item.itemName)} ${matchBadge}</span>
                    <span class="card-badge ${badgeClass}">${badgeText}</span>
                </div>
                <div class="card-category">${item.category} · ${item.grade}학년 ${item.classNum}반 ${escapeHtml(item.reporterName)}</div>
                <div class="card-info">
                    <span>📍 분실장소: ${escapeHtml(locationText)}</span>
                    <span>📅 ${formatDate(item.lostDate)}${item.lostTime ? ' ' + formatTime(item.lostTime) : ''}</span>
                    <span>🕐 ${timeAgo(item.createdAt)}</span>
                </div>
            </div>
            <div class="card-footer-action">
                ${!isResolved ? `
                    <button type="button" class="btn-card-quick btn-card-resolve" onclick="event.stopPropagation(); markLostResolved('${item.id}')">
                        ✅ 분실물 찾음
                    </button>
                ` : `
                    <button type="button" class="btn-card-quick" style="background:#f3f4f6; color:#4b5563;" onclick="event.stopPropagation(); markLostSearching('${item.id}')">
                        ↩️ 찾는 중으로 되돌리기
                    </button>
                `}
                <button type="button" class="btn-card-quick btn-share" onclick="event.stopPropagation(); copyShareText('lost', '${item.id}')">
                    📋 단톡방 공유
                </button>
            </div>
        </div>`;
    }).join('');
    
    updateStats();
}

// ── 3. 습득물 / 보관물품 등록 제출 ──
function submitFoundReport(e) {
    e.preventDefault();
    
    let reporterName = '';
    let grade = '';
    let classNum = '';

    if (currentRegistrantType === 'teacher') {
        reporterName = '생활안전부';
    } else {
        reporterName = document.getElementById('found-reporter').value.trim();
        grade = document.getElementById('found-grade').value;
        classNum = document.getElementById('found-class').value;
    }

    const detailKeep = document.getElementById('found-keep-detail')?.value.trim();
    const finalKeepLocation = detailKeep 
        ? `${DEFAULT_KEEP_LOCATION} (${detailKeep})` 
        : DEFAULT_KEEP_LOCATION;

    const item = {
        id: generateId(),
        reporterName: reporterName,
        grade: grade,
        classNum: classNum,
        itemName: document.getElementById('found-item').value.trim(),
        category: document.getElementById('found-category').value,
        location: document.getElementById('found-location').value,
        locationDetail: document.getElementById('found-location-detail').value.trim(),
        foundDate: document.getElementById('found-date').value,
        foundTime: document.getElementById('found-time').value,
        description: document.getElementById('found-desc').value.trim(),
        keepLocation: finalKeepLocation,
        contact: document.getElementById('found-contact').value.trim(),
        photo: currentPhotoData || '',
        status: 'waiting',
        createdAt: Date.now()
    };
    
    const items = getFoundItems();
    items.unshift(item);
    saveFoundItems(items);
    
    // 폼 초기화
    document.getElementById('found-form').reset();
    document.getElementById('found-keep').value = DEFAULT_KEEP_LOCATION;
    if (document.getElementById('found-keep-detail')) {
        document.getElementById('found-keep-detail').value = '';
    }
    removePhoto();
    
    // 알림 및 자동 전환
    showToast('🎉 2층 교무실(생활안전부) 보관물품으로 등록되었습니다!', 'success');
    
    // 자동으로 "현재 보관물품" 탭으로 이동하여 방금 등록한 물품 표시!
    switchTab('found-list');
    updateStats();
}

// ── 4. 분실 신고 제출 ──
function submitLostReport(e) {
    e.preventDefault();
    
    const item = {
        id: generateId(),
        reporterName: document.getElementById('lost-name').value.trim(),
        grade: document.getElementById('lost-grade').value,
        classNum: document.getElementById('lost-class').value,
        itemName: document.getElementById('lost-item').value.trim(),
        category: document.getElementById('lost-category').value,
        location: document.getElementById('lost-location').value,
        locationDetail: document.getElementById('lost-location-detail').value.trim(),
        lostDate: document.getElementById('lost-date').value,
        lostTime: document.getElementById('lost-time').value,
        description: document.getElementById('lost-desc').value.trim(),
        contact: document.getElementById('lost-contact').value.trim(),
        status: 'searching',
        createdAt: Date.now()
    };
    
    const items = getLostItems();
    items.unshift(item);
    saveLostItems(items);
    
    document.getElementById('lost-form').reset();
    showToast('✅ 분실 신고가 등록되었습니다. 생활안전부 보관물품과 자동 매칭됩니다.', 'success');
    switchTab('lost-list');
    updateStats();
}

// ── 사진 미리보기 ──
let currentPhotoData = '';

function previewPhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
        showToast('⚠️ 사진 용량이 5MB를 초과합니다.', 'error');
        e.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const maxSize = 800;
            let w = img.width;
            let h = img.height;
            
            if (w > maxSize || h > maxSize) {
                if (w > h) {
                    h = Math.round(h * maxSize / w);
                    w = maxSize;
                } else {
                    w = Math.round(w * maxSize / h);
                    h = maxSize;
                }
            }
            
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            currentPhotoData = canvas.toDataURL('image/jpeg', 0.7);
            
            document.getElementById('photo-preview').src = currentPhotoData;
            document.getElementById('photo-placeholder').style.display = 'none';
            document.getElementById('photo-preview-container').style.display = 'block';
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function removePhoto() {
    currentPhotoData = '';
    const fileInput = document.getElementById('found-photo');
    if (fileInput) fileInput.value = '';
    document.getElementById('photo-placeholder').style.display = 'block';
    document.getElementById('photo-preview-container').style.display = 'none';
}

// ── 보관물품 상세보기 ──
function showFoundDetail(id) {
    const items = getFoundItems();
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    const isReturned = item.status === 'returned';
    const badgeClass = isReturned ? 'badge-returned' : 'badge-waiting';
    const badgeText = isReturned ? '✅ 주인 수령 완료' : '🏢 보관 중 (수령 가능)';
    const locationText = item.locationDetail 
        ? `${item.location} (${item.locationDetail})` 
        : (item.location || '교내');
    
    const reporterText = item.grade && item.classNum 
        ? `${item.grade}학년 ${item.classNum}반 ${escapeHtml(item.reporterName)}` 
        : escapeHtml(item.reporterName || '생활안전부');

    // 매칭되는 분실 신고 검색
    const matches = !isReturned ? findMatches(item, false) : [];
    let matchSectionHtml = '';
    if (matches.length > 0) {
        matchSectionHtml = `
            <div class="match-section found-matching">
                <div class="match-title">💡 혹시 이 분실 신고 학생의 물건인가요?</div>
                ${matches.map(m => `
                    <div class="match-item" onclick="closeModal(); showLostDetail('${m.id}')">
                        <div class="match-item-info">
                            <span class="match-item-name">${getCategoryEmoji(m.category)} ${escapeHtml(m.itemName)}</span>
                            <span class="match-item-meta">신고자: ${m.grade}학년 ${m.classNum}반 ${escapeHtml(m.reporterName)} | 분실장소: ${escapeHtml(m.location)}</span>
                        </div>
                        <span style="font-size:0.75rem; color:#1d4ed8; font-weight:700;">확인 ➔</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    let actionsHtml = '';
    if (!isReturned) {
        actionsHtml = `
            <button class="btn btn-found btn-sm" onclick="markFoundReturned('${item.id}')">
                ✅ 본인 수령 확인 완료
            </button>
            <button class="btn btn-share btn-sm" onclick="copyShareText('found', '${item.id}')">
                📋 단톡방 공유 양식 복사
            </button>
            <button class="btn btn-danger-outline btn-sm" onclick="confirmDeleteFound('${item.id}')">
                🗑️ 삭제
            </button>
        `;
    } else {
        actionsHtml = `
            <button class="btn btn-outline btn-sm" onclick="markFoundWaiting('${item.id}')">
                ↩️ 보관 중으로 되돌리기
            </button>
            <button class="btn btn-danger-outline btn-sm" onclick="confirmDeleteFound('${item.id}')">
                🗑️ 삭제
            </button>
        `;
    }
    
    document.getElementById('modal-body').innerHTML = `
        <div class="modal-header">
            <span class="card-badge ${badgeClass}" style="margin-bottom:8px; display:inline-block;">${badgeText}</span>
            <h2 style="font-size:1.2rem; font-weight:700;">${getCategoryEmoji(item.category)} ${escapeHtml(item.itemName)}</h2>
        </div>
        <div class="modal-body-inner">
            ${item.photo ? `<img src="${item.photo}" class="detail-photo" alt="보관물품 사진">` : ''}
            
            <div class="safety-banner" style="margin: 0 0 16px 0; padding: 12px 14px;">
                <span style="font-size: 1.5rem;">🏢</span>
                <div style="font-size: 0.85rem; color:#1e40af;">
                    <strong>수령 장소: ${escapeHtml(item.keepLocation || DEFAULT_KEEP_LOCATION)}</strong><br>
                    <span>본인의 물건인 경우 학생증을 지참하여 생활안전부로 방문해 주세요.</span>
                </div>
            </div>

            <div class="detail-row">
                <span class="detail-label">📋 분류</span>
                <span class="detail-value">${item.category}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">👤 등록자</span>
                <span class="detail-value">${reporterText}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">📍 발견 장소</span>
                <span class="detail-value">${escapeHtml(locationText)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">📅 습득 일시</span>
                <span class="detail-value">${formatDate(item.foundDate)}${item.foundTime ? ' ' + formatTime(item.foundTime) : ''}</span>
            </div>
            ${item.description ? `
            <div class="detail-row">
                <span class="detail-label">📝 특징 / 설명</span>
                <span class="detail-value">${escapeHtml(item.description)}</span>
            </div>` : ''}
            ${item.contact ? `
            <div class="detail-row">
                <span class="detail-label">📞 연락처</span>
                <span class="detail-value">${escapeHtml(item.contact)}</span>
            </div>` : ''}
            <div class="detail-row">
                <span class="detail-label">🕐 등록 일시</span>
                <span class="detail-value">${timeAgo(item.createdAt)}</span>
            </div>
            ${matchSectionHtml}
        </div>
        <div class="modal-actions">
            ${actionsHtml}
        </div>
    `;
    
    document.getElementById('detail-modal').style.display = 'flex';
}

// ── 분실물 상세보기 ──
function showLostDetail(id) {
    const items = getLostItems();
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    const isResolved = item.status === 'resolved';
    const badgeClass = isResolved ? 'badge-resolved' : 'badge-searching';
    const badgeText = isResolved ? '✅ 찾음 완료' : '🔍 찾는 중';
    const locationText = item.locationDetail 
        ? `${item.location} (${item.locationDetail})` 
        : item.location;
    
    // 매칭되는 보관물품 검색
    const matches = !isResolved ? findMatches(item, true) : [];
    let matchSectionHtml = '';
    if (matches.length > 0) {
        matchSectionHtml = `
            <div class="match-section">
                <div class="match-title">💡 혹시 생활안전부에 보관 중인 아래 물품인가요?</div>
                ${matches.map(m => `
                    <div class="match-item" onclick="closeModal(); showFoundDetail('${m.id}')">
                        <div class="match-item-info">
                            <span class="match-item-name">${getCategoryEmoji(m.category)} ${escapeHtml(m.itemName)}</span>
                            <span class="match-item-meta">보관: ${escapeHtml(m.keepLocation)} | 발견: ${escapeHtml(m.location)}</span>
                        </div>
                        <span style="font-size:0.75rem; color:#16a34a; font-weight:700;">확인 ➔</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    let actionsHtml = '';
    if (!isResolved) {
        actionsHtml = `
            <button class="btn btn-found btn-sm" onclick="markLostResolved('${item.id}')">
                ✅ 분실물 찾음
            </button>
            <button class="btn btn-share btn-sm" onclick="copyShareText('lost', '${item.id}')">
                📋 단톡방 공유 양식 복사
            </button>
            <button class="btn btn-danger-outline btn-sm" onclick="confirmDeleteLost('${item.id}')">
                🗑️ 삭제
            </button>
        `;
    } else {
        actionsHtml = `
            <button class="btn btn-outline btn-sm" onclick="markLostSearching('${item.id}')">
                ↩️ 찾는 중으로 되돌리기
            </button>
            <button class="btn btn-danger-outline btn-sm" onclick="confirmDeleteLost('${item.id}')">
                🗑️ 삭제
            </button>
        `;
    }
    
    document.getElementById('modal-body').innerHTML = `
        <div class="modal-header">
            <span class="card-badge ${badgeClass}" style="margin-bottom:8px; display:inline-block;">${badgeText}</span>
            <h2 style="font-size:1.2rem; font-weight:700;">${getCategoryEmoji(item.category)} ${escapeHtml(item.itemName)}</h2>
        </div>
        <div class="modal-body-inner">
            <div class="detail-row">
                <span class="detail-label">📋 분류</span>
                <span class="detail-value">${item.category}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">👤 신고 학생</span>
                <span class="detail-value">${item.grade}학년 ${item.classNum}반 ${escapeHtml(item.reporterName)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">📍 분실 장소</span>
                <span class="detail-value">${escapeHtml(locationText)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">📅 분실 날짜</span>
                <span class="detail-value">${formatDate(item.lostDate)}${item.lostTime ? ' ' + formatTime(item.lostTime) : ''}</span>
            </div>
            ${item.description ? `
            <div class="detail-row">
                <span class="detail-label">📝 상세 설명</span>
                <span class="detail-value">${escapeHtml(item.description)}</span>
            </div>` : ''}
            ${item.contact ? `
            <div class="detail-row">
                <span class="detail-label">📞 연락처</span>
                <span class="detail-value">${escapeHtml(item.contact)}</span>
            </div>` : ''}
            <div class="detail-row">
                <span class="detail-label">🕐 등록 일시</span>
                <span class="detail-value">${timeAgo(item.createdAt)}</span>
            </div>
            ${matchSectionHtml}
        </div>
        <div class="modal-actions">
            ${actionsHtml}
        </div>
    `;
    
    document.getElementById('detail-modal').style.display = 'flex';
}

// ── 단톡방 공유 텍스트 복사 ──
function copyShareText(type, id) {
    let text = '';
    if (type === 'found') {
        const item = getFoundItems().find(i => i.id === id);
        if (!item) return;
        text = `[부흥고 분실물 센터 알림]\n` +
               `📦 2층 교무실(생활안전부) 보관 중\n` +
               `📌 물건: ${item.itemName}\n` +
               `🏢 보관처: ${item.keepLocation || DEFAULT_KEEP_LOCATION}\n` +
               `📍 발견위치: ${item.location} ${item.locationDetail || ''}\n` +
               `📅 날짜: ${formatDate(item.foundDate)} ${item.foundTime ? formatTime(item.foundTime) : ''}\n` +
               (item.description ? `📝 특징: ${item.description}\n` : '') +
               `\n본인 물건인 학생은 학생증을 지참하고 2층 생활안전부로 방문해 찾아가세요!`;
    } else {
        const item = getLostItems().find(i => i.id === id);
        if (!item) return;
        text = `[부흥고 분실물 센터 알림]\n` +
               `🔍 분실물 찾는 중!\n` +
               `📌 물건: ${item.itemName}\n` +
               `📍 분실위치: ${item.location} ${item.locationDetail || ''}\n` +
               `📅 날짜: ${formatDate(item.lostDate)} ${item.lostTime ? formatTime(item.lostTime) : ''}\n` +
               `👤 학생: ${item.grade}학년 ${item.classNum}반 ${item.reporterName}\n` +
               (item.description ? `📝 특징: ${item.description}\n` : '') +
               (item.contact ? `📞 연락처: ${item.contact}\n` : '') +
               `\n혹시 보신 분은 2층 생활안전부에 맡겨주시거나 연락 부탁드립니다!`;
    }

    navigator.clipboard.writeText(text).then(() => {
        showToast('📋 학급 공유용 텍스트가 복사되었습니다! 카톡 등에 붙여넣기 하세요.', 'success');
    }).catch(() => {
        showToast('⚠️ 클립보드 복사 권한이 없습니다.', 'error');
    });
}

// ── 상태 변경 ──
function markFoundReturned(id) {
    const items = getFoundItems();
    const item = items.find(i => i.id === id);
    if (item) {
        item.status = 'returned';
        item.returnedAt = Date.now();
        saveFoundItems(items);
        closeModal();
        renderFoundList();
        showToast('🎉 본인 수령 확인이 완료되었습니다!', 'success');
    }
}

function markFoundWaiting(id) {
    const items = getFoundItems();
    const item = items.find(i => i.id === id);
    if (item) {
        item.status = 'waiting';
        delete item.returnedAt;
        saveFoundItems(items);
        closeModal();
        renderFoundList();
        showToast('🏢 다시 보관 중(수령 가능) 상태로 변경했습니다.', '');
    }
}

function markLostResolved(id) {
    const items = getLostItems();
    const item = items.find(i => i.id === id);
    if (item) {
        item.status = 'resolved';
        item.resolvedAt = Date.now();
        saveLostItems(items);
        closeModal();
        renderLostList();
        showToast('🎉 분실물을 찾았습니다! 다행이에요!', 'success');
    }
}

function markLostSearching(id) {
    const items = getLostItems();
    const item = items.find(i => i.id === id);
    if (item) {
        item.status = 'searching';
        delete item.resolvedAt;
        saveLostItems(items);
        closeModal();
        renderLostList();
        showToast('🔍 다시 찾는 중으로 변경했습니다.', '');
    }
}

// ── 삭제 ──
function confirmDeleteLost(id) {
    if (confirm('정말로 이 분실 신고를 삭제하시겠습니까?')) {
        let items = getLostItems();
        items = items.filter(i => i.id !== id);
        saveLostItems(items);
        closeModal();
        renderLostList();
        showToast('🗑️ 분실 신고가 삭제되었습니다.', '');
    }
}

function confirmDeleteFound(id) {
    if (confirm('정말로 이 보관물품을 삭제하시겠습니까?')) {
        let items = getFoundItems();
        items = items.filter(i => i.id !== id);
        saveFoundItems(items);
        closeModal();
        renderFoundList();
        showToast('🗑️ 보관물품이 삭제되었습니다.', '');
    }
}

// ── 모달 관리 ──
function closeModal() {
    document.getElementById('detail-modal').style.display = 'none';
}

function closeModalOutside(e) {
    if (e.target === document.getElementById('detail-modal')) {
        closeModal();
    }
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeModal();
});

// ── 토스트 알림 ──
let toastTimer = null;

function showToast(message, type) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast' + (type ? ' ' + type : '');
    toast.style.display = 'block';
    
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// ── XSS 방지 ──
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ── 예시 데이터 로드 ──
function loadSampleData(force = false) {
    if (!force && (localStorage.getItem('buhung_lost') || localStorage.getItem('buhung_found'))) {
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    const sampleLost = [
        {
            id: 'sample_lost_1',
            reporterName: '박지훈',
            grade: '2',
            classNum: '3',
            itemName: '에어팟 프로 2세대 본체',
            category: '전자기기',
            location: '복도',
            locationDetail: '본관 3층 홈베이스 앞',
            lostDate: today,
            lostTime: '12:40',
            description: '케이스에 메타몽 키링이 달려있고, 뚜껑 안쪽에 은색 철가루 방지 스티커가 붙어있습니다.',
            contact: '카카오톡: jihoon_park',
            status: 'searching',
            createdAt: Date.now() - 3600000 * 2
        },
        {
            id: 'sample_lost_2',
            reporterName: '이도윤',
            grade: '1',
            classNum: '5',
            itemName: '부흥고 춘추복 자켓 (100사이즈)',
            category: '의류',
            location: '체육관',
            locationDetail: '2층 스탠드 맨 뒷자리',
            lostDate: today,
            lostTime: '15:10',
            description: '안쪽 이름표 탭에 "이도윤"이라고 네임펜으로 적혀있습니다.',
            contact: '010-1234-5678',
            status: 'searching',
            createdAt: Date.now() - 3600000 * 5
        },
        {
            id: 'sample_lost_3',
            reporterName: '최유나',
            grade: '3',
            classNum: '2',
            itemName: '라이언 필통 및 수학 샤프',
            category: '학용품',
            location: '도서관',
            locationDetail: '자율학습실 42번 좌석',
            lostDate: today,
            lostTime: '17:30',
            description: '노란색 라이언 천 필통이고 안에 그래프 샤프와 형광펜 3자루가 들어있습니다.',
            contact: '3-2 교실 앞',
            status: 'searching',
            createdAt: Date.now() - 3600000 * 18
        }
    ];

    const sampleFound = [
        {
            id: 'sample_found_1',
            reporterName: '김민서',
            grade: '2',
            classNum: '1',
            itemName: '흰색 무선 이어폰 케이스 (메타몽 키링)',
            category: '전자기기',
            location: '복도',
            locationDetail: '3층 서편 계단 참',
            foundDate: today,
            foundTime: '13:00',
            description: '바닥에 떨어져 있던 에어팟 케이스입니다. 메타몽 키링 부착됨.',
            keepLocation: '2층 교무실(생활안전부) (1번 보관함)',
            contact: '2-1 김민서',
            photo: '',
            status: 'waiting',
            createdAt: Date.now() - 3600000 * 1
        },
        {
            id: 'sample_found_2',
            reporterName: '생활안전부',
            grade: '',
            classNum: '',
            itemName: '부흥고 교복 마이 자켓 (명찰: 이도윤)',
            category: '의류',
            location: '체육관',
            locationDetail: '배구 네트 보관대 옆 스탠드',
            foundDate: today,
            foundTime: '16:00',
            description: '체육 시간 후 스탠드에서 습득되어 생활안전부에 보관 중.',
            keepLocation: '2층 교무실(생활안전부) (교복 옷걸이)',
            contact: '생활안전부',
            photo: '',
            status: 'waiting',
            createdAt: Date.now() - 3600000 * 4
        },
        {
            id: 'sample_found_3',
            reporterName: '강태양',
            grade: '2',
            classNum: '7',
            itemName: '스탠리 하늘색 텀블러',
            category: '음식/음료',
            location: '급식실',
            locationDetail: '퇴식구 옆 정수기 위',
            foundDate: today,
            foundTime: '13:20',
            description: '바닥에 약간 찌그러짐 있음, 손잡이 있는 모델',
            keepLocation: '2층 교무실(생활안전부) (선반 2단)',
            contact: '생활안전부',
            photo: '',
            status: 'waiting',
            createdAt: Date.now() - 3600000 * 8
        }
    ];

    saveLostItems(sampleLost);
    saveFoundItems(sampleFound);
    renderFoundList();
    renderLostList();
    updateStats();
    showToast('💡 부흥고 생활안전부 예시 데이터가 로드되었습니다!', 'success');
}

// ── 전체 초기화 ──
function clearAllData() {
    if (confirm('모든 보관물품 및 분실물 데이터를 초기화하시겠습니까?')) {
        localStorage.removeItem('buhung_lost');
        localStorage.removeItem('buhung_found');
        renderFoundList();
        renderLostList();
        updateStats();
        showToast('🗑️ 모든 데이터가 초기화되었습니다.', '');
    }
}

// ── 초기화 ──
document.addEventListener('DOMContentLoaded', function() {
    // 오늘 날짜를 기본값으로 설정
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => input.value = today);

    // 저장된 데이터가 전혀 없으면 자동으로 예시 데이터 로드
    if (!localStorage.getItem('buhung_lost') && !localStorage.getItem('buhung_found')) {
        loadSampleData(true);
    } else {
        renderFoundList();
        renderLostList();
        updateStats();
    }
});
