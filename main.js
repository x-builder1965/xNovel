// -- main.js ----------------------------------------------------------
// copyright = 'Copyright © 2026- @x-builder, Japan';
// email     = 'x-builder@gmail.com';
// appName   = 'xNovel -小説家になろうダウンローダー- Ver1.03.0';
// ---------------------------------------------------------------------
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
    isFetchCancelled = false;
    const formattedNcode = ncode.toLowerCase().trim();

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
    const generalAllNo = meta.general_all_no;
    const novelTitle = meta.title;
    // noveltype: 1 = 連載, 2 = 短編
    const novelType = meta.novel_type;

    // なろうAPIの仕様 (end: 0 は完結済、1 は連載中、2 は短編)
    const novelStatus = (novelType === 1) ? (meta.end === 1) ? '連載中' : '完結済' : '短編';

    if (isFetchCancelled) {
        throw new Error('検索が中止されました。');
    }

    // 概要情報を取得できた段階で連載状況(status)を含めて通知
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
        type: 'overview',
        seqNo: 0,
        title: '概要',
        content: overviewContent
    });

    // 短編（noveltype === 2）または全1話で単一ページ構成の場合の処理
    const isSinglePage = novelType === 2 || generalAllNo === 1;

    if (isSinglePage) {
        await sleep(1200);

        if (isFetchCancelled) {
            throw new Error('検索が中止されました。');
        }

        // 短編・単話作品は /1/ ではなく Nコード直下のURL
        const episodeUrl = `https://ncode.syosetu.com/${formattedNcode}/`;
        const epRes = await fetch(episodeUrl, {
            headers: { 'User-Agent': 'xNovel-Downloader/1.0' }
        });

        if (epRes.ok) {
            const html = await epRes.text();
            const $ = cheerio.load(html);

            // 短編・全1話用のタイトル・本文抽出セレクタ対応
            const epTitle = $('.p-novel__title').text().trim() || novelTitle;
            const epBody = $('.js-novel-text').text().trim() || $('#novel_honbun').text().trim();

            items.push({
                ncode: formattedNcode,
                type: 'episode',
                seqNo: 1,
                epNoStr: '本文',
                subtitle: epTitle,
                title: epTitle,
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

// テキストファイル群の保存処理
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
