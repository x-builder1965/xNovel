document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('themeToggle');
    const ncodeInput = document.getElementById('ncodeInput');
    const titleDisplay = document.getElementById('titleDisplay');
    const searchBtn = document.getElementById('searchBtn');
    const saveBtn = document.getElementById('saveBtn');
    const statusMessage = document.getElementById('statusMessage');
    const textList = document.getElementById('textList');
    const textViewer = document.getElementById('textViewer');

    // ★ サイドバー要素を取得
    const sidebar = document.querySelector('.sidebar');

    // 進捗バー要素
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');

    let currentNovelData = null;
    let isSearching = false;

    // ★ リスト幅サイズ変更（リサイズ）用変数
    let isResizing = false;
    let isHoveringRightEdge = false;
    const RESIZE_HANDLE_WIDTH = 8; // 右端判定エリアの幅 (px)

    // ★ 起動時にNコード入力欄にフォーカスをセット
    ncodeInput.focus();

    // ★ Nコード入力欄でEnterキーが押された時に検索を実行
    ncodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) {
            e.preventDefault();
            searchBtn.click();
        }
    });

    // ★ サイドバーの右端ドラッグによる幅サイズ変更機能
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

    sidebar.addEventListener('mouseleave', () => {
        if (!isResizing) {
            sidebar.style.cursor = '';
            isHoveringRightEdge = false;
        }
    });

    sidebar.addEventListener('mousedown', (e) => {
        // 右端ホバー時のマウスダウンでドラッグ開始
        if (isHoveringRightEdge) {
            isResizing = true;
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none'; // ドラッグ中のテキスト選択を防止
            e.preventDefault();
        }
    });

    // ドラッグ中の処理 (ドキュメント全体で移動を監視)
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const rect = sidebar.getBoundingClientRect();
        const newWidth = e.clientX - rect.left;

        // 最小幅（150px）と最大幅（画面の80%）の制限
        if (newWidth >= 150 && newWidth <= window.innerWidth * 0.8) {
            sidebar.style.width = `${newWidth}px`;
        }
    });

    // マウスアップでドラッグ終了
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            sidebar.style.cursor = '';
        }
    });

    // ★ トーストメッセージ表示機能（上部中央・6000ms・ホバー時一時停止対応）
    const showToast = (message) => {
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
    };

    // 進捗バー制御ヘルパー関数
    const showProgressBar = (mode, max = 100) => {
        progressContainer.classList.remove('hidden');
        progressBar.classList.remove('searching', 'saving');
        progressBar.classList.add(mode);
        progressBar.value = 0;
        progressBar.max = max;
    };

    const hideProgressBar = () => {
        progressContainer.classList.add('hidden');
        progressBar.value = 0;
    };

    // ダークモード切替（トグルボタン）
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

    // メタデータ取得完了の通知受け取り
    window.api.onMeta(({ title, total }) => {
        titleDisplay.textContent = title;
        statusMessage.textContent = `「${title}」の概要を取得しました。本文を取得中... (0 / ${total} 話)`;
        progressBar.max = total;
    });

    // 進捗通知受け取り
    window.api.onProgress(({ current, total }) => {
        statusMessage.textContent = `本文を取得中... (${current} / ${total} 話)`;
        progressBar.value = current;
    });

    // 保存進捗通知受け取り
    window.api.onSaveProgress(({ current, total }) => {
        statusMessage.textContent = `ファイルを保存中... (${current} / ${total} 件)`;
        progressBar.value = current;
    });

    // 検索・中止ボタンクリックハンドラ
    searchBtn.addEventListener('click', async () => {
        if (isSearching) {
            window.api.cancelFetchNovel();
            statusMessage.textContent = '検索を中止しています...';
            searchBtn.disabled = true;
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
        titleDisplay.textContent = '';
        textList.innerHTML = '';
        textViewer.value = '';
        statusMessage.textContent = '作品概要を取得中...';

        showProgressBar('searching');

        try {
            currentNovelData = await window.api.fetchNovel(ncode);
            
            statusMessage.textContent = `「${currentNovelData.title}」の全データ取得完了 (${currentNovelData.items.length - 1}話 + 概要)`;

            // リスト描画
            currentNovelData.items.forEach((item) => {
                const li = document.createElement('li');
                li.textContent = item.title;
                li.addEventListener('click', () => {
                    document.querySelectorAll('#textList li').forEach((el) => el.classList.remove('selected'));
                    li.classList.add('selected');
                    textViewer.value = item.content;
                });
                textList.appendChild(li);
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

    // 保存処理
    saveBtn.addEventListener('click', async () => {
        if (!currentNovelData || !currentNovelData.items.length) {
            return;
        }
    
        try {
            const result = await window.api.saveFiles({
                ncode: currentNovelData.ncode, // ★ ncode を追加して渡す
                title: currentNovelData.title,
                items: currentNovelData.items
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
});
