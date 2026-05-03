import re

with open("/Users/bujin/Documents/Projects/Urgent/急救侠_H5_Demo_v17.html", "r") as f:
    content = f.read()

# Remove comments and script/style contents for naive check
content = re.sub(r'<!--.*?-->', '', content, flags=re.DOTALL)
content = re.sub(r'<style>.*?</style>', '', content, flags=re.DOTALL)
# Don't remove script, since we want to see if it's closed

tags = re.findall(r'<([a-zA-Z0-9]+)[^>]*>', content)
close_tags = re.findall(r'</([a-zA-Z0-9]+)>', content)

from collections import Counter
open_counts = Counter(tags)
close_counts = Counter(close_tags)

# Self-closing tags
self_closing = {'meta', 'link', 'img', 'br', 'hr', 'input', 'use', 'rect', 'circle', 'path', 'svg', 'symbol'}

for tag in open_counts.keys() | close_counts.keys():
    if tag.lower() in self_closing: continue
    if tag.lower() == 'html' or tag.lower() == 'body' or tag.lower() == 'head': continue
    if open_counts[tag] != close_counts[tag]:
        print(f"Mismatch {tag}: {open_counts[tag]} open, {close_counts[tag]} close")

