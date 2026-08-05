#!/usr/bin/env python3
import json
import sys
import os

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

def validate_json(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if 'videos' in data:
            print(f'[OK] {filepath}')
            print(f'  Category: {data.get("category", "N/A")}')
            print(f'  Videos: {len(data["videos"])}')
            if data['videos']:
                first = data['videos'][0]
                print(f'  Sample title: {first["title"][:50]}')
        elif 'content' in data:
            print(f'[OK] {filepath}')
            print(f'  Total items: {data["metadata"]["total_items"]}')
            print(f'  Last updated: {data["metadata"]["last_updated"]}')
        else:
            print(f'[OK] {filepath} - Valid JSON')
        
        return True
    except Exception as e:
        print(f'[ERROR] {filepath}: {e}')
        return False

if __name__ == '__main__':
    files = [
        'data/bilibili_videos.json',
        'data/bilibili_anime.json',
        'data/bilibili_games.json',
        'data/bilibili_hot.json',
        'data/bilibili_live.json',
        'data/twitter_content_cache.json'
    ]
    
    all_ok = True
    for f in files:
        if os.path.exists(f):
            if not validate_json(f):
                all_ok = False
        else:
            print(f'[SKIP] {f} - File not found')
    
    sys.exit(0 if all_ok else 1)