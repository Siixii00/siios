#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'js', 'db.js');
const OUTPUT_PATH = path.join(__dirname, 'test-twitter-content-output.json');

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
    },
    {
        name: '一般用戶',
        personality: '好奇的一般用戶，對各種事物都有興趣',
        background: '普通上班族'
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

async function fetchRSSFeed(url, limit = 5) {
    console.log(`[RSS] 正在抓取 ${url}...`);
    
    try {
        const response = await fetch(url);
        const text = await response.text();
        
        const items = [];
        const itemMatches = text.matchAll(/<item>([\s\S]*?)<\/item>/g);
        
        for (const match of itemMatches) {
            if (items.length >= limit) break;
            
            const itemText = match[1];
            
            const titleMatch = itemText.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
            const title = titleMatch ? (titleMatch[1] || titleMatch[2]) : '';
            
            const linkMatch = itemText.match(/<link>(.*?)<\/link>/);
            const link = linkMatch ? linkMatch[1] : '';
            
            const descMatch = itemText.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/);
            const description = descMatch ? (descMatch[1] || descMatch[2]) : '';
            
            if (title && link) {
                items.push({
                    title: title.trim(),
                    url: link.trim(),
                    description: description.trim().slice(0, 200)
                });
            }
        }
        
        console.log(`[RSS] 成功抓取 ${items.length} 則文章`);
        return items;
    } catch (error) {
        console.error('[RSS] 抓取失敗:', error);
        return [];
    }
}

function analyzeCharacterInterests(personality) {
    const categories = {
        '科技': ['工程師', '科技', '程式', '電腦', '技術', '開發', 'hacker', 'programmer', 'ai', '機器學習'],
        '藝術': ['藝術', '設計', '畫家', '音樂', '創作', '繪畫', 'artist', 'designer', 'musician'],
        '科學': ['科學', '研究', '學者', '實驗', '物理', '化學', '生物', 'scientist', 'researcher'],
        '新聞': ['記者', '新聞', '時事', '政治', '社會', '國際', 'journalist'],
        '遊戲': ['遊戲', '玩家', '動漫', '電影', 'gamer', 'anime', 'gaming'],
        '財經': ['商人', '財經', '投資', '創業', '老闆', 'business', 'investor', 'entrepreneur'],
        '文學': ['作家', '文學', '書', '閱讀', '詩人', 'writer', 'author', 'poet'],
        '美食': ['美食', '廚師', '料理', 'chef', 'foodie', 'cooking'],
        '運動': ['運動', '健身', '體育', '運動員', 'athlete', 'fitness', 'sports']
    };
    
    const personality_lower = personality.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
        if (keywords.some(keyword => personality_lower.includes(keyword.toLowerCase()))) {
            return category;
        }
    }
    
    return '綜合';
}

function selectContentSources(interestCategory) {
    const sources = {
        '科技': [
            { type: 'hackernews', name: 'Hacker News' },
            { type: 'rss', name: 'TechCrunch', url: 'https://techcrunch.com/feed/' }
        ],
        '藝術': [
            { type: 'rss', name: 'Creative Bloq', url: 'https://www.creativebloq.com/feed' }
        ],
        '科學': [
            { type: 'rss', name: 'Science Daily', url: 'https://www.sciencedaily.com/rss/all.xml' }
        ],
        '新聞': [
            { type: 'rss', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' }
        ],
        '遊戲': [
            { type: 'rss', name: 'Polygon', url: 'https://www.polygon.com/rss/index.xml' }
        ],
        '財經': [
            { type: 'rss', name: 'Forbes', url: 'https://www.forbes.com/real-time/feed2/' }
        ],
        '文學': [
            { type: 'rss', name: 'Book Riot', url: 'https://bookriot.com/feed/' }
        ],
        '美食': [
            { type: 'rss', name: 'Bon Appétit', url: 'https://www.bonappetit.com/feed/rss' }
        ],
        '運動': [
            { type: 'rss', name: 'ESPN', url: 'https://www.espn.com/espn/rss' }
        ],
        '綜合': [
            { type: 'hackernews', name: 'Hacker News' },
            { type: 'rss', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' }
        ]
    };
    
    return sources[interestCategory] || sources['綜合'];
}

async function fetchContentFromSource(source) {
    if (source.type === 'hackernews') {
        const stories = await fetchHackerNewsTopStories(5);
        return stories.map(story => ({
            title: story.title,
            url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
            author: story.by,
            score: story.score,
            source: 'Hacker News'
        }));
    } else if (source.type === 'rss') {
        const items = await fetchRSSFeed(source.url, 5);
        return items.map(item => ({
            title: item.title,
            url: item.url,
            description: item.description,
            source: source.name
        }));
    }
    
    return [];
}

async function generateTweetWithAI(content, character) {
    const prompt = `你是角色「${character.name}」，性格：${character.personality}

請將以下真實新聞/文章轉換為一條推特推文（140字以內），保持你的角色性格：

標題：${content.title}
${content.description ? `簡介：${content.description}` : ''}
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
    
    return `【測試推文】${character.name} 看了「${content.title}」後的想法...`;
}

async function runTest() {
    console.log('====================================');
    console.log('Twitter 真實內容來源原型測試');
    console.log('====================================\n');
    
    const testResults = [];
    
    for (const character of TEST_CHARACTERS) {
        console.log(`\n測試角色：${character.name}`);
        console.log(`性格：${character.personality}`);
        
        const interestCategory = analyzeCharacterInterests(character.personality);
        console.log(`興趣類別：${interestCategory}`);
        
        const sources = selectContentSources(interestCategory);
        console.log(`內容來源：${sources.map(s => s.name).join(', ')}`);
        
        const allContent = [];
        
        for (const source of sources) {
            console.log(`\n嘗試抓取 ${source.name}...`);
            const content = await fetchContentFromSource(source);
            allContent.push(...content);
        }
        
        if (allContent.length === 0) {
            console.log(`[警告] 未抓取到任何內容`);
            continue;
        }
        
        console.log(`\n總共抓取 ${allContent.length} 則內容`);
        
        const selectedContent = allContent.slice(0, 3);
        
        const tweets = [];
        for (const content of selectedContent) {
            const tweet = await generateTweetWithAI(content, character);
            tweets.push({
                originalContent: content,
                generatedTweet: tweet
            });
        }
        
        testResults.push({
            character: {
                name: character.name,
                personality: character.personality,
                interestCategory: interestCategory
            },
            sources: sources.map(s => s.name),
            contentCount: allContent.length,
            tweets: tweets
        });
    }
    
    const outputData = {
        timestamp: new Date().toISOString(),
        testResults: testResults
    };
    
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(outputData, null, 2));
    console.log(`\n====================================`);
    console.log(`測試完成！結果已儲存至：${OUTPUT_PATH}`);
    console.log(`====================================\n`);
    
    console.log('\n摘要：');
    testResults.forEach(result => {
        console.log(`\n角色：${result.character.name}`);
        console.log(`  類別：${result.character.interestCategory}`);
        console.log(`  來源：${result.sources.join(', ')}`);
        console.log(`  抓取：${result.contentCount} 則`);
        console.log(`  生成的推文：`);
        result.tweets.forEach((t, i) => {
            console.log(`    ${i + 1}. ${t.generatedTweet}`);
        });
    });
}

runTest().catch(console.error);
