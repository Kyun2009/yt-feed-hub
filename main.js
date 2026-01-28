// 샘플 동영상 데이터 (실제로는 API를 통해 받아옵니다)
const sampleVideos = [
    { id: 'dQw4w9WgXcQ', title: '80년대 감성으로 만든 뉴진스(NewJeans)의 Hype Boy', channel: '옛날사람', uploadDate: '2026-01-28', thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg' },
    { id: '3-Xq_Zz3nPA', title: '2026년 새해 첫날 해돋이 명소 BEST 5', channel: '여행가자', uploadDate: '2026-01-01', thumbnail: 'https://img.youtube.com/vi/3-Xq_Zz3nPA/0.jpg' },
    { id: 'example01', title: '1월 1주차 주간 인기 하이라이트', channel: '요즘영상', uploadDate: '2026-01-05', thumbnail: 'https://img.youtube.com/vi/s-33i9b3L_c/0.jpg' },
    { id: 'example02', title: '1월 2주차 주간 인기 하이라이트', channel: '요즘영상', uploadDate: '2026-01-12', thumbnail: 'https://img.youtube.com/vi/s-33i9b3L_c/0.jpg' },
    { id: 'example03', title: '1월 3주차 주간 인기 하이라이트', channel: '요즘영상', uploadDate: '2026-01-19', thumbnail: 'https://img.youtube.com/vi/s-33i9b3L_c/0.jpg' },
    { id: 'example04', title: '1월 4주차 주간 인기 하이라이트', channel: '요즘영상', uploadDate: '2026-01-26', thumbnail: 'https://img.youtube.com/vi/s-33i9b3L_c/0.jpg' },
    { id: 'example05', title: '2025년 연말 결산', channel: '요즘영상', uploadDate: '2025-12-31', thumbnail: 'https://img.youtube.com/vi/s-33i9b3L_c/0.jpg' },
];

const videoList = document.getElementById('video-list');
const filterToday = document.getElementById('filter-today');
const filterMonthly = document.getElementById('filter-monthly');
const filterYear = document.getElementById('filter-year');

// --- 필터링 로직 ---
function filterVideos(period) {
    let filteredVideos = [];
    const today = new Date('2026-01-28'); // 오늘 날짜를 2026년 1월 28일로 고정

    switch(period) {
        case 'today':
            const todayString = today.toISOString().split('T')[0];
            filteredVideos = sampleVideos.filter(video => video.uploadDate === todayString);
            break;
        case 'year':
            const currentYear = today.getFullYear();
            filteredVideos = sampleVideos.filter(video => video.uploadDate.startsWith(currentYear.toString()));
            break;
        default:
            // "1월 1주차"와 같은 형식 처리
            if (period.includes('월') && period.includes('주차')) {
                const parts = period.split(' ');
                const month = parseInt(parts[0].replace('월', ''));
                const week = parseInt(parts[1].replace('주차', ''));

                const startDate = (week - 1) * 7 + 1;
                const endDate = week * 7;

                filteredVideos = sampleVideos.filter(video => {
                    const videoDate = new Date(video.uploadDate);
                    const videoMonth = videoDate.getMonth() + 1;
                    const videoDay = videoDate.getDate();
                    return videoMonth === month && videoDay >= startDate && videoDay <= endDate;
                });
            } else {
                 filteredVideos = sampleVideos;
            }
            break;
    }
    renderVideos(filteredVideos);
}


// --- 동영상 렌더링 ---
function renderVideos(videos) {
    videoList.innerHTML = '';
    if (videos.length === 0) {
        videoList.innerHTML = '<p class="text-center">표시할 영상이 없습니다.</p>';
        return;
    }

    const videoCards = videos.map(video => `
        <div class="col-md-4 col-lg-3 mb-4">
            <div class="card h-100" onclick="window.open('https://www.youtube.com/watch?v=${video.id}', '_blank')">
                <img src="${video.thumbnail}" class="card-img-top" alt="${video.title}">
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title">${video.title}</h5>
                    <p class="card-text text-muted">${video.channel}</p>
                </div>
            </div>
        </div>
    `).join('');

    videoList.innerHTML = videoCards;
}


// --- 월별/주차별 메뉴 생성 ---
function createMonthlyMenu() {
    const months = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
    months.forEach((month, index) => {
        const monthIndex = index + 1;
        
        const monthLi = document.createElement('li');
        const monthDiv = document.createElement('div');
        monthDiv.className = 'dropend'; // dropend for side menu

        const monthA = document.createElement('a');
        monthA.className = 'dropdown-item dropdown-toggle';
        monthA.href = '#';
        monthA.textContent = month;
        monthA.setAttribute('data-bs-toggle', 'dropdown');
        monthA.setAttribute('aria-expanded', 'false');

        const weekUl = document.createElement('ul');
        weekUl.className = 'dropdown-menu';

        for (let i = 1; i <= 4; i++) {
            const weekLi = document.createElement('li');
            const weekA = document.createElement('a');
            weekA.className = 'dropdown-item';
            weekA.href = '#';
            weekA.textContent = `${i}주차`;
            weekA.onclick = (e) => {
                e.stopPropagation();
                filterVideos(`${month} ${i}주차`);
                 // Hide the main dropdown
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
    filterVideos('today'); // 초기 로드 시 오늘의 영상 표시 // 초기 로드 시 전체 영상 표시
});

filterToday.addEventListener('click', () => filterVideos('today'));
filterYear.addEventListener('click', () => filterVideos('year'));

// 초기화
filterVideos('today'); // 초기 로드 시 오늘의 영상 표시
