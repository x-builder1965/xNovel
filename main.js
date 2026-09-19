const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const cheerio = require('cheerio');

let mainWindow;
let isFetchCancelled = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 中止指示用の通信リスナー
ipcMain.on('cancel-fetch-novel', () => {
    isFetchCancelled = true;
});

// 作品データ取得（API + 本文スクレイピング）
ipcMain.handle('fetch-novel', async (event, ncode) => {
    isFetchCancelled = false; // フラグの初期化
    const formattedNcode = ncode.toLowerCase().trim();

    // 1. なろうAPIから概要情報取得
    const apiUrl = `https://api.syosetu.com/novelapi/api/?out=json&ncode=${formattedNcode}`;
    const apiRes = await fetch(apiUrl, {
        headers: { 'User-Agent': 'xNovel-Downloader/1.0' }
    });

    if (!apiRes.ok) {
        throw new Error('APIからのデータ取得に失敗しました。');
    }

    const apiData = await apiRes.json();
    if (!apiData || apiData.length < 2) {
        throw new Error('該当するNコードの作品が見つかりません。');
    }

    const meta = apiData[1];
    const generalAllNo = meta.general_all_no; // 全話数
    const novelTitle = meta.title;

    // 中止チェック
    if (isFetchCancelled) {
        throw new Error('検索が中止されました。');
    }

    // 概要情報を取得できた段階でタイトルを通知
    event.sender.send('fetch-meta', {
        ncode: formattedNcode,
        title: novelTitle,
        total: generalAllNo
    });

    const items = [];

    // 概要の追加
    const overviewContent = `タイトル: ${novelTitle}\n作者名: ${meta.writer}\n話数: 全${generalAllNo}話\n\n【あらすじ】\n${meta.story}`;
    items.push({
        ncode: formattedNcode,
        type: 'overview',
        seqNo: 0,
        title: '概要',
        content: overviewContent
    });

    // 2. 各話の本文スクレイピング
    for (let i = 1; i <= generalAllNo; i++) {
        // サーバー負荷軽減のため1.2秒待機
        await sleep(1200);

        // ループ毎にキャンセルフラグをチェック
        if (isFetchCancelled) {
            throw new Error('検索が中止されました。');
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
            type: 'episode',
            seqNo: i,
            epNoStr: `第${i}話`,
            subtitle: epTitle,
            title: `第${i}話: ${epTitle}`,
            content: `${epTitle}\n\n${epBody}`
        });

        // 進捗をレンダラープロセスへ通知
        event.sender.send('fetch-progress', {
            ncode: formattedNcode,
            current: i,
            total: generalAllNo
        });
    }

    return {
        ncode: formattedNcode,
        title: novelTitle,
        items: items
    };
});

// テキストファイル群の保存処理
ipcMain.handle('save-files', async (event, { ncode, title, items }) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: '保存先フォルダを選択してください',
        properties: ['openDirectory', 'createDirectory']
    });

    if (canceled || filePaths.length === 0) {
        return { success: false, message: 'キャンセルされました。' };
    }

    const selectedBaseDir = filePaths[0];

    // Windows等でファイルシステム上使用できない文字をアンダースコアに置換
    const safeNcode = (ncode || '').replace(/[\\/:*?"<>|]/g, '_');
    const safeTitle = (title || '').replace(/[\\/:*?"<>|]/g, '_');

    // 作成するフォルダ名例：「n6006cw：連載中_転生したら剣でした」
    const dirName = `${safeNcode}：${safeTitle}`;
    const targetDir = path.join(selectedBaseDir, dirName);

    // フォルダが存在しない場合は作成（既に存在する場合はそのまま使用）
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const total = items.length;

    for (let i = 0; i < total; i++) {
        const item = items[i];
        const seqStr = String(item.seqNo).padStart(4, '0');
        let rawFilename = '';

        if (item.type === 'overview') {
            rawFilename = `${seqStr}_概要.txt`;
        } else {
            rawFilename = `${seqStr}_${item.epNoStr}_${item.subtitle}.txt`;
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
