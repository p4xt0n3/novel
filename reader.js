const reader = document.querySelector('#reader');
const startButton = document.querySelector('#start-reading');
const closeButton = document.querySelector('#reader-close');
const toggleButton = document.querySelector('#reader-toggle');
const layout = document.querySelector('#reader-layout');
const chapterList = document.querySelector('#chapter-list');
const chapterListToggle = document.querySelector('#chapter-list-toggle');
const readerContent = document.querySelector('#reader-content');
const chapterTitle = document.querySelector('#chapter-title');
const novelText = document.querySelector('#novel-text');
const empty = document.querySelector('#reader-empty');
const nextChapterButton = document.querySelector('#chapter-next');
const readingProgress = document.querySelector('#reading-progress');
const savedPosition = document.querySelector('#saved-position');
const downloadButton = document.querySelector('#download-chapters');
const autoScrollButton = document.querySelector('#auto-scroll-toggle');
const voiceButton = document.querySelector('#voice-toggle');
const toolStatus = document.querySelector('#tool-status');
const STORAGE_KEY = 'p4xton-book1-reading-progress';

let progress = readProgress();
let isOpen = false;
let saveTimer;
let loadToken = 0;
let autoScrollFrame = 0;
let previousFrameTime = 0;
let narrationToken = 0;
let narrating = false;
let voiceBusy = false;

for (let chapter = 1; chapter <= 100; chapter += 1) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'chapter-item';
  button.dataset.chapter = String(chapter);
  button.textContent = `第 ${chapter} 章`;
  button.addEventListener('click', () => loadChapter(chapter, 0));
  chapterList.append(button);
}

updateSavedPosition();
markActiveChapter();

function readProgress() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      chapter: Math.min(100, Math.max(1, Number(stored.chapter) || 1)),
      scroll: Math.max(0, Number(stored.scroll) || 0),
    };
  } catch {
    return { chapter: 1, scroll: 0 };
  }
}

function saveProgress() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch { /* storage may be disabled */ }
  updateSavedPosition();
}

function updateSavedPosition() {
  savedPosition.textContent = progress.scroll > 0 || progress.chapter > 1
    ? `上次读到：第 ${progress.chapter} 章`
    : '尚未开始阅读';
}

function markActiveChapter() {
  chapterList.querySelectorAll('.chapter-item').forEach((button) => {
    const active = Number(button.dataset.chapter) === progress.chapter;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
}

function setReaderOpen(open) {
  isOpen = open;
  reader.classList.toggle('is-open', open);
  reader.setAttribute('aria-hidden', String(!open));
  document.body.classList.toggle('reader-open', open);
  if (open) {
    loadChapter(progress.chapter, progress.scroll);
    readerContent.focus({ preventScroll: true });
  } else {
    setAutoScroll(false);
    stopNarration();
    startButton.focus();
  }
}

async function loadChapter(chapter, scrollPosition = 0) {
  const token = ++loadToken;
  stopNarration();
  progress.chapter = chapter;
  progress.scroll = scrollPosition;
  chapterTitle.textContent = `第 ${chapter} 章`;
  novelText.replaceChildren();
  empty.hidden = true;
  empty.textContent = '';
  chapterList.classList.add('loading');
  markActiveChapter();
  readerContent.scrollTop = 0;
  readingProgress.textContent = `第 ${chapter} 章 · 读取中`;
  saveProgress();

  try {
    const response = await fetch(`1ch${chapter}.txt`);
    if (token !== loadToken) return;
    if (!response.ok) throw new Error('Chapter not found');
    const text = (await response.text()).trim();
    if (!text) throw new Error('Chapter is empty');
    const [titleLine, ...bodyLines] = text.split(/\r?\n/);
    chapterTitle.textContent = titleLine.trim() || `第 ${chapter} 章`;
    renderNovelBody(bodyLines.join('\n').replace(/^\n+/, ''));
    chapterList.classList.remove('loading');
    requestAnimationFrame(() => {
      readerContent.scrollTop = scrollPosition;
      updateReadingProgress();
    });
  } catch {
    if (token !== loadToken) return;
    chapterList.classList.remove('loading');
    empty.textContent = `暂时找不到 1ch${chapter}.txt。将章节 TXT 文件放在网站根目录后即可阅读。`;
    empty.hidden = false;
    readingProgress.textContent = `第 ${chapter} 章`;
  }
}

function renderNovelBody(text) {
  novelText.replaceChildren();
  const paragraphs = text.split(/\n\s*\n+/).filter((part) => part.trim());
  paragraphs.forEach((paragraphText) => {
    const paragraph = document.createElement('p');
    paragraph.className = 'reader-paragraph';
    paragraph.textContent = paragraphText.trim();
    novelText.append(paragraph);
  });
}

function updateReadingProgress() {
  const maxScroll = readerContent.scrollHeight - readerContent.clientHeight;
  const percent = maxScroll > 0 ? Math.min(100, Math.round(readerContent.scrollTop / maxScroll * 100)) : 0;
  readingProgress.textContent = `第 ${progress.chapter} 章 · ${percent}%`;
  progress.scroll = readerContent.scrollTop;
  saveProgress();
}

function toggleSidebar() {
  const hidden = layout.classList.toggle('sidebar-hidden');
  toggleButton.setAttribute('aria-expanded', String(!hidden));
}

function toggleChapterList() {
  const collapsed = chapterList.classList.toggle('collapsed');
  chapterListToggle.setAttribute('aria-expanded', String(!collapsed));
  chapterListToggle.querySelector('span').textContent = collapsed ? '›' : '⌄';
}

function setAutoScroll(enabled) {
  if (!enabled) {
    cancelAnimationFrame(autoScrollFrame);
    autoScrollFrame = 0;
    previousFrameTime = 0;
    autoScrollButton.classList.remove('active');
    autoScrollButton.innerHTML = '<span>⇣</span> 开始自动滚动';
    return;
  }
  autoScrollButton.classList.add('active');
  autoScrollButton.innerHTML = '<span>Ⅱ</span> 暂停自动滚动';
  previousFrameTime = 0;
  autoScrollFrame = requestAnimationFrame(stepAutoScroll);
}

function stepAutoScroll(timestamp) {
  if (!autoScrollFrame) return;
  if (previousFrameTime) readerContent.scrollTop += (timestamp - previousFrameTime) * 0.018;
  previousFrameTime = timestamp;
  if (readerContent.scrollTop + readerContent.clientHeight >= readerContent.scrollHeight - 2) {
    setAutoScroll(false);
    return;
  }
  autoScrollFrame = requestAnimationFrame(stepAutoScroll);
}

async function startNarration() {
  const paragraphs = [...novelText.querySelectorAll('.reader-paragraph')];
  if (!paragraphs.length || voiceBusy) return;
  voiceBusy = true;
  narrating = true;
  const token = ++narrationToken;
  let speechFailed = false;
  voiceButton.classList.add('active');
  voiceButton.innerHTML = '<span>■</span> 停止后续朗读';
  toolStatus.textContent = '中文男声朗读中';
  for (const paragraph of paragraphs) {
    if (token !== narrationToken) break;
    paragraph.classList.add('speaking');
    paragraph.scrollIntoView({ behavior: 'smooth', block: 'center' });
    try {
      await websim.textToSpeech({ text: paragraph.textContent, voice: 'zh-male' });
    } catch {
      speechFailed = true;
      toolStatus.textContent = '当前浏览器暂不支持男声朗读';
      break;
    } finally {
      paragraph.classList.remove('speaking');
    }
  }
  if (token !== narrationToken) {
    voiceBusy = false;
    voiceButton.disabled = false;
    voiceButton.classList.remove('active');
    voiceButton.innerHTML = '<span>◖</span> 男声朗读';
    return;
  }
  if (!speechFailed) toolStatus.textContent = '朗读完成';
  narrating = false;
  voiceBusy = false;
  voiceButton.classList.remove('active');
  voiceButton.innerHTML = '<span>◖</span> 男声朗读';
}

function stopNarration() {
  if (!narrating) return;
  narrationToken += 1;
  narrating = false;
  voiceButton.classList.remove('active');
  voiceButton.disabled = true;
  voiceButton.innerHTML = '<span>…</span> 等待当前段落结束';
  toolStatus.textContent = '当前段落播完后停止';
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipFiles(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const viewOf = (length, write) => {
    const bytes = new Uint8Array(length);
    write(new DataView(bytes.buffer));
    return bytes;
  };

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = file.data;
    const crc = crc32(data);
    const localHeader = viewOf(30, (view) => {
      view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x0800, true);
      view.setUint16(8, 0, true); view.setUint16(10, dosTime, true); view.setUint16(12, dosDate, true);
      view.setUint32(14, crc, true); view.setUint32(18, data.length, true); view.setUint32(22, data.length, true);
      view.setUint16(26, name.length, true); view.setUint16(28, 0, true);
    });
    localParts.push(localHeader, name, data);

    const centralHeader = viewOf(46, (view) => {
      view.setUint32(0, 0x02014b50, true); view.setUint16(4, 20, true); view.setUint16(6, 20, true);
      view.setUint16(8, 0x0800, true); view.setUint16(10, 0, true); view.setUint16(12, dosTime, true);
      view.setUint16(14, dosDate, true); view.setUint32(16, crc, true); view.setUint32(20, data.length, true);
      view.setUint32(24, data.length, true); view.setUint16(28, name.length, true); view.setUint16(30, 0, true);
      view.setUint16(32, 0, true); view.setUint16(34, 0, true); view.setUint32(36, 0, true);
      view.setUint32(42, localOffset, true);
    });
    centralParts.push(centralHeader, name);
    localOffset += localHeader.length + name.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = viewOf(22, (view) => {
    view.setUint32(0, 0x06054b50, true); view.setUint16(4, 0, true); view.setUint16(6, 0, true);
    view.setUint16(8, files.length, true); view.setUint16(10, files.length, true);
    view.setUint32(12, centralSize, true); view.setUint32(16, localOffset, true); view.setUint16(20, 0, true);
  });
  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
}

async function downloadAllChapters() {
  downloadButton.disabled = true;
  toolStatus.textContent = '正在整理章节…';
  const results = await Promise.all(Array.from({ length: 100 }, async (_, index) => {
    const chapter = index + 1;
    try {
      const response = await fetch(`1ch${chapter}.txt`);
      if (!response.ok) return null;
      const text = await response.text();
      if (!text.trim() || /^\s*<!doctype html/i.test(text)) return null;
      return { name: `1ch${chapter}.txt`, data: new TextEncoder().encode(text) };
    } catch { return null; }
  }));
  const files = results.filter(Boolean);
  if (!files.length) {
    toolStatus.textContent = '没有找到章节 TXT 文件';
    downloadButton.disabled = false;
    return;
  }
  const url = URL.createObjectURL(zipFiles(files));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'P4XT0N-小说章节.zip';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toolStatus.textContent = `已打包 ${files.length} 个章节文件`;
  downloadButton.disabled = false;
}

startButton.addEventListener('click', () => setReaderOpen(true));
closeButton.addEventListener('click', () => setReaderOpen(false));
toggleButton.addEventListener('click', toggleSidebar);
chapterListToggle.addEventListener('click', toggleChapterList);
downloadButton.addEventListener('click', downloadAllChapters);
autoScrollButton.addEventListener('click', () => setAutoScroll(!autoScrollFrame));
voiceButton.addEventListener('click', () => narrating ? stopNarration() : startNarration());
readerContent.addEventListener('scroll', () => {
  updateReadingProgress();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveProgress, 150);
}, { passive: true });
readerContent.addEventListener('contextmenu', (event) => event.preventDefault());
readerContent.addEventListener('copy', (event) => event.preventDefault());
readerContent.addEventListener('dragstart', (event) => event.preventDefault());
readerContent.addEventListener('selectstart', (event) => event.preventDefault());
nextChapterButton.addEventListener('click', () => {
  if (progress.chapter < 100) loadChapter(progress.chapter + 1, 0);
});

document.addEventListener('keydown', (event) => {
  if (!isOpen) return;
  if (event.key === 'Escape') {
    setReaderOpen(false);
    return;
  }
  if (readerContent.contains(event.target) && (event.ctrlKey || event.metaKey) && ['a', 'c', 's', 'p'].includes(event.key.toLowerCase())) {
    event.preventDefault();
    return;
  }
  if (event.target.closest('button, a, select, input, textarea')) return;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    readerContent.scrollBy({
      top: (event.key === 'ArrowDown' ? 1 : -1) * readerContent.clientHeight * 0.72,
      behavior: 'smooth',
    });
  }
});
