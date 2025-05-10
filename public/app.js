document.addEventListener('DOMContentLoaded', async () => {
  const loadingEl = document.getElementById('loading');
  const filenameEl = document.getElementById('filename');
  const diffStatsEl = document.getElementById('diff-stats');
  const treeFilterEl = document.getElementById('tree-filter');
  const prevFileBtn = document.getElementById('prev-file');
  const nextFileBtn = document.getElementById('next-file');
  
  let allFiles = [];
  let sortedAllFiles = []
  let currentFileIndex = -1;

  try {
    loadingEl.style.display = 'inline';

    const urlParams = new URLSearchParams(window.location.search);
    const diffUrl = urlParams.get('url');

    let diffText = '';
    if (diffUrl) {
      const response = await fetch(diffUrl);
      if (!response.ok) throw new Error(`加载失败（状态码 ${response.status}）`);
      diffText = await response.text();
      filenameEl.textContent = `加载自: ${new URL(diffUrl).pathname.split('/').pop()}`;
    } 
    allFiles = parseDiff(diffText);
    console.log('files:',allFiles)
    updateDiffStats(allFiles);
    buildTree(allFiles);
    document.querySelectorAll('.tree-node.file').forEach(node => {
      const filePath = node.dataset.path;
      const matchedFile = allFiles.find(f => f.fileName === filePath);
      if (matchedFile) {
        sortedAllFiles.push(matchedFile);
      }
    });
    console.log('sortedAllFiles',sortedAllFiles)
    // 默认显示第一个文件
    if (sortedAllFiles.length > 0) {
      currentFileIndex = 0;
      displayDiff(sortedAllFiles[currentFileIndex]);
      document.querySelector(`.tree-node.file[data-path="${sortedAllFiles[currentFileIndex].fileName}"]`).classList.add('selected');
    }
  } catch (err) {
    console.error('加载或解析 diff 失败:', err);
    filenameEl.textContent = `❌ 加载失败: ${err.message}`;
    document.getElementById('file-tree').innerHTML =
      `<div class="tree-placeholder" style="color:red;">加载失败，请检查 URL 或 diff 内容</div>`;
  } finally {
    loadingEl.style.display = 'none';
  }

  // 文件导航
  prevFileBtn.addEventListener('click', () => navigateFile(-1));
  nextFileBtn.addEventListener('click', () => navigateFile(1));

  // 键盘导航
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') navigateFile(-1);
    if (e.key === 'ArrowDown') navigateFile(1);
  });

  // 文件过滤
  treeFilterEl.addEventListener('input', () => {
    const filter = treeFilterEl.value.toLowerCase();
    if (!filter) {
      document.querySelectorAll('.tree-node').forEach(node => {
        node.style.display = '';
      });
      return;
    }

    document.querySelectorAll('.tree-node.file').forEach(node => {
      const path = node.dataset.path.toLowerCase();
      node.style.display = path.includes(filter) ? '' : 'none';
    });
  });

  function navigateFile(direction) {
    if (sortedAllFiles.length === 0) return;
    
    currentFileIndex = (currentFileIndex + direction + sortedAllFiles.length) % sortedAllFiles.length;
    displayDiff(sortedAllFiles[currentFileIndex]);
    console.log()
    // 滚动到选中的文件
    const selectedNode = document.querySelector(`.tree-node.file[data-path="${sortedAllFiles[currentFileIndex].fileName}"]`);
    if (selectedNode) {
      selectedNode.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      document.querySelectorAll('.tree-node.selected').forEach(n => n.classList.remove('selected'));
      selectedNode.classList.add('selected');
    }
  }

  function updateDiffStats(files) {
    const added = files.filter(f => f.fileStatus == 'add').length;
    const removed = files.filter(f => f.fileStatus == 'delete').length;
    const modified = files.filter(f => f.fileStatus == 'modify').length;
    const renamed = files.filter(f => f.fileStatus == 'rename').length;
    
    diffStatsEl.textContent = `${files.length} 个文件 (${added} 新增, ${removed} 删除, ${modified} 修改, ${renamed} 重命名)`;
  }
  
  setupSidebarResizer();

});


function setupSidebarResizer() {
  const container = document.querySelector('.container');
  const sidebar = document.querySelector('.sidebar');
  const content = document.querySelector('.content');
  
  // 确保DOM结构正确
  const resizer = document.createElement('div');
  resizer.className = 'sidebar-resizer';
  container.insertBefore(resizer, content); // 将resizer放在sidebar和content之间

  let isResizing = false;
  let lastX = 0;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    lastX = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none'; // 防止拖动时选中文本
    e.preventDefault(); // 防止默认行为
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const currentWidth = parseInt(getComputedStyle(sidebar).width);
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    // const newWidth = currentWidth + dx;
    const newWidth = e.clientX
    // 限制最小和最大宽度
    const minWidth = 150;
    const maxWidth = container.clientWidth * 0.7;
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      sidebar.style.width = `${newWidth}px`;
      // content.style.marginLeft = `${newWidth + 8}px`; // 8px是resizer宽度
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}