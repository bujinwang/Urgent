with open('index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if '<div class="page" id="news">' in line:
        skip = True
    if '<div class="page" id="train">' in line:
        skip = False
    
    if not skip:
        new_lines.append(line)

with open('index.html', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
