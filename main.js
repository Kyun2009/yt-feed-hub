// 샘플 동영상 데이터 (글로벌 인기 영상으로 복구)
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
const filterMonthly = document.getElementById('filter-monthly');
const filterYear = document.getElementById('filter-year');

let currentFilter = 'today';
let currentFilteredVideos = [];
const VIDEOS_PER_LOAD = 8;
let loadedVideosCount = 0;
let isRendering = false;

// --- 유틸리티 함수 ---
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

function formatLocalDate(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function getWeekOfMonth(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun..6=Sat
    const firstDayMondayIndex = (firstDay + 6) % 7; // 0=Mon..6=Sun
    return Math.floor((date.getDate() + firstDayMondayIndex - 1) / 7) + 1;
}

function getWeeksInMonth(year, monthIndex) {
    const lastDay = new Date(year, monthIndex + 1, 0);
    return getWeekOfMonth(lastDay);
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

// --- 필터링 로직 ---
function filterVideos(period) {
    currentFilter = period;
    videoList.innerHTML = ''; // 새 필터 적용 시 목록 초기화
    loadedVideosCount = 0; // 로드된 개수 초기화
    
    let filteredVideos = [];
    const today = new Date(); // 실제 오늘 날짜 사용
    const todayString = formatLocalDate(today);

    switch(period) {
        case 'today':
            filteredVideos = sampleVideos.filter(video => video.uploadDate === todayString);
            break;
        case 'year':
            const currentYear = today.getFullYear();
            filteredVideos = sampleVideos.filter(video => video.uploadDate.startsWith(currentYear.toString()));
            break;
        default:
            if (period.includes('월') && period.includes('주차')) {
                const parts = period.split(' ');
                const month = parseInt(parts[0].replace('월', ''));
                const week = parseInt(parts[1].replace('주차', ''));
                filteredVideos = sampleVideos.filter(video => {
                    const videoDate = new Date(video.uploadDate);
                    return (
                        videoDate.getMonth() + 1 === month &&
                        getWeekOfMonth(videoDate) === week
                    );
                });
            } else {
                 filteredVideos = sampleVideos;
            }
            break;
    }
    currentFilteredVideos = filteredVideos;
    loadNextVideos(); // 첫번째 배치 로드
}

// --- 동영상 렌더링 ---
function renderNewVideos(videos) {
    if (videos.length === 0 && loadedVideosCount === 0) {
        videoList.innerHTML = '<p class="text-center">표시할 영상이 없습니다.</p>';
        return;
    }

    const videoCards = videos.map(video => {
        const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
        return `
        <div class="col-md-4 col-lg-3 mb-4">
            <a href="${videoUrl}" target="_blank" class="card-link text-decoration-none text-dark">
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
}

// --- 월별/주차별 메뉴 생성 ---
function createMonthlyMenu() {
    const months = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
    const currentYear = new Date().getFullYear();
    months.forEach((month, monthIndex) => {
        const monthLi = document.createElement('li');
        const monthDiv = document.createElement('div');
        monthDiv.className = 'dropend';

        const monthA = document.createElement('a');
        monthA.className = 'dropdown-item dropdown-toggle';
        monthA.href = '#';
        monthA.textContent = month;
        monthA.setAttribute('data-bs-toggle', 'dropdown');
        monthA.setAttribute('aria-expanded', 'false');

        const weekUl = document.createElement('ul');
        weekUl.className = 'dropdown-menu';

        const weeksInMonth = getWeeksInMonth(currentYear, monthIndex);
        for (let i = 1; i <= weeksInMonth; i++) {
            const weekLi = document.createElement('li');
            const weekA = document.createElement('a');
            weekA.className = 'dropdown-item';
            weekA.href = '#';
            weekA.textContent = `${i}주차`;
            weekA.onclick = (e) => {
                e.stopPropagation();
                filterVideos(`${month} ${i}주차`);
                const mainDropdown = bootstrap.Dropdown.getInstance(filterMonthly.previousElementSibling);
                if (mainDropdown) {
                    mainDropdown.hide();
                }
            };
            weekLi.appendChild(weekA);
            weekUl.appendChild(weekLi);
        }
        
        monthDiv.appendChild(monthA);
        monthDiv.appendChild(weekUl);
        monthLi.appendChild(monthDiv);
        filterMonthly.appendChild(monthLi);
    });
}

// --- 이벤트 리스너 ---
document.addEventListener('DOMContentLoaded', () => {
    createMonthlyMenu();
    filterVideos(currentFilter); 
});

filterToday.addEventListener('click', () => filterVideos('today'));
filterYear.addEventListener('click', () => filterVideos('year'));

window.addEventListener('scroll', debounce(() => {
    // document.documentElement.scrollHeight: 전체 문서의 높이
    // window.innerHeight: 브라우저 창의 보이는 부분의 높이
    // window.scrollY: 스크롤된 높이
    const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 200;
    
    if (isAtBottom && loadedVideosCount < currentFilteredVideos.length) {
        loadNextVideos();
    }
}, 100));
