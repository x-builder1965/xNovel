// -- renderer.js ------------------------------------------------------
// copyright = 'Copyright © 2026- @x-builder, Japan';
// email     = 'x-builder@gmail.com';
// appName   = 'xNovel -小説家になろうダウンローダー- Ver1.06.0';
// ---------------------------------------------------------------------
// 🔲イミディエイト定義🔲
const RESIZE_HANDLE_WIDTH = 8; // 右端判定エリアの幅 (px)
// ショートカットキーと各ボタンのIDのマッピング定義
const shortcutMap = {
    'ctrl+t':           { control: 'themeToggle' },
    'ctrl+n':           { control: 'searchBtn' },
    'ctrl+s':           { control: 'saveBtn' },
    'ctrl+a':           { control: 'selectAllBtn' },
    'ctrl+r':           { control: 'deselectAllBtn' },
};
// 編集中無効にするショートカットキー定義
const disableKeyMap = new Set([
    'ctrl+c',
    'ctrl+x',
    'ctrl+v',
    'ctrl+z',
    'ctrl+y',
]);

// 🔲DOM定義🔲
let mainContainer = null;
let themeToggle = null;
let ncodeInput = null;
let statusDisplay = null;
let titleDisplay = null;
let searchBtn = null;
let saveBtn = null;
let statusMessage = null;
let textList = null;
let textViewer = null;
let selectAllBtn = null;
let deselectAllBtn = null;
let appTitle = null;
let verTitle = null;
let copyrightText = null;
let emailText = null;
let helpContainer = null;
let helpTableContainer = null;
let helpCloseBtn = null;
let helpTitle = null;
let changelogContainer = null;
let appConfigContainer = null;
let changelogContent = null;
let changelogCloseBtn = null;
let changelogTitle = null;
let sidebar = null;
let progressContainer = null;
let progressBar = null;

// 🔲グローバル変数定義🔲
let currentNovelData = null;
let isSearching = false;
let isResizing = false;
let isHoveringRightEdge = false;

document.addEventListener('DOMContentLoaded', async () => {
    // 🔲初期設定🔲
    try {
        // DOM取得
        await setupAllDomSettings();
        // HTMLロード
        await setupHTMLLoad();
        // 起動時にNコード入力欄にフォーカスをセット
        ncodeInput.focus();
    } catch (err) {
        console.error('初期化エラー:', err);
    }

    // 🔲windowイベントリスナー登録🔲
    // メタデータ取得完了の通知受け取り（status を追加）
    registerWindowApiOnMeta();
    // 進捗通知受け取り
    registerWindowApiOnProgress();
    // 保存進捗通知受け取り
    registerWindowApiOnSaveProgress();

    // 🔲documentイベントリスナー登録🔲
    // ドキュメントのキーダウンイベント
    registerDocumentKeydown();
    // ドラッグ中の処理 (ドキュメント全体で移動を監視)
    registerDocumentMousemove();
    // マウスアップでドラッグ終了
    registerDocumentMouseup();

    // 🔲個別イベントリスナー登録🔲
    // ☀️／🌙ダークモード切替（トグルボタン）
    registerThemeToggleClick();
    // Nコード入力欄でEnterキーが押された時に検索を実行
    registerNcodeInputKeydown();
    // サイドバーの右端ドラッグによる幅サイズ変更機能
    registerSidebarMousemove();
    // サイドバーのマウスリーヴイベント
    registerSidebarMouseleave();
    // サイドバーのマウスダウンイベント
    registerSidebarMousedown();
    // 全選択ボタンクリック
    registerSelectAllBtnClick();
    // 全解除ボタンクリック
    registerDeselectAllBtnClick();
    // 🔎検索・中止ボタンクリックハンドラ
    registerSearchBtnClick();
    // 💾保存処理（チェックONのアイテムのみ保存対象にする）
    registerSaveBtnClick();
    // アプリタイトルのクリックイベント
    registerAppTitleClick();
    // バージョンのクリックイベント
    registerVerTitleClick();
    // ❌ヘルプのクローズのクリックイベント
    registerHelpCloseBtnClick();
    // ❌変更履歴のクローズのクリックイベント
    registerChangelogCloseBtnClick();
});

// 🔲初期設定関数🔲
// DOM取得
async function setupAllDomSettings() {
    mainContainer = document.querySelector('.main-container');
    themeToggle = document.getElementById('themeToggle');
    ncodeInput = document.getElementById('ncodeInput');
    statusDisplay = document.getElementById('statusDisplay'); // 追加
    titleDisplay = document.getElementById('titleDisplay');
    searchBtn = document.getElementById('searchBtn');
    saveBtn = document.getElementById('saveBtn');
    statusMessage = document.getElementById('statusMessage');
    textList = document.getElementById('textList');
    textViewer = document.getElementById('textViewer');
    selectAllBtn = document.getElementById('selectAllBtn');
    deselectAllBtn = document.getElementById('deselectAllBtn');
    appTitle = document.querySelector('.app-title');
    verTitle = document.querySelector('.ver-title');
    copyrightText = document.querySelector('.copyright-text');
    emailText = document.querySelector('.email-text');
    helpContainer = document.querySelector('.help-container');
    helpTableContainer = document.getElementById('helpTableContainer');
    helpCloseBtn = document.getElementById('helpCloseBtn');
    helpTitle = helpContainer?.querySelector('h1');
    changelogContainer = document.querySelector('.changelog-container');
    appConfigContainer = document.getElementById('appConfigContainer');
    changelogContent = document.getElementById('changelogContent');
    changelogCloseBtn = document.getElementById('changelogCloseBtn');
    changelogTitle = changelogContainer?.querySelector('h1');
    sidebar = document.querySelector('.sidebar');
    progressContainer = document.getElementById('progressContainer');
    progressBar = document.getElementById('progressBar');
}

// HTMLロード
async function setupHTMLLoad() {
    // 初期化処理 (HTML読み込み & 設定値反映)
    try {
        // [処理1] index_helpTable.html の読み込みと流し込み
        const helpRes = await fetch('index_helpTable.html');
        if (helpRes.ok) {
            const helpHtmlText = await helpRes.text();
            // 取得したHTMLをhelpTableContainerへ挿入
            if (helpTableContainer) {
                helpTableContainer.innerHTML = helpHtmlText;
            }
        }

        // [処理2] index_changelog.html の読み込みと流し込み
        const changelogRes = await fetch('index_changelog.html');
        if (changelogRes.ok) {
            const changelogHtmlText = await changelogRes.text();
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = changelogHtmlText;

            // appConfig を appConfigContainer に差し込む
            const appConfigEl = tempDiv.querySelector('#appConfig');
            if (appConfigEl && appConfigContainer) {
                appConfigContainer.appendChild(appConfigEl);
            }

            // changelog-list を changelogContent に差し込む
            const changelogListEl = tempDiv.querySelector('.changelog-list');
            if (changelogListEl && changelogContent) {
                changelogContent.appendChild(changelogListEl);
            }
        }

        // [処理3] appConfig の読み込みと画面への反映
        const appConfig = document.getElementById('appConfig');
        if (appConfig) {
            // dataset 経由で data-* 属性の値を取得
            const appName = appConfig.dataset.appName || '';
            const version = appConfig.dataset.version || '';

            // 設定１: タイトル部分の設定 (アイコン画像 + appName, verTitle)
            if (appTitle) {
                appTitle.innerHTML = `
                    <img src="xNovel.ico" alt="xNovel Icon" class="title-icon">
                    ${appName}
                `;
            }
            if (verTitle) {
                verTitle.textContent = `${version}`;
            }

            // 設定２: ヘルプ画面の <h1> 設定 (appName + ' ' + version)
            if (helpTitle) {
                helpTitle.textContent = `${appName} ${version} ヘルプ`;
            }

            // 設定３: 変更履歴画面の <h1> 設定 (appName + ' ' + version)
            if (changelogTitle) {
                changelogTitle.textContent = `${appName} ${version} 変更履歴`;
            }

            // dataset 経由で data-* 属性の値を取得
            if (copyrightText) copyrightText.textContent = appConfig.dataset.copyright || '';
            if (emailText) emailText.textContent = appConfig.dataset.email || '';
        }
    } catch (error) {
        console.error('初期化データの読み込みに失敗しました:', error);
    }
}

// 🔲windowイベントリスナー登録🔲
// メタデータ取得完了の通知受け取り（status を追加）
function registerWindowApiOnMeta() {
    window.api.onMeta(({ title, status, total }) => {
        statusDisplay.textContent = status; // 連載状況を表示
        titleDisplay.textContent = title;
        statusMessage.textContent = `「${title}」の概要を取得しました。本文を取得中... (0 / ${total} 話)`;
        progressBar.max = total;
    });
}

// 進捗通知受け取り
function registerWindowApiOnProgress() {
    window.api.onProgress(({ current, total }) => {
        statusMessage.textContent = `本文を取得中... (${current} / ${total} 話)`;
        progressBar.value = current;
    });
}

// 保存進捗通知受け取り
function registerWindowApiOnSaveProgress() {
    window.api.onSaveProgress(({ current, total }) => {
        statusMessage.textContent = `ファイルを保存中... (${current} / ${total} 件)`;
        progressBar.value = current;
    });
}

// 🔲documentイベントリスナー登録🔲
// ドキュメントのキーダウンイベント
function registerDocumentKeydown() {
    document.addEventListener('keydown', (e) => {
        // 押された修飾キーとメインキーを組み合わせてキー文字列を作成
        const modifiers = [];
        
        // Ctrlキー または MacのCommandキー
        if (e.ctrlKey || e.metaKey) modifiers.push('ctrl');
        if (e.shiftKey) modifiers.push('shift');
        if (e.altKey) modifiers.push('alt');
    
        const mainKey = e.key.toLowerCase();
    
        // 修飾キー自体が押されただけの時は処理しない
        if (['control', 'shift', 'alt', 'meta'].includes(mainKey)) {
            return;
        }
    
        modifiers.push(mainKey);
    
        // 'ctrl+ ' のような文字列を生成 (スペースキーは ' ')
        const shortcutKey = modifiers.join('+');
    
        // textInput（あるいは入力エリア全般）のフォーカス判定
        const activeEl = document.activeElement;
        const isEditing = activeEl && (
            activeEl.id === 'textInput' || 
            activeEl.tagName === 'INPUT' || 
            activeEl.tagName === 'TEXTAREA' || 
            activeEl.isContentEditable
        );

        // 編集中かつ無効化対象のショートカットキーの場合は処理をスキップ
        if (isEditing && disableKeyMap.has(shortcutKey)) {
            return;
        }

        // マッピングの取得
        const shortcutConfig = shortcutMap[shortcutKey];
    
        // マッピングが存在するか確認
        if (shortcutConfig) {
            // コントロール名（ボタンID）の取得と実行
            const btn = document.getElementById(shortcutConfig.control);
            if (btn) {
                e.preventDefault(); // スペース入力やブラウザ標準動作のキャンセル
                btn.click();        // ボタンクリックを実行
            }
        }
    });
}

// ドラッグ中の処理 (ドキュメント全体で移動を監視)
function registerDocumentMousemove() {
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const rect = sidebar.getBoundingClientRect();
        const newWidth = e.clientX - rect.left;

        // 最小幅（150px）と最大幅（画面の80%）の制限
        if (newWidth >= 150 && newWidth <= window.innerWidth * 0.8) {
            sidebar.style.width = `${newWidth}px`;
        }
    });
}

// マウスアップでドラッグ終了
function registerDocumentMouseup() {
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            sidebar.style.cursor = '';
        }
    });
}

// 🔲個別イベントリスナー登録🔲
// Nコード入力欄でEnterキーが押された時に検索を実行
function registerNcodeInputKeydown() {
    ncodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) {
            e.preventDefault();
            searchBtn.click();
        }
    });
}

// サイドバーの右端ドラッグによる幅サイズ変更機能
function registerSidebarMousemove() {
    sidebar.addEventListener('mousemove', (e) => {
        if (isResizing) return;

        const rect = sidebar.getBoundingClientRect();
        // マウス位置がサイドバーの右端付近にあるかチェック
        if (e.clientX >= rect.right - RESIZE_HANDLE_WIDTH && e.clientX <= rect.right) {
            sidebar.style.cursor = 'ew-resize';
            isHoveringRightEdge = true;
        } else {
            sidebar.style.cursor = '';
            isHoveringRightEdge = false;
        }
    });
}

// リストサイドのマウスリーヴイベント
function registerSidebarMouseleave() {
    sidebar.addEventListener('mouseleave', () => {
        if (!isResizing) {
            sidebar.style.cursor = '';
            isHoveringRightEdge = false;
        }
    });
}

// リストサイドのマウスダウンイベント
function registerSidebarMousedown() {
    sidebar.addEventListener('mousedown', (e) => {
        // 右端ホバー時のマウスダウンでドラッグ開始
        if (isHoveringRightEdge) {
            isResizing = true;
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none'; // ドラッグ中のテキスト選択を防止
            e.preventDefault();
        }
    });
}

// ダークモード切替（トグルボタン）
function registerThemeToggleClick() {
    themeToggle.addEventListener('click', () => {
        const isDarkMode = document.body.classList.contains('dark-mode');

        if (isDarkMode) {
            document.body.classList.remove('dark-mode');
            document.body.classList.add('light-mode');
            themeToggle.textContent = '🌙';
        } else {
            document.body.classList.remove('light-mode');
            document.body.classList.add('dark-mode');
            themeToggle.textContent = '☀️';
        }
    });
}

// 全選択ボタンクリック
function registerSelectAllBtnClick() {
    selectAllBtn.addEventListener('click', () => {
        const checkboxes = textList.querySelectorAll('.item-checkbox');
        checkboxes.forEach((cb) => {
            cb.checked = true;
        });
    });
}

// 全解除ボタンクリック
function registerDeselectAllBtnClick() {
    deselectAllBtn.addEventListener('click', () => {
        const checkboxes = textList.querySelectorAll('.item-checkbox');
        checkboxes.forEach((cb) => {
            cb.checked = false;
        });
    });
}

// 検索・中止ボタンクリックハンドラ
function registerSearchBtnClick() {
    searchBtn.addEventListener('click', async () => {
        if (isSearching) {
            window.api.cancelFetchNovel();
            statusMessage.textContent = '検索を中止しています...';
            saveBtn.disabled = true;
            statusDisplay.textContent = '';
            titleDisplay.textContent = '';
            textList.innerHTML = '';
            textViewer.value = '';
            return;
        }
    
        const rawNcode = ncodeInput.value.trim();
        if (!rawNcode) {
            showToast('Nコードを入力してください。');
            ncodeInput.focus();
            return;
        }
    
        const ncode = rawNcode.toLowerCase();
        ncodeInput.value = ncode;
    
        isSearching = true;
        searchBtn.textContent = '🔎';
        searchBtn.classList.add('cancel-mode');
        
        saveBtn.disabled = true;
        statusDisplay.textContent = '';
        titleDisplay.textContent = '';
        textList.innerHTML = '';
        textViewer.value = '';
        statusMessage.textContent = '作品概要を取得中...';
    
        showProgressBar('searching');
    
        try {
            currentNovelData = await window.api.fetchNovel(ncode);
            
            statusMessage.textContent = `「${currentNovelData.title}」の全データ取得完了 (${currentNovelData.items.length - 1}話 + 概要)`;
    
            // リスト描画（チェックボックス追加）
            let i = 0;
            currentNovelData.items.forEach((item, index) => {
                const seqStr = String(i).padStart(4, '0');
                const li = document.createElement('li');
    
                // チェックボックス作成
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'item-checkbox';
                checkbox.checked = true; // 初期状態はチェックON
                // データ参照用インデックスまたは識別IDを保持
                checkbox.dataset.index = index;
    
                // チェックボックスクリック時にliへのイベント伝播（選択切り替え）を止める
                checkbox.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
    
                // ラベル作成
                const label = document.createElement('span');
                label.textContent = `${seqStr}_${item.title}`;
    
                li.appendChild(checkbox);
                li.appendChild(label);
    
                // リストクリックでビューア表示
                li.addEventListener('click', () => {
                    document.querySelectorAll('#textList li').forEach((el) => el.classList.remove('selected'));
                    li.classList.add('selected');
                    textViewer.value = item.content;
                });
    
                textList.appendChild(li);
                i++;
            });
    
            if (textList.firstChild) {
                textList.firstChild.click();
            }
    
            saveBtn.disabled = false;
        } catch (error) {
            statusMessage.textContent = error.message;
            if (error.message !== '検索が中止されました。') {
                showToast(`エラー: ${error.message}`);
            }
        } finally {
            isSearching = false;
            searchBtn.textContent = '🔎';
            searchBtn.classList.remove('cancel-mode');
            searchBtn.disabled = false;
            hideProgressBar();
        }
    });
}

// 保存処理（チェックONのアイテムのみ保存対象にする）
function registerSaveBtnClick() {
    saveBtn.addEventListener('click', async () => {
        if (!currentNovelData || !currentNovelData.items.length) {
            return;
        }
    
        // チェックされている項目のインデックスを抽出
        const checkedBoxes = Array.from(textList.querySelectorAll('.item-checkbox:checked'));
        if (checkedBoxes.length === 0) {
            showToast('保存対象の項目が選択されていません。');
            return;
        }
    
        // チェックがついているアイテムのみフィルタリング
        const selectedItems = checkedBoxes.map((cb) => {
            const index = parseInt(cb.dataset.index, 10);
            return currentNovelData.items[index];
        });
    
        try {
            const result = await window.api.saveFiles({
                ncode: currentNovelData.ncode,
                status: currentNovelData.status,
                title: currentNovelData.title,
                items: selectedItems // チェックが入ったアイテムのみ渡す
            });
    
            if (result.success) {
                showToast(`${result.count}個のテキストファイルを保存しました。\n保存先: ${result.dir}`);
            }
        } catch (error) {
            showToast(`保存エラー: ${error.message}`);
        } finally {
            hideProgressBar();
        }
    });
}

// アプリタイトルのクリックイベント
function registerAppTitleClick() {
    appTitle?.addEventListener('click', () => {
        if (mainContainer) mainContainer.style.display = 'none';
        if (changelogContainer) changelogContainer.style.display = 'none';
        if (helpContainer) helpContainer.style.display = 'flex';
    });
}

// バージョンのクリックイベント
function registerVerTitleClick() {
    verTitle?.addEventListener('click', () => {
        if (mainContainer) mainContainer.style.display = 'none';
        if (helpContainer) helpContainer.style.display = 'none';
        if (changelogContainer) changelogContainer.style.display = 'flex';
    });
}

// ❌ヘルプのクローズのクリックイベント
function registerHelpCloseBtnClick() {
    helpCloseBtn?.addEventListener('click', () => {
        if (mainContainer) mainContainer.style.display = 'flex';
        if (helpContainer) helpContainer.style.display = 'none';
    });
}

// ❌変更履歴のクローズのクリックイベント
function registerChangelogCloseBtnClick() {
    changelogCloseBtn?.addEventListener('click', () => {
        if (mainContainer) mainContainer.style.display = 'flex';
        if (changelogContainer) changelogContainer.style.display = 'none';
    });
}

// トーストメッセージ表示機能（上部中央・6000ms・ホバー時一時停止対応）
function showToast(message) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;

    let duration = 6000;
    let startTime = null;
    let timerId = null;
    let isDismissed = false;

    // トースト破棄処理
    const dismiss = () => {
        if (isDismissed) return;
        isDismissed = true;
    
        if (timerId) {
            clearTimeout(timerId);
            timerId = null;
        }
    
        toast.classList.add('hide');
    
        const removeElement = () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        };
    
        toast.addEventListener('transitionend', removeElement, { once: true });
        setTimeout(removeElement, 350);
    };

    // タイマー開始/再開
    const startTimer = () => {
        if (isDismissed || duration <= 0) return;
        startTime = Date.now();
        timerId = setTimeout(() => {
            dismiss();
        }, duration);
    };

    // タイマー一時停止
    const pauseTimer = () => {
        if (timerId) {
            clearTimeout(timerId);
            timerId = null;
            duration -= (Date.now() - startTime);
        }
    };

    // イベントリスナー設定
    toast.addEventListener('click', (e) => {
        e.stopPropagation();
        dismiss();
    });

    toast.addEventListener('mouseenter', () => {
        pauseTimer();
    });

    toast.addEventListener('mouseleave', () => {
        if (duration > 0) {
            startTimer();
        } else {
            dismiss();
        }
    });

    container.appendChild(toast);
    startTimer();
}

// 進捗バー制御ヘルパー関数
function showProgressBar(mode, max = 100) {
    progressContainer.classList.remove('hidden');
    progressBar.classList.remove('searching', 'saving');
    progressBar.classList.add(mode);
    progressBar.value = 0;
    progressBar.max = max;
}

function hideProgressBar() {
    progressContainer.classList.add('hidden');
    progressBar.value = 0;
}
