import * as vscode from 'vscode';
import * as puppeteer from 'puppeteer';

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('engdict.search', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('텍스트 편집기가 활성화되어 있지 않습니다.');
            return;
        }

        const selection = editor.selection;
        let word = editor.document.getText(selection).trim();
        if (!word) {
            // 커서 위치의 단어 가져오기
            const position = selection.active;
            const wordRange = editor.document.getWordRangeAtPosition(position);
            if (wordRange) {
                word = editor.document.getText(wordRange).trim();
            }
        }

        if (!word) {
            vscode.window.showInformationMessage('검색할 단어를 선택하거나 커서를 단어 위에 놓으세요.');
            return;
        }

        try {
            // Puppeteer로 네이버 영어사전 크롤링
            const browser = await puppeteer.launch({ args: ['--no-sandbox'], headless: true });
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36');
            await page.goto(`https://en.dict.naver.com/#/search?query=${encodeURIComponent(word)}`);

            // 'ul.mean_list' 요소가 렌더링될 때까지 최대 10초 대기
            await page.waitForSelector('ul.mean_list', { timeout: 10000 });

            // 뜻(p.mean) 요소 추출
            const meanings = await page.$$eval('ul.mean_list li.mean_item p.mean', elements => {
                return elements.map(el => {
                    let text = el.textContent?.trim() || '';
                    // 품사 제거: 첫 단어 제거
                    text = text.replace(/^\S+\s+/, '');
                    // 괄호 안 내용 제거 (중첩 괄호 포함)
                    while (/\([^()]*\)/.test(text)) {
                        text = text.replace(/\([^()]*\)/g, '');
                    }
                    // 잔여 괄호 제거
                    text = text.replace(/[()]/g, '').trim();
                    return text;
                }).filter(t => t.length > 0).slice(0, 3);
            });

            await browser.close();

            if (meanings.length > 0) {
                vscode.window.showInformationMessage(`'${word}'의 뜻: ${meanings.join('  /  ')}`);
            } else {
                vscode.window.showInformationMessage(`'${word}'에 대한 뜻을 찾을 수 없습니다.`);
            }
        } catch (error: any) {
            vscode.window.showInformationMessage(`크롤링 중 오류 발생: ${error.message || error}`);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
