let currentFileIndex = -1;
document.addEventListener('DOMContentLoaded', async () => {
  const loadingEl = document.getElementById('loading');
  const filenameEl = document.getElementById('filename');
  const diffStatsEl = document.getElementById('diff-stats');
  const treeFilterEl = document.getElementById('tree-filter');
  const prevFileBtn = document.getElementById('prev-file');
  const nextFileBtn = document.getElementById('next-file');
  
  let allFiles = [];
  let sortedAllFiles = []
 

  try {
    loadingEl.style.display = 'inline';

    const urlParams = new URLSearchParams(window.location.search);
    const diffUrl = urlParams.get('url');

    let diffText = '';
    if (diffUrl) {
      const response = await fetch(diffUrl);
      if (!response.ok) throw new Error(`加载失败（状态码 ${response.status}）`);
      diffText = await response.text();
      filenameEl.textContent = ` ${new URL(diffUrl).pathname.split('/').pop()}`;
    } 
    allFiles = parseDiff(diffText);
    console.log('files:',allFiles)
    updateDiffStats(allFiles);
    buildTree(allFiles);

    document.querySelectorAll('.tree-node.file').forEach(node => {
      const filePath = node.dataset.path;
      const matchedFile = allFiles.find(f => f.fileName === filePath);
      matchedFile.fileSeq = sortedAllFiles.length
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



function parseDiff(diffText) {
  // 1. 先按文件分割整个diff文本
  const fileSections = diffText.split(/(?=^diff --git)/m);
  const files = [];

  // 2. 逐个处理每个文件块
  for (const section of fileSections) {
    if (!section.trim()) continue;  
    const lines = section.split('\n');
    let currentFile =  {
          rawfileName: '',
          fileName: '',  // 使用旧路径作为基准文件名
          fileStatus:'',
          oldPath: null,
          newPath: null,
          chunks: [],
          isBinary: false,
          diff: []
        };;
    let isBinary = false;
    files.push(currentFile);
    let filePreFix = ''
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentFile.diff.push(line);
      // 检测二进制文件
      if (line.startsWith('Binary files ')) {
        if (currentFile) {
          currentFile.isBinary = true;
        }
        continue;
      }

      if (line.startsWith('diff --git')) {
        // 解析文件名（更健壮的方式）
        // const match = line.match(/^diff --git a\/(.+?) b\/(.+?)$/);
        let fileName = line.split(' ')[3]
        let array = fileName.split('/')
        filePreFix = array[0]+'/'+array[1]+'/'
        currentFile.fileName=fileName.replace(filePreFix,'')    
        continue;
      }

      if (!currentFile) continue;

      if (line.startsWith('Index: ')) {
        continue;
      }
      if (line.startsWith('deleted file mode')) {
        currentFile.fileStatus = currentFile.fileStatus||'delete'
        continue;
      }
      if (line.startsWith('rename from')) {
        currentFile.oldPath = line 
        currentFile.fileStatus = currentFile.fileStatus||'rename'
        continue;
      }
      if (line.startsWith('rename to')) {
        currentFile.newPath = line

        continue;
      }
      if (line.startsWith('--- ')) {
        currentFile.oldPath = line.slice(4).trim().split('\t')[0].replace(filePreFix,'');
        // currentFile.diff.push(line);
        continue;
      }

      if (line.startsWith('+++ ')) {
        currentFile.newPath = line.slice(4).trim().split('\t')[0];
        // currentFile.diff.push(line);
        continue;
      }
     if (line.startsWith('new file mode')) {
        currentFile.fileStatus = currentFile.fileStatus||'add'
        continue;
      }
      if (line.startsWith('@@')) {
        currentFile.fileStatus = currentFile.fileStatus||'modify'
        const chunk = {
          header: line,
          lines: [],
          oldStart: 0,
          oldLines: 0,
          newStart: 0,
          newLines: 0
        };
        
        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (match) {
          chunk.oldStart = parseInt(match[1]);
          chunk.oldLines = parseInt(match[2] || '1');
          chunk.newStart = parseInt(match[3]);
          chunk.newLines = parseInt(match[4] || '1');
        }
        
        currentFile.chunks.push(chunk);
        // currentFile.diff.push(line);
        continue;
      }

      if (currentFile.chunks.length > 0) {
        currentFile.chunks[currentFile.chunks.length - 1].lines.push(line);
      }
      // currentFile.diff.push(line);
    }
  }
  //  files = files.forEach(item=>{
     
  //  })
  return files;
}

function buildTree(files) {
  const treeContent = document.querySelector('.tree-content');
  treeContent.innerHTML = '';

  const root = {};
  const flatFiles = [];

  files.forEach((file,index) => {
    // 跳过无效路径的文件
    // let path = file.newPath || file.oldPath;
    let path = file.fileName
    // if (!path) {
    //   path = 'default/'+index
    //   console.warn('解析待兼容放到默认路径:', index,file);
    // }

    flatFiles.push(file);
    const parts = path.split('/');
    let current = root;
    
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if(part == 'a'||part == 'b'){ //去掉git对比自动生成的临时目录ab
        continue
      }
      if (!current[part]) {
        current[part] = i === parts.length - 1 ? { __file: file } : {};
      }
      current = current[part];
    }
  });
  console.log('root',root)
  createTreeDom(root, treeContent,flatFiles);
}
// 渲染树结构为 DOM
function createTreeDom(obj, parent, flatFiles,path = '') {
    // 先处理文件夹，再处理文件
  
  const keys = Object.keys(obj).sort((a, b) => {
    const isAFolder = !obj[a].__file;
    const isBFolder = !obj[b].__file;
    
    // 文件夹排在前面
    if (isAFolder && !isBFolder) return -1;
    if (!isAFolder && isBFolder) return 1;
    
    // 同类型按字母排序
    return a.localeCompare(b);
  });
  keys.forEach(key => {
    if (key === '__file') return;
    
    const fullPath = path ? `${path}/${key}` : key;
    const item = document.createElement('div');
    item.classList.add('tree-node');
    
    if (obj[key].__file) {
      // 文件节点
      const file = obj[key].__file;
      item.classList.add('file');
      item.dataset.path = file.fileName;
      
      const label = document.createElement('div');
      label.classList.add('node-label');
      
      // 文件图标
      const icon = document.createElement('i');
      icon.className = 'far fa-file-alt';
      label.appendChild(icon);
      
      // 文件名
      const name = document.createElement('span');
      name.textContent = key;
      label.appendChild(name);
      
      // 文件状态
      const status = document.createElement('span');
      status.classList.add('file-status');
      switch(file.fileStatus){
        case 'delete' :
                    status.classList.add('status-removed');
                    status.textContent = '删除';
                    break
        case 'add' :
                    status.classList.add('status-added');
                    status.textContent = '新增';
                    break
        case 'rename' :
                    status.classList.add('status-renamed');
                    status.textContent = '重命名';
                    break
        case 'modify' :
                    status.classList.add('status-modified');
                    status.textContent = '修改';
                    break
      }
      label.appendChild(status);
      item.appendChild(label);
      
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        currentFileIndex = flatFiles.indexOf(file);
        displayDiff(file);
        
        // 更新选中状态
        document.querySelectorAll('.tree-node.selected').forEach(n => n.classList.remove('selected'));
        console.log(item)
        item.classList.add('selected');
      });
    } else {
      // 目录节点
      item.classList.add('folder');
      
      const label = document.createElement('div');
      label.classList.add('node-label');
      
      // 文件夹图标
      const icon = document.createElement('i');
      icon.className = 'far fa-folder';
      label.appendChild(icon);
      
      // 文件夹名
      const name = document.createElement('span');
      name.textContent = key;
      label.appendChild(name);
      
      item.appendChild(label);
      
      const children = document.createElement('div');
      children.classList.add('children');
      createTreeDom(obj[key], children, fullPath);
      
      item.appendChild(children);
      
      label.addEventListener('click', (e) => {
        e.stopPropagation();
        item.classList.toggle('collapsed');
        icon.className = item.classList.contains('collapsed') ? 'far fa-folder' : 'far fa-folder-open';
      });
    }
    
    parent.appendChild(item);
  });
}
function createIcon(type) {
  const icon = document.createElement('img');
  icon.className = 'asset';
  icon.src = `icons/${type}.svg`;
  icon.alt = type;
  return icon;
}
function displayDiff(file) {
  console.log('displayingfile',file)
  currentFileIndex = file.fileSeq
  const diffContent = document.getElementById('diff-content');
  const filePathEl = document.getElementById('file-path');
  
  diffContent.innerHTML = '';
  
  if (!file) {
    diffContent.innerHTML = '<div class="diff-placeholder">没有可显示的内容</div>';
    filePathEl.textContent = '';
    return;
  }
  
  filePathEl.textContent = file.fileName;

  // 创建左右对比容器
  const container = document.createElement('div');
  container.className = 'diff-container';
  
  // 左侧旧版本
  const sideOld = document.createElement('div');
  sideOld.className = 'diff-side diff-side-old';
  sideOld.innerHTML = `<div class="diff-header">旧版本: ${file.oldPath || '无'}</div>`;
  
  // 右侧新版本
  const sideNew = document.createElement('div');
  sideNew.className = 'diff-side diff-side-new';
  sideNew.innerHTML = `<div class="diff-header">新版本: ${file.newPath || '无'}</div>`;
  
  container.appendChild(sideOld);
  container.appendChild(sideNew);
  diffContent.appendChild(container);

  // 渲染对比内容
  file.chunks.forEach(chunk => {
    let oldLine = chunk.oldStart;
    let newLine = chunk.newStart;
    
    chunk.lines.forEach(line => {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        // 新增行（只显示在右侧）
        appendLine(sideNew, 'new', newLine++, line.slice(1), 'added');
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        // 删除行（只显示在左侧）
        appendLine(sideOld, 'old', oldLine++, line.slice(1), 'removed');
      } else {
        // 未修改行（两侧同步显示）
        appendLine(sideOld, 'old', oldLine++, line.startsWith(' ') ? line.slice(1) : line, 'context');
        appendLine(sideNew, 'new', newLine++, line.startsWith(' ') ? line.slice(1) : line, 'context');
      }
    });
  });
}

// 辅助函数：添加行到指定侧
function appendLine(side, type, lineNum, text, lineType) {
  const lineEl = document.createElement('div');
  lineEl.className = `diff-line diff-line-${lineType}`;
  
  const lineNumEl = document.createElement('div');
  lineNumEl.className = 'diff-line-num';
  lineNumEl.textContent = lineType !== (type === 'new' ? 'removed' : 'added') ? lineNum : '';
  
  const lineContent = document.createElement('div');
  lineContent.className = 'diff-line-content';
  lineContent.textContent = text;
  
  lineEl.appendChild(lineNumEl);
  lineEl.appendChild(lineContent);
  side.appendChild(lineEl);
}