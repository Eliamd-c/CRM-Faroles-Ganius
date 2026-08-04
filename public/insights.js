let mediaChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  loadInsights();
});

async function loadInsights() {
  await loadProfile();
  await loadMedia();
}

async function loadProfile() {
  try {
    const res = await fetch('/api/insights/profile');
    const data = await res.json();
    
    if (data.error) {
      console.error(data.error);
      return;
    }
    
    document.getElementById('profilePic').src = data.profile_picture_url || 'https://via.placeholder.com/64';
    document.getElementById('profileName').innerText = data.name || data.username;
    document.getElementById('profileUsername').innerText = data.username;
    
    document.getElementById('kpiFollowers').innerText = formatNumber(data.followers_count);
    document.getElementById('kpiFollows').innerText = formatNumber(data.follows_count);
    document.getElementById('kpiMedia').innerText = formatNumber(data.media_count);
  } catch (e) {
    console.error('Error fetching profile:', e);
  }
}

async function loadMedia() {
  try {
    const res = await fetch('/api/insights/media');
    const data = await res.json();
    
    if (data.error || !data.data) {
      console.error(data.error);
      return;
    }
    
    const mediaList = data.data;
    
    // Renderizar Grid
    const grid = document.getElementById('mediaGrid');
    grid.innerHTML = '';
    
    mediaList.forEach(m => {
      const imgUrl = m.media_type === 'VIDEO' ? (m.thumbnail_url || m.media_url) : m.media_url;
      const card = document.createElement('div');
      card.className = 'media-card';
      card.innerHTML = `
        <a href="${m.permalink}" target="_blank">
          <img src="${imgUrl}" class="media-img" alt="Media">
        </a>
        <div class="media-stats">
          <span title="Likes"><i class="fa-solid fa-heart"></i> ${formatNumber(m.like_count)}</span>
          <span title="Comentarios"><i class="fa-solid fa-comment"></i> ${formatNumber(m.comments_count)}</span>
        </div>
        <div class="media-caption" title="${m.caption || ''}">${m.caption || 'Sin descripción'}</div>
      `;
      grid.appendChild(card);
    });
    
    // Renderizar Chart (invertir para ver más viejo a más nuevo en el gráfico de los últimos posts)
    renderChart(mediaList.slice().reverse());
    
  } catch (e) {
    console.error('Error fetching media:', e);
  }
}

function renderChart(mediaList) {
  const ctx = document.getElementById('mediaChart').getContext('2d');
  
  if (mediaChartInstance) {
    mediaChartInstance.destroy();
  }
  
  const labels = mediaList.map((m, i) => {
    const d = new Date(m.timestamp);
    return `${d.getDate()}/${d.getMonth()+1}`;
  });
  
  const likesData = mediaList.map(m => m.like_count || 0);
  const commentsData = mediaList.map(m => m.comments_count || 0);
  
  mediaChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Likes',
          data: likesData,
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1
        },
        {
          label: 'Comentarios',
          data: commentsData,
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function formatNumber(num) {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}
