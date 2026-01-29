// 샘플 동영상 데이터 (API 실패 시 폴백)
const sampleVideos = [
    { id: '9bZkp7q19f0', title: 'PSY - GANGNAM STYLE(강남스타일) M/V', channel: 'officialpsy', uploadDate: '2026-01-28', thumbnail: 'https://img.youtube.com/vi/9bZkp7q19f0/0.jpg' },
    { id: 'gdZLi9oWNZg', title: 'BTS (방탄소년단) \'Dynamite\' Official MV', channel: 'HYBE LABELS', uploadDate: '2026-01-28', thumbnail: 'https://img.youtube.com/vi/gdZLi9oWNZg/0.jpg' },
    { id: 'IHNzOHi8sJs', title: 'BLACKPINK - \'뚜두뚜두 (DDU-DU DDU-DU)\' M/V', channel: 'BLACKPINK', uploadDate: '2026-01-28', thumbnail: 'https://img.youtube.com/vi/IHNzOHi8sJs/0.jpg' },
    { id: 'k4yGDisCj_s', title: 'Luis Fonsi - Despacito ft. Daddy Yankee', channel: 'LuisFonsiVEVO', uploadDate: '2026-01-28', thumbnail: 'https://img.youtube.com/vi/k4yGDisCj_s/0.jpg' },
    { id: 'JGwWNGJdvx8', title: 'Ed Sheeran - Shape of You [Official Video]', channel: 'Ed Sheeran', uploadDate: '2026-01-28', thumbnail: 'https://img.youtube.com/vi/JGwWNGJdvx8/0.jpg' },
    { id: 'v7bnOxV4jAc', title: 'IU(아이유) _ LILAC(라일락) MV', channel: '1theK (원더케이)', uploadDate: '2026-01-28', thumbnail: 'https://img.youtube.com/vi/v7bnOxV4jAc/0.jpg' },
    { id: 'TQTlCHzgs88', title: 'Stray Kids "神메뉴" M/V', channel: 'JYP Entertainment', uploadDate: '2026-01-28', thumbnail: 'https://img.youtube.com/vi/TQTlCHzgs88/0.jpg' },
    { id: 'cha_FFxZ-G4', title: 'TWICE "Alcohol-Free" M/V', channel: 'JYP Entertainment', uploadDate: '2026-01-28', thumbnail: 'https://img.youtube.com/vi/cha_FFxZ-G4/0.jpg' },
    { id: 'CuklIb9d3fI', title: 'Maroon 5 - Girls Like You ft. Cardi B', channel: 'Maroon5VEVO', uploadDate: '2026-01-27', thumbnail: 'https://img.youtube.com/vi/CuklIb9d3fI/0.jpg' },
    { id: 'fRh_vgS2dFE', title: 'Mark Ronson - Uptown Funk ft. Bruno Mars', channel: 'MarkRonsonVEVO', uploadDate: '2026-01-27', thumbnail: 'https://img.youtube.com/vi/fRh_vgS2dFE/0.jpg' },
    { id: '2Vv-BfVoq4g', title: 'Katy Perry - Roar (Official)', channel: 'KatyPerryVEVO', uploadDate: '2026-01-26', thumbnail: 'https://img.youtube.com/vi/2Vv-BfVoq4g/0.jpg' },
    { id: 'kJQP7kiw5Fk', title: 'Wiz Khalifa - See You Again ft. Charlie Puth', channel: 'Wiz Khalifa', uploadDate: '2026-01-25', thumbnail: 'https://img.youtube.com/vi/kJQP7kiw5Fk/0.jpg' },
    { id: 'p8URoA9L9hI', title: 'Crazy Frog - Axel F (Official Video)', channel: 'Crazy Frog', uploadDate: '2026-01-24', thumbnail: 'https://img.youtube.com/vi/p8URoA9L9hI/0.jpg' },
    { id: 'hY7m5jjJ9e4', title: 'CoComelon - Bath Song', channel: 'Cocomelon - Nursery Rhymes', uploadDate: '2026-01-23', thumbnail: 'https://img.youtube.com/vi/hY7m5jjJ9e4/0.jpg' },
    { id: 'L3wKzyIN1yk', title: 'El Chombo - Dame Tu Cosita feat. Cutty Ranks', channel: 'Ultra Music', uploadDate: '2026-01-22', thumbnail: 'https://img.youtube.com/vi/L3wKzyIN1yk/0.jpg' },
    { id: 'x2dJp_oA-xI', title: 'Taylor Swift - Shake It Off', channel: 'TaylorSwiftVEVO', uploadDate: '2026-01-21', thumbnail: 'https://img.youtube.com/vi/x2dJp_oA-xI/0.jpg' },
];

const videoList = document.getElementById('video-list');
const filterToday = document.getElementById('filter-today');
const filter3d = document.getElementById('filter-3d');
const filter7d = document.getElementById('filter-7d');
const filter30d = document.getElementById('filter-30d');
const modeHot = document.getElementById('mode-hot');
const modeStable = document.getElementById('mode-stable');
const scrollSentinel = document.getElementById('scroll-sentinel');

let currentFilter = 'today';
let currentMode = 'hot';
let currentFilteredVideos = [];
const apiCache = new Map();
const VIDEOS_PER_LOAD = 24;
let loadedVideosCount = 0;
let isRendering = false;
let filterRequestId = 0;
let observer;
const DEFAULT_API_ENDPOINT = '/api';
const FALLBACK_API_ENDPOINT = 'https://yt-feed-hub.pages.dev/api';
const isPreviewHost = /(?:cloudworkstations\.dev)$/.test(window.location.hostname);
const API_ENDPOINT = isPreviewHost ? FALLBACK_API_ENDPOINT : DEFAULT_API_ENDPOINT;

const browserLanguage = (navigator.language || 'en').split('-')[0];
const FILTER_CONFIG = {
    region: '',
    language: browserLanguage,
    categoryId: '',
    minSubs: 0,
    maxSubs: 0,
    excludeKeywords: []
};

function parseVideoDate(dateValue) {
    if (!dateValue) return null;
    if (dateValue instanceof Date) return isNaN(dateValue) ? null : dateValue;
    if (typeof dateValue === 'number') {
        const parsed = new Date(dateValue);
        return isNaN(parsed) ? null : parsed;
    }
    if (typeof dateValue !== 'string') return null;
    const trimmed = dateValue.trim();
    if (!trimmed) return null;
    if (trimmed.includes('T')) {
        const parsed = new Date(trimmed);
        return isNaN(parsed) ? null : parsed;
    }
    const parts = trimmed.split('-').map(Number);
    if (parts.length === 3 && parts.every(Number.isFinite)) {
        const [year, month, day] = parts;
        const parsed = new Date(year, month - 1, day);
        return isNaN(parsed) ? null : parsed;
    }
    const parsed = new Date(trimmed);
    return isNaN(parsed) ? null : parsed;
}

function getVideoDate(video) {
    return (
        parseVideoDate(video.uploadDate) ||
        parseVideoDate(video.publishedAt) ||
        parseVideoDate(video.publishDate) ||
        null
    );
}

function filterVideosByPeriod(videos, period) {
    const periodHoursMap = {
        today: 24,
        '3d': 24 * 3,
        '7d': 24 * 7,
        '30d': 24 * 30
    };
    const hours = periodHoursMap[period];
    if (!hours) return videos;

    const now = new Date();
    const start = new Date(now.getTime() - hours * 60 * 60 * 1000);
    const end = now;

    return videos.filter(video => {
        const videoDate = getVideoDate(video);
        if (!videoDate) return false;
        return videoDate >= start && videoDate <= end;
    });
}

// --- 유틸리티 함수 ---
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

function setActiveButton(activeEl, group) {
    group.forEach(button => button.classList.remove('active'));
    activeEl.classList.add('active');
}

// --- 인피니트 스크롤 관련 함수 ---
function loadNextVideos() {
    if (isRendering) return;
    isRendering = true;

    const newVideosToLoad = currentFilteredVideos.slice(loadedVideosCount, loadedVideosCount + VIDEOS_PER_LOAD);
    
    if (newVideosToLoad.length > 0) {
        renderNewVideos(newVideosToLoad);
        loadedVideosCount += newVideosToLoad.length;
    }
    
    isRendering = false;
}

function setupInfiniteScrollObserver() {
    if (!scrollSentinel) return;
    if (observer) observer.disconnect();

    observer = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting && loadedVideosCount < currentFilteredVideos.length) {
                    loadNextVideos();
                }
            });
        },
        { root: null, rootMargin: '400px 0px', threshold: 0 }
    );

    observer.observe(scrollSentinel);
}

// --- 필터링 로직 ---
async function filterVideos(period) {
    const requestId = ++filterRequestId;
    currentFilter = period;
    videoList.innerHTML = ''; // 새 필터 적용 시 목록 초기화
    loadedVideosCount = 0; // 로드된 개수 초기화
    isRendering = false;
    videoList.dataset.period = period;
    
    videoList.innerHTML = '<p class="text-center text-muted">로딩 중...</p>';

    const cacheKey = `${period}:${currentMode}`;
    try {
        let apiVideos = await fetchVideos(period, currentMode);
        if (!apiVideos.length && period === 'today') {
            apiVideos = await fetchVideos(period, currentMode, { cacheBuster: Date.now() });
        }
        if (requestId !== filterRequestId) return;
        if (apiVideos.length) {
            apiCache.set(cacheKey, apiVideos);
            currentFilteredVideos = apiVideos;
        } else if (apiCache.has(cacheKey)) {
            currentFilteredVideos = apiCache.get(cacheKey);
        } else {
            currentFilteredVideos = filterVideosByPeriod(sampleVideos, period);
        }
    } catch (error) {
        if (requestId !== filterRequestId) return;
        if (apiCache.has(cacheKey)) {
            currentFilteredVideos = apiCache.get(cacheKey);
        } else {
            currentFilteredVideos = filterVideosByPeriod(sampleVideos, period);
        }
    }

    videoList.innerHTML = '';
    const initialVideos = currentFilteredVideos.slice(0, VIDEOS_PER_LOAD);
    renderNewVideos(initialVideos);
    loadedVideosCount = initialVideos.length;
}

// --- 동영상 렌더링 ---
function renderNewVideos(videos) {
    if (videos.length === 0 && loadedVideosCount === 0) {
        videoList.innerHTML = '<p class="text-center">표시할 영상이 없습니다.</p>';
        return;
    }

    const columnClass = 'col-md-4 col-lg-3';
    const videoCards = videos.map(video => {
        const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
        return `
        <div class="${columnClass} mb-4">
            <a href="${videoUrl}" target="_blank" class="card-link text-decoration-none text-dark" data-video-id="${video.id}">
                <div class="card h-100">
                    <img src="${video.thumbnail}" class="card-img-top" alt="${video.title}">
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title">${video.title}</h5>
                        <p class="card-text text-muted">${video.channel}</p>
                    </div>
                </div>
            </a>
        </div>
    `}).join('');

    videoList.insertAdjacentHTML('beforeend', videoCards);

    // 썸네일 검사는 제거 (필터링으로 인해 카드가 숨겨지는 현상 방지)
}

async function fetchVideos(period, mode, options = {}) {
    const params = new URLSearchParams({
        period,
        mode
    });

    if (FILTER_CONFIG.region) params.set('region', FILTER_CONFIG.region);
    if (FILTER_CONFIG.language) params.set('language', FILTER_CONFIG.language);

    if (FILTER_CONFIG.categoryId) params.set('categoryId', FILTER_CONFIG.categoryId);
    if (FILTER_CONFIG.minSubs) params.set('minSubs', FILTER_CONFIG.minSubs);
    if (FILTER_CONFIG.maxSubs) params.set('maxSubs', FILTER_CONFIG.maxSubs);
    if (FILTER_CONFIG.excludeKeywords.length) {
        params.set('excludeKeywords', FILTER_CONFIG.excludeKeywords.join(','));
    }
    if (options.cacheBuster) {
        params.set('_ts', String(options.cacheBuster));
    }

    const requestUrl = `${API_ENDPOINT}?${params.toString()}`;
    let response = await fetch(requestUrl);
    if (!response.ok && !isPreviewHost && API_ENDPOINT === DEFAULT_API_ENDPOINT) {
        response = await fetch(`${FALLBACK_API_ENDPOINT}?${params.toString()}`);
    }
    if (!response.ok) {
        throw new Error('API request failed');
    }

    const data = await response.json();
    return data.items || [];
}

// --- 이벤트 리스너 ---
document.addEventListener('DOMContentLoaded', () => {
    filterVideos(currentFilter); 
    setupInfiniteScrollObserver();
});

filterToday.addEventListener('click', () => {
    setActiveButton(filterToday, [filterToday, filter3d, filter7d, filter30d]);
    filterVideos('today');
});
filter3d.addEventListener('click', () => {
    setActiveButton(filter3d, [filterToday, filter3d, filter7d, filter30d]);
    filterVideos('3d');
});
filter7d.addEventListener('click', () => {
    setActiveButton(filter7d, [filterToday, filter3d, filter7d, filter30d]);
    filterVideos('7d');
});
filter30d.addEventListener('click', () => {
    setActiveButton(filter30d, [filterToday, filter3d, filter7d, filter30d]);
    filterVideos('30d');
});

modeHot.addEventListener('click', () => {
    currentMode = 'hot';
    setActiveButton(modeHot, [modeHot, modeStable]);
    filterVideos(currentFilter);
});
modeStable.addEventListener('click', () => {
    currentMode = 'stable';
    setActiveButton(modeStable, [modeHot, modeStable]);
    filterVideos(currentFilter);
});

window.addEventListener('scroll', debounce(() => {
    // document.documentElement.scrollHeight: 전체 문서의 높이
    // window.innerHeight: 브라우저 창의 보이는 부분의 높이
    // window.scrollY: 스크롤된 높이
    const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 200;
    
    if (isAtBottom && loadedVideosCount < currentFilteredVideos.length) {
        loadNextVideos();
    }
}, 100), { passive: true });
