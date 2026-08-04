#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', 'kilo.json');

async function loadSettings() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
            return {
                api_url: config.api_url || '',
                api_key: config.api_key || '',
                model: config.model || 'gpt-3.5-turbo'
            };
        }
    } catch (error) {
        console.warn('[Config] 無法載入設定檔:', error.message);
    }
    
    return {
        api_url: process.env.API_URL || '',
        api_key: process.env.API_KEY || '',
        model: process.env.MODEL || 'gpt-3.5-turbo'
    };
}

const TEST_CHARACTERS = [
    {
        name: '工程師小明',
        personality: '熱愛科技的工程師，喜歡研究新技術和程式開發',
        background: '軟體工程師，專精 AI 和機器學習'
    },
    {
        name: '藝術家小美',
        personality: '藝術家，喜歡繪畫、音樂和所有美的事物',
        background: '自由創作者，經營自己的藝術工作室'
    }
];

async function fetchHackerNewsTopStories(limit = 5) {
    console.log('[Hacker News] 正在抓取熱門故事...');
    
    try {
        const storyIdsResponse = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
        const storyIds = await storyIdsResponse.json();
        
        const topStoryIds = storyIds.slice(0, limit);
        
        const stories = await Promise.all(
            topStoryIds.map(async (id) => {
                const response = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
                return await response.json();
            })
        );
        
        console.log(`[Hacker News] 成功抓取 ${stories.length} 則故事`);
        return stories;
    } catch (error) {
        console.error('[Hacker News] 抓取失敗:', error);
        return [];
    }
}

function analyzeCharacterInterests(personality) {
    const categories = {
        '科技': ['工程師', '科技', '程式', '電腦', '技術', '開發', 'hacker', 'programmer', 'ai', '機器學習'],
        '藝術': ['藝術', '設計', '畫家', '音樂', '創作', '繪畫', 'artist', 'designer', 'musician']
    };
    
    const personality_lower = personality.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
        if (keywords.some(keyword => personality_lower.includes(keyword.toLowerCase()))) {
            return category;
        }
    }
    
    return '綜合';
}

async function generateTweetWithAI(content, character, settings) {
    const prompt = `你是角色「${character.name}」，性格：${character.personality}

請將以下真實新聞/文章轉換為一條推特推文（140字以內），保持你的角色性格：

標題：${content.title}
來源：${content.source}

要求：
1. 用你的口吻和語氣表達
2. 可以加入你的看法或情感
3. 符合你的性格特點
4. 自然、真實、有趣
5. 台灣繁體中文

直接輸出推文內容（不要加引號或其他符號）：`;

    console.log(`\n[AI] 正在為 ${character.name} 生成推文...`);
    console.log(`[AI] 原文：${content.title}`);
    
    if (!settings.api_url || !settings.api_key) {
        console.log('[AI] 未設定 API，使用模擬推文');
        return `剛看到一篇關於「${content.title.slice(0, 30)}」的文章，滿有意思的！`;
    }
    
    try {
        const response = await fetch(`${settings.api_url}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.api_key}`
            },
            body: JSON.stringify({
                model: settings.model,
                messages: [{ role: 'system', content: prompt }],
                temperature: 0.8,
                max_tokens: 150
            })
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        const tweet = data.choices?.[0]?.message?.content?.trim() || '';
        
        console.log(`[AI] 生成成功：${tweet}`);
        return tweet;
    } catch (error) {
        console.error('[AI] 生成失敗:', error.message);
        return `【關於 ${content.title}】這個話題讓我想到...`;
    }
}

async function runTest() {
    console.log('====================================');
    console.log('Twitter 真實內容 + AI 轉換測試');
    console.log('====================================\n');
    
    const settings = await loadSettings();
    console.log('[設定] API URL:', settings.api_url || '(未設定)');
    console.log('[設定] Model:', settings.model);
    
    if (!settings.api_url || !settings.api_key) {
        console.log('\n[警告] 未設定 API，將使用模擬推文');
        console.log('[提示] 請在 kilo.json 中設定 api_url 和 api_key，或設定環境變數 API_URL 和 API_KEY\n');
    }
    
    const stories = await fetchHackerNewsTopStories(3);
    
    if (stories.length === 0) {
        console.log('[錯誤] 無法抓取任何內容');
        return;
    }
    
    console.log('\n====================================');
    console.log('開始生成推文');
    console.log('====================================');
    
    for (const character of TEST_CHARACTERS) {
        console.log(`\n角色：${character.name} (${character.personality.slice(0, 20)}...)`);
        console.log(`興趣類別：${analyzeCharacterInterests(character.personality)}`);
        
        const selectedStory = stories[Math.floor(Math.random() * stories.length)];
        
        const tweet = await generateTweetWithAI(
            {
                title: selectedStory.title,
                source: 'Hacker News',
                url: selectedStory.url
            },
            character,
            settings
        );
        
        console.log(`\n生成的推文：`);
        console.log(`  "${tweet}"`);
        console.log(`\n來源：${selectedStory.title}`);
        console.log(`  ${selectedStory.url || `https://news.ycombinator.com/item?id=${selectedStory.id}`}`);
    }
    
    console.log('\n====================================');
    console.log('測試完成！');
    console.log('====================================');
}

runTest().catch(console.error);
