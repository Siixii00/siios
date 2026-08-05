#!/usr/bin/env python3
"""
Twitter Content Fetcher
抓取真實內容來源並快取，供 Twitter app 使用
"""

import json
import requests
import xml.etree.ElementTree as ET
from datetime import datetime
import os
import re
from typing import List, Dict

BLOCKED_KEYWORDS = [
    'racist', 'racism', 'sexist', 'sexism', 
    'nazi', 'hitler', 'holocaust',
    'terrorist', 'terrorism', 'isis',
    'pedophile', 'pedophilia',
    'suicide', 'kill yourself',
    'hate speech', 'discrimination',
    'kkk', 'white supremacy',
    'genocide', 'ethnic cleansing',
    '人身攻擊', '仇恨言論', '種族歧視',
    '性別歧視', '暴力', '恐怖主義',
    '納粹', '種族滅絕'
]

SENSITIVE_POLITICS = [
    'election fraud', 'rigged election',
    'conspiracy theory', 'deep state',
    'qanon', 'pizzagate',
    'antifa', 'blm riots',
    'capitol riot', 'insurrection',
    'impeach', 'impeachment',
    'trump 2024', 'biden crime family',
    'fake news', 'mainstream media lies',
    '選舉舞弊', '陰謀論', '政治鬥爭',
    '政變', '煽動', '暴動'
]

def is_content_blocked(title: str) -> bool:
    """檢查內容是否應被過濾"""
    if not title:
        return True
    
    title_lower = title.lower()
    
    for keyword in BLOCKED_KEYWORDS:
        if keyword.lower() in title_lower:
            print(f"[過濾] 阻擋敏感內容: \"{title[:50]}...\" (關鍵字: {keyword})")
            return True
    
    for keyword in SENSITIVE_POLITICS:
        if keyword.lower() in title_lower:
            print(f"[過濾] 阻擋政治敏感內容: \"{title[:50]}...\" (關鍵字: {keyword})")
            return True
    
    return False

def fetch_hacker_news(limit: int = 15) -> List[Dict]:
    """抓取 Hacker News 熱門故事"""
    try:
        print("[Hacker News] 抓取熱門故事...")
        response = requests.get('https://hacker-news.firebaseio.com/v0/topstories.json', timeout=10)
        ids = response.json()[:limit]
        
        stories = []
        for id in ids:
            try:
                story_resp = requests.get(f'https://hacker-news.firebaseio.com/v0/item/{id}.json', timeout=5)
                story = story_resp.json()
                
                if story and story.get('title') and not is_content_blocked(story['title']):
                    stories.append({
                        'title': story['title'],
                        'url': story.get('url', f"https://news.ycombinator.com/item?id={story['id']}"),
                        'source': 'Hacker News',
                        'score': story.get('score', 0)
                    })
            except Exception as e:
                print(f"[Hacker News] 抓取故事 {id} 失敗: {e}")
        
        print(f"[Hacker News] 成功抓取 {len(stories)} 則故事")
        return stories
    except Exception as e:
        print(f"[Hacker News] 抓取失敗: {e}")
        return []

def fetch_hacker_news_ai(limit: int = 15) -> List[Dict]:
    """抓取 Hacker News AI 相關故事"""
    try:
        print("[Hacker News AI] 抓取 AI 相關故事...")
        response = requests.get('https://hacker-news.firebaseio.com/v0/topstories.json', timeout=10)
        ids = response.json()[:50]
        
        ai_keywords = [
            'ai', 'llm', 'gpt', 'machine learning', 'neural', 
            'chatbot', 'openai', 'claude', 'deep learning',
            'text to speech', 'tts', 'speech synthesis', 'voice cloning',
            'stable diffusion', 'midjourney', 'dall-e', 'image generation',
            'embedding', 'transformer', 'bert', 'diffusion model',
            'artificial intelligence', 'nlp', 'computer vision',
            'reinforcement learning', 'gan', 'autoencoder',
            'langchain', 'hugging face', 'anthropic', 'mistral',
            'gemini', 'copilot', 'codex', 'whisper',
            'retro', 'rag', 'fine-tuning', 'prompt engineering',
            'multimodal', 'vision language model', 'vlm',
            'voice recognition', 'speech to text', 'stt',
            'sora', 'runway', 'pika', 'video generation',
            'musicgen', 'audio generation', 'audiocraft'
        ]
        
        ai_stories = []
        for id in ids:
            if len(ai_stories) >= limit:
                break
            
            try:
                story_resp = requests.get(f'https://hacker-news.firebaseio.com/v0/item/{id}.json', timeout=5)
                story = story_resp.json()
                
                if story and story.get('title'):
                    title_lower = story['title'].lower()
                    
                    if any(k in title_lower for k in ai_keywords) and not is_content_blocked(story['title']):
                        ai_stories.append({
                            'title': story['title'],
                            'url': story.get('url', f"https://news.ycombinator.com/item?id={story['id']}"),
                            'source': 'Hacker News AI',
                            'score': story.get('score', 0)
                        })
            except Exception as e:
                print(f"[Hacker News AI] 抓取故事 {id} 失敗: {e}")
        
        print(f"[Hacker News AI] 成功抓取 {len(ai_stories)} 則 AI 相關故事")
        return ai_stories
    except Exception as e:
        print(f"[Hacker News AI] 抓取失敗: {e}")
        return []

def fetch_rss(url: str, source: str, limit: int = 7) -> List[Dict]:
    """抓取 RSS feed"""
    try:
        print(f"[RSS] 抓取 {source}...")
        response = requests.get(url, timeout=10)
        root = ET.fromstring(response.content)
        
        items = []
        for item in root.findall('.//item')[:limit]:
            title_elem = item.find('title')
            link_elem = item.find('link')
            
            if title_elem is not None and link_elem is not None:
                title = title_elem.text
                if title and not is_content_blocked(title):
                    items.append({
                        'title': title,
                        'url': link_elem.text,
                        'source': source
                    })
        
        print(f"[RSS] {source} 成功抓取 {len(items)} 則文章")
        return items
    except Exception as e:
        print(f"[RSS] {source} 抓取失敗: {e}")
        return []

def fetch_steam_news(limit: int = 7) -> List[Dict]:
    """抓取 Steam 新聞"""
    return fetch_rss('https://store.steampowered.com/feeds/news.xml', 'Steam News', limit)

def main():
    """主函式"""
    print("=" * 50)
    print("Twitter Content Fetcher - 開始執行")
    print(f"時間: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)
    
    all_content = {}
    
    all_content['tech'] = fetch_hacker_news(15)
    all_content['ai'] = fetch_hacker_news_ai(15)
    
    all_content['news'] = fetch_rss('https://feeds.bbci.co.uk/news/world/rss.xml', 'BBC World', 7)
    all_content['art'] = fetch_rss('https://www.creativebloq.com/feed', 'Creative Bloq', 7)
    all_content['science'] = fetch_rss('https://www.sciencedaily.com/rss/all.xml', 'Science Daily', 7)
    all_content['gaming'] = fetch_rss('https://www.polygon.com/rss/index.xml', 'Polygon', 7)
    all_content['steam'] = fetch_steam_news(7)
    all_content['github'] = fetch_rss('https://github.blog/feed/', 'GitHub Blog', 7)
    
    metadata = {
        'last_updated': datetime.now().isoformat(),
        'total_items': sum(len(items) for items in all_content.values())
    }
    
    output = {
        'metadata': metadata,
        'content': all_content
    }
    
    os.makedirs('data', exist_ok=True)
    output_file = 'data/twitter_content_cache.json'
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2, separators=(',', ': '))
    
    print("=" * 50)
    print(f"[OK] 完成！總共抓取 {metadata['total_items']} 則內容")
    print(f"[OK] 已儲存至 {output_file}")
    print("=" * 50)
    
    for category, items in all_content.items():
        print(f"\n[{category.upper()}]: {len(items)} 則")
        for item in items[:3]:
            try:
                print(f"  - {item['title'][:60]}...")
            except:
                print(f"  - {item['title'][:50].encode('ascii', 'ignore').decode('ascii')}...")

if __name__ == '__main__':
    main()
