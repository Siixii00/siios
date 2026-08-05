#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bilibili 內容更新器 - 多分類版
每小時從 Bilibili 獲取不同分類的熱門影片
"""

import json
import time
import requests
from datetime import datetime
import os
import sys

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

DATA_DIR = 'data'

CATEGORIES = {
    'recommend': {
        'file': 'bilibili_videos.json',
        'apis': [
            'https://api.bilibili.com/x/web-interface/popular?ps=50',
            'https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all'
        ],
        'keywords': []
    },
    'anime': {
        'file': 'bilibili_anime.json',
        'apis': ['https://api.bilibili.com/x/web-interface/ranking/v2?rid=1&type=all'],
        'keywords': ['動漫', '番劇']
    },
    'live': {
        'file': 'bilibili_live.json',
        'apis': ['https://api.bilibili.com/xlive/web-interface/v1/second/getList?platform=web&page=1&page_size=50'],
        'keywords': ['直播']
    },
    'hot': {
        'file': 'bilibili_hot.json',
        'apis': [
            'https://api.bilibili.com/x/web-interface/popular?ps=50&pn=1',
            'https://api.bilibili.com/x/web-interface/popular?ps=50&pn=2',
        ],
        'keywords': []
    },
    'games': {
        'file': 'bilibili_games.json',
        'apis': ['https://api.bilibili.com/x/web-interface/ranking/v2?rid=4&type=all'],
        'keywords': ['遊戲']
    }
}
def get_headers():
    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com/',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    }

def fetch_api(url):
    try:
        response = requests.get(url, headers=get_headers(), timeout=15)
        if response.status_code == 200:
            data = response.json()
            if data.get('code') == 0:
                return data
            else:
                print(f'  [X] API 錯誤: {data.get("message", "unknown")}')
        else:
            print(f'  [X] HTTP 錯誤: {response.status_code}')
    except Exception as e:
        print(f'  [X] 獲取失敗: {e}')
    return None

def parse_videos(data):
    videos = []
    if not data or 'data' not in data:
        return videos
    
    items = data['data'].get('list', [])
    for item in items:
        videos.append({
            'bvid': item.get('bvid', ''),
            'title': item.get('title', ''),
            'cover': item.get('pic', ''),
            'views': item.get('stat', {}).get('view', 0),
            'danmu': item.get('stat', {}).get('danmaku', 0),
            'duration': item.get('duration', 0),
            'owner': item.get('owner', {}).get('name', ''),
            'tag': item.get('tname', '熱門'),
        })
    return videos

def fetch_search(keyword):
    url = f'https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword={keyword}&page=1&page_size=30'
    try:
        data = fetch_api(url)
        if data and data.get('data', {}).get('result'):
            videos = []
            for item in data['data']['result']:
                videos.append({
                    'bvid': item.get('bvid', ''),
                    'title': item.get('title', '').replace('<em class="keyword">', '').replace('</em>', ''),
                    'cover': item.get('pic', ''),
                    'views': item.get('play', 0),
                    'danmu': item.get('video_review', 0),
                    'owner': item.get('author', ''),
                    'tag': item.get('typename', keyword),
                })
            return videos
    except Exception as e:
        print(f'  ✗ 搜索失敗: {e}')
    return []

def save_category(name, videos, filename):
    os.makedirs(DATA_DIR, exist_ok=True)
    filepath = os.path.join(DATA_DIR, filename)
    output = {
        'category': name,
        'videos': videos,
        'count': len(videos),
        'updated_at': datetime.now().isoformat(),
    }
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2, separators=(',', ': '))
    print(f'[OK] 已保存 {len(videos)} 部影片到 {filepath}')

def update_category(name, config):
    print(f'\n正在更新 {name}...')
    all_videos = []
    
    for api_url in config['apis']:
        print(f'  正在獲取 {api_url}...')
        data = fetch_api(api_url)
        if data:
            videos = parse_videos(data)
            all_videos.extend(videos)
        time.sleep(1)
    
    for keyword in config['keywords']:
        videos = fetch_search(keyword)
        all_videos.extend(videos)
        time.sleep(1)
    
    seen = set()
    unique = []
    for v in all_videos:
        if v['bvid'] and v['bvid'] not in seen:
            seen.add(v['bvid'])
            unique.append(v)
    
    save_category(name, unique, config['file'])
    return len(unique)

def main():
    print('=' * 60)
    print('Bilibili 內容更新器 - 多分類版')
    print(f'時間: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print('=' * 60)
    
    total = 0
    for name, config in CATEGORIES.items():
        total += update_category(name, config)
        time.sleep(2)
    
    print('\n' + '=' * 60)
    print(f'更新完成！總共 {total} 部影片')
    print('=' * 60)

if __name__ == '__main__':
    main()