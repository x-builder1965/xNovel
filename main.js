// -- main.js ----------------------------------------------------------
// copyright = 'Copyright © 2026- @x-builder, Japan';
// email     = 'x-builder@gmail.com';
// appName   = 'xNovel -小説家になろうダウンローダー- Ver1.08.0';
// ---------------------------------------------------------------------
// 🔲モジュールインポート定義🔲
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const cheerio = require('cheerio');
// 🔲イミディエイト定義🔲
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// 🔲グローバル変数🔲
let $;
let mainWindow;
let isFetchCancelled = false;

// 🔲windowイベントリスナー登録🔲
// アプリ初期処理（window作成）
registerAppWhenReady();
// window終了イベント
registerAppOnWindowAllClosed();
// 🔲個別イベントリスナー登録🔲
// 中止指示用の通信イベント
registerIpcMainOnCancelFetchNovel();
// 作品データ取得イベント（API + 本文スクレイピング）
registerIpcMainFetchNovel();
// テキストファイル群の保存処理
registerIpcMainSaveNovel();

// ユーザー起因のエラー（入力間違い・作品未存在・キャンセル等）を表すカスタムエラークラス
class UserError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UserError';
        this.isUserError = true;
    }
}

// 🔲windowイベントリスナー登録🔲
// アプリ初期処理
function registerAppWhenReady() {
    app.whenReady().then(createWindow);
}

// window終了イベント
function registerAppOnWindowAllClosed() {
    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });
}

// 🔲個別イベントリスナー登録🔲
// 中止指示用の通信イベント
function registerIpcMainOnCancelFetchNovel() {
    ipcMain.on('cancel-fetch-novel', () => {
        isFetchCancelled = true;
    });
}

// 作品データ取得イベント（API + 本文スクレイピング）
function registerIpcMainFetchNovel() {
    ipcMain.handle('fetch-novel', async (event, ncode) => {
        isFetchCancelled = false;
        const formattedNcode = ncode.toLowerCase().trim();

        const apiUrl = `https://api.syosetu.com/novelapi/api/?out=json&ncode=${formattedNcode}`;
        
        let apiRes;
        try {
            apiRes = await fetch(apiUrl, {
                headers: { 'User-Agent': 'xNovel-Downloader/1.0' }
            });
        } catch (err) {
            throw new Error(`API通信エラー: ${err.message}`);
        }

        if (!apiRes.ok) {
            throw new Error(`APIからのデータ取得に失敗しました。(HTTP ${apiRes.status})`);
        }

        const apiData = await apiRes.json();
        
        if (!apiData || apiData.length < 2) {
            throw new UserError('該当するNコードの作品が見つかりません。');
        }

        const meta = apiData[1];

        // Nコード不一致のチェック
        if (!meta.ncode || meta.ncode.toLowerCase() !== formattedNcode) {
            throw new UserError('該当するNコードの作品が見つかりません。');
        }

        const generalAllNo = meta.general_all_no;
        const novelTitle = meta.title;
        // noveltype: 1 = 連載, 2 = 短編
        const novelType = meta.novel_type;

        // なろうAPIの仕様 (end: 0 は完結済、1 は連載中、2 は短編)
        const novelStatus = (novelType === 1) ? (meta.end === 1 ? '連載中' : '完結済') : '短編';

        if (isFetchCancelled) {
            throw new UserError('検索が中止されました。');
        }

        // 概要情報を取得できた段階で通知
        event.sender.send('fetch-meta', {
            ncode: formattedNcode,
            title: novelTitle,
            status: novelStatus,
            total: generalAllNo
        });

        const items = [];

        // 概要の追加
        const overviewContent = `タイトル: ${novelTitle}\n作者名: ${meta.writer}\n連載状況: ${novelStatus}\n話数: 全${generalAllNo}話\n\n【あらすじ】\n${meta.story}`;
        items.push({
            ncode: formattedNcode,
            title: novelTitle,
            type: 'overview',
            seqNo: 0,
            subtitle: '概要',
            content: overviewContent
        });

        // 短編（noveltype === 2）または全1話で単一ページ構成の場合の処理
        const isSinglePage = novelType === 2 || generalAllNo === 1;

        if (isSinglePage) {
            await sleep(1200);

            if (isFetchCancelled) {
                throw new UserError('検索が中止されました。');
            }

            const episodeUrl = `https://ncode.syosetu.com/${formattedNcode}/`;
            const epRes = await fetch(episodeUrl, {
                headers: { 'User-Agent': 'xNovel-Downloader/1.0' }
            });

            if (epRes.ok) {
                const html = await epRes.text();
                $ = cheerio.load(html);

                const epTitle = $('.p-novel__title').text().trim() || novelTitle;
                const epBody = $('.js-novel-text').text().trim() || $('#novel_honbun').text().trim();

                items.push({
                    ncode: formattedNcode,
                    title: novelTitle,
                    type: 'episode',
                    seqNo: 1,
                    subtitle: epTitle,
                    content: `${epTitle}\n\n${epBody}`
                });

                event.sender.send('fetch-progress', {
                    ncode: formattedNcode,
                    current: 1,
                    total: 1
                });
            }
        } else {
            // 2話以上の連載作品のスクレイピング処理
            for (let i = 1; i <= generalAllNo; i++) {
                await sleep(1200);

                if (isFetchCancelled) {
                    throw new UserError('検索が中止されました。');
                }

                const episodeUrl = `https://ncode.syosetu.com/${formattedNcode}/${i}/`;
                const epRes = await fetch(episodeUrl, {
                    headers: { 'User-Agent': 'xNovel-Downloader/1.0' }
                });

                if (!epRes.ok) {
                    continue;
                }

                const html = await epRes.text();
                const $ = cheerio.load(html);

                const epTitle = $('.p-novel__title').text().trim() || `第${i}話`;
                const epBody = $('.js-novel-text').text().trim();

                items.push({
                    ncode: formattedNcode,
                    title: novelTitle,
                    type: 'episode',
                    seqNo: i,
                    subtitle: epTitle,
                    content: `${epTitle}\n\n${epBody}`
                });

                event.sender.send('fetch-progress', {
                    ncode: formattedNcode,
                    current: i,
                    total: generalAllNo
                });
            }
        }

        return {
            ncode: formattedNcode,
            title: novelTitle,
            status: novelStatus,
            items: items
        };
    });
}

// テキストファイル群の保存処理
function registerIpcMainSaveNovel() {
    ipcMain.handle('save-files', async (event, { ncode, title, status, items }) => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: '保存先フォルダを選択してください',
            properties: ['openDirectory', 'createDirectory']
        });

        if (canceled || filePaths.length === 0) {
            return { success: false, message: 'キャンセルされました。' };
        }

        const selectedBaseDir = filePaths[0];

        const safeNcode = (ncode || '').replace(/[\\/:*?"<>|]/g, '_');
        const safeStatus = (status || '').replace(/[\\/:*?"<>|]/g, '_');
        const safeTitle = (title || '').replace(/[\\/:*?"<>|]/g, '_');

        // ★ 指定フォーマットに変更：「[Nコード]＋"："＋[掲載状況]＋"_"＋[タイトル]」
        const dirName = `${safeNcode}：${safeStatus}_${safeTitle}`;
        const targetDir = path.join(selectedBaseDir, dirName);

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // --- 省略 (ファイル書き込み処理) ---
        const total = items.length;
        for (let i = 0; i < total; i++) {
            const item = items[i];
            const seqStr = String(item.seqNo).padStart(4, '0');
            let rawFilename = '';

            if (item.type === 'overview') {
                rawFilename = `${seqStr}_概要.txt`;
            } else {
                rawFilename = `${seqStr}_${item.subtitle}.txt`;
            }

            const safeFilename = rawFilename.replace(/[\\/:*?"<>|]/g, '_');
            const savePath = path.join(targetDir, safeFilename);

            fs.writeFileSync(savePath, item.content, 'utf8');

            // 保存進捗をレンダラーへ通知
            event.sender.send('save-progress', {
                current: i + 1,
                total: total
            });
        }

        return { success: true, count: total, dir: targetDir };
    });
}

// 🔲共通ヘルパー関数🔲
// window作成
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        title: 'xNovel -小説家になろうダウンローダー-',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        icon: path.join(__dirname, 'xNovel.ico'),
        autoHideMenuBar: true
    });
    mainWindow.loadFile('index.html');
}
