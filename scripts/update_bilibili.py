#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bilibili 熱門內容更新器
定期從 Bilibili 獲取熱門影片並保存到 JSON 文件

使用方法：
1. 安裝依賴：pip install requests
2. 運行：python update_bilibili.py
3. 設置定時任務（可選）：
   - Windows: 任務計劃程序
   - Linux/Mac: crontab
"""

import json
import time
import requests
from datetime import datetime
import os

# 輸出文件路徑（相對於 siios 目錄）
OUTPUT_FILE = 'data/bilibili_videos.json'

# Bilibili API 端點
API_URLS = {
    'popular': 'https://api.bilibili.com/x/web-interface/popular?ps=50',
    'ranking': 'https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all',
}

# 搜索關鍵詞（可選）
SEARCH_KEYWORDS = ['遊戲', '動漫', '音樂', '科技', '生活', '美食']

def get_headers():
    """返回模擬瀏覽器的 headers"""
    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com/',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    }

def fetch_popular():
    """獲取熱門影片"""
    print('正在獲取熱門影片...')
    
    try:
        response = requests.get(API_URLS['popular'], headers=get_headers(), timeout=10)
        data = response.json()
        
        if data['code'] == 0:
            videos = []
            for item in data['data']['list']:
                videos.append({
                    'bvid': item['bvid'],
                    'title': item['title'],
                    'cover': item['pic'],
                    'views': item['stat']['view'],
                    'danmu': item['stat']['danmaku'],
                    'duration': item['duration'],
                    'owner': item['owner']['name'],
                    'tag': item.get('tname', '熱門'),
                    'source': 'popular'
                })
            print(f'✓ 成功獲取 {len(videos)} 部熱門影片')
            return videos
        else:
            print(f'✗ API 錯誤: {data.get("message", "unknown")}')
            return []
    except Exception as e:
        print(f'✗ 獲取失敗: {e}')
        return []

def fetch_ranking():
    """獲取排行榜影片"""
    print('正在獲取排行榜影片...')
    
    try:
        response = requests.get(API_URLS['ranking'], headers=get_headers(), timeout=10)
        data = response.json()
        
        if data['code'] == 0:
            videos = []
            for item in data['data']['list']:
                videos.append({
                    'bvid': item['bvid'],
                    'title': item['title'],
                    'cover': item['pic'],
                    'views': item['stat']['view'],
                    'danmu': item['stat']['danmaku'],
                    'duration': item['duration'],
                    'owner': item['owner']['name'],
                    'tag': item.get('tname', '排行榜'),
                    'source': 'ranking'
                })
            print(f'✓ 成功獲取 {len(videos)} 部排行榜影片')
            return videos
        else:
            print(f'✗ API 錯誤: {data.get("message", "unknown")}')
            return []
    except Exception as e:
        print(f'✗ 獲取失敗: {e}')
        return []

def fetch_search(keyword):
    """搜索影片（可選）"""
    print(f'正在搜索: {keyword}...')
    
    search_url = f'https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword={keyword}&page=1&page_size=20'
    
    try:
        response = requests.get(search_url, headers=get_headers(), timeout=10)
        data = response.json()
        
        if data['code'] == 0 and data.get('data', {}).get('result'):
            videos = []
            for item in data['data']['result']:
                videos.append({
                    'bvid': item['bvid'],
                    'title': item['title'].replace('<em class="keyword">', '').replace('</em>', ''),
                    'cover': item['pic'],
                    'views': item.get('play', 0),
                    'danmu': item.get('video_review', 0),
                    'duration': item.get('duration', 0),
                    'owner': item.get('author', ''),
                    'tag': item.get('typename', keyword),
                    'source': 'search'
                })
            print(f'✓ 成功搜索到 {len(videos)} 部影片')
            return videos
        else:
            print(f'✗ 搜索失敗')
            return []
    except Exception as e:
        print(f'✗ 搜索失敗: {e}')
        return []

def merge_and_deduplicate(all_videos):
    """合併並去重"""
    seen = set()
    unique = []
    
    for video in all_videos:
        if video['bvid'] not in seen:
            seen.add(video['bvid'])
            unique.append(video)
    
    return unique

def save_to_file(videos):
    """保存到 JSON 文件"""
    # 確保目錄存在
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    output = {
        'videos': videos,
        'count': len(videos),
        'updated_at': datetime.now().isoformat(),
        'sources': ['popular', 'ranking']
    }
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f'✓ 已保存 {len(videos)} 部影片到 {OUTPUT_FILE}')

def main():
    """主函數"""
    print('=' * 50)
    print('Bilibili 熱門內容更新器')
    print(f'時間: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print('=' * 50)
    
    all_videos = []
    
    # 獲取熱門
    popular = fetch_popular()
    all_videos.extend(popular)
    time.sleep(1)
    
    # 獲取排行榜
    ranking = fetch_ranking()
    all_videos.extend(ranking)
    time.sleep(1)
    
    # 搜索（可選）
    # for keyword in SEARCH_KEYWORDS[:2]:  # 只搜索前 2 個
    #     search = fetch_search(keyword)
    #     all_videos.extend(search)
    #     time.sleep(2)
    
    # 合併去重
    unique_videos = merge_and_deduplicate(all_videos)
    
    # 保存
    save_to_file(unique_videos)
    
    print('=' * 50)
    print('更新完成！')
    print('=' * 50)

if __name__ == '__main__':
    main()