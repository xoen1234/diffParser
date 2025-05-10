function parseDiff(diffText) {
  const files = [];
  const lines = diffText.split('\n');
  let currentFile = null;
  let isBinary = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检测二进制文件
    if (line.startsWith('Binary files ')) {
      if (currentFile) {
        currentFile.isBinary = true;
      }
      continue;
    }

    if (line.startsWith('diff ')) {
      // 新文件开始
      let fileName = line.split(' ')[3]
      let array = fileName.split('/')
      fileName=fileName.replace(array[0]+'/','').replace(array[1]+'/','')
      currentFile = {
        rawfileName : line,
        fileName :fileName,
        oldPath: null,
        newPath: null,
        chunks: [],
        isBinary: false,
        diff: [line]    
      };
      files.push(currentFile);
      continue;
    }

    if (line.startsWith('Index: ')) {
      // Git 的 Index 行
      continue;
    }

    if (line.startsWith('--- ')) {
      if (currentFile) {
        currentFile.oldPath = line.slice(4).trim().split('\t')[0];
        // if (currentFile.oldPath === '/dev/null') {
        //   currentFile.oldPath = '/dev/null';
        // }
        currentFile.diff.push(line);
      }
      continue;
    }

    if (line.startsWith('+++ ')) {
      if (currentFile) {
        currentFile.newPath = line.slice(4).trim().split('\t')[0];
        // if (currentFile.newPath === '/dev/null') {
        //   currentFile.newPath = null;
        // }
        currentFile.diff.push(line);
      }
      continue;
    }

    if (line.startsWith('@@')) {
      if (currentFile) {
        const chunk = {
          header: line,
          lines: [],
          oldStart: 0,
          oldLines: 0,
          newStart: 0,
          newLines: 0
        };
        
        // 解析块头信息
        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (match) {
          chunk.oldStart = parseInt(match[1]);
          chunk.oldLines = parseInt(match[2] || '1');
          chunk.newStart = parseInt(match[3]);
          chunk.newLines = parseInt(match[4] || '1');
        }
        
        currentFile.chunks.push(chunk);
        currentFile.diff.push(line);
      }
      continue;
    }

    if (currentFile) {
      if (currentFile.chunks.length > 0) {
        currentFile.chunks[currentFile.chunks.length - 1].lines.push(line);
      }
      currentFile.diff.push(line);
    }
  }

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

  // 渲染树结构为 DOM
  function createTreeDom(obj, parent, path = '') {
    Object.keys(obj).sort().forEach(key => {
      if (key === '__file') return;
      
      const fullPath = path ? `${path}/${key}` : key;
      const item = document.createElement('div');
      item.classList.add('tree-node');
      
      if (obj[key].__file) {
        // 文件节点
        const file = obj[key].__file;
        item.classList.add('file');
        item.dataset.path = fullPath;
        
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
        
        if (!file.newPath) {
          status.classList.add('status-removed');
          status.textContent = '删除';
        } else if (!file.oldPath) {
          status.classList.add('status-added');
          status.textContent = '新增';
        } else if (file.newPath !== file.oldPath) {
          status.classList.add('status-renamed');
          status.textContent = '重命名';
        } else {
          status.classList.add('status-modified');
          status.textContent = '修改';
        }
        
        label.appendChild(status);
        item.appendChild(label);
        
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          currentFileIndex = flatFiles.indexOf(file);
          displayDiff(file);
          
          // 更新选中状态
          document.querySelectorAll('.tree-node.selected').forEach(n => n.classList.remove('selected'));
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
  console.log(root)
  createTreeDom(root, treeContent);
}


function displayDiff(file) {
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