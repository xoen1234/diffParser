document.addEventListener('DOMContentLoaded', async () => {
  const loadingEl = document.getElementById('loading');
  const filenameEl = document.getElementById('filename');
  const diffStatsEl = document.getElementById('diff-stats');
  const treeFilterEl = document.getElementById('tree-filter');
  const prevFileBtn = document.getElementById('prev-file');
  const nextFileBtn = document.getElementById('next-file');
  
  let allFiles = [];
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
    } else {
      // 使用示例数据
      diffText = `diff --git a/README.md b/README.md
index 1234567..89abcde 100644
--- a/README.md
+++ b/README.md
@@ -1,5 +1,6 @@
 # 项目名称
-这是旧的项目描述。
+这是新的项目描述。
+新增了一行内容。
 
 ## 功能特性
 - 功能1
@@ -10,3 +11,4 @@ index 1234567..89abcde 100644
 ## 安装
 
 使用 npm 安装：
+npm install
diff --git a/src/index.js b/src/index.js
new file mode 100644
index 0000000..e69de29
diff --git a/src/utils.js b/src/utils.js
deleted file mode 100644
index e69de29..0000000
`;
      filenameEl.textContent = '示例 diff 数据';
    }

    allFiles = parseDiff(diffText);
    console.log('files:',allFiles)
    updateDiffStats(allFiles);
    buildTree(allFiles);
    
    // 默认显示第一个文件
    if (allFiles.length > 0) {
      currentFileIndex = 0;
      displayDiff(allFiles[currentFileIndex]);
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
    if (allFiles.length === 0) return;
    
    currentFileIndex = (currentFileIndex + direction + allFiles.length) % allFiles.length;
    displayDiff(allFiles[currentFileIndex]);
    
    // 滚动到选中的文件
    const selectedNode = document.querySelector(`.tree-node.file[data-path="${allFiles[currentFileIndex].newPath}"]`);
    if (selectedNode) {
      selectedNode.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      document.querySelectorAll('.tree-node.selected').forEach(n => n.classList.remove('selected'));
      selectedNode.classList.add('selected');
    }
  }

  function updateDiffStats(files) {
    const added = files.filter(f => f.newPath && !f.oldPath).length;
    const removed = files.filter(f => !f.newPath && f.oldPath).length;
    const modified = files.filter(f => f.newPath && f.oldPath && f.newPath === f.oldPath).length;
    const renamed = files.filter(f => f.newPath && f.oldPath && f.newPath !== f.oldPath).length;
    
    diffStatsEl.textContent = `${files.length} 个文件 (${added} 新增, ${removed} 删除, ${modified} 修改, ${renamed} 重命名)`;
  }
});