import sys

with open('../急救侠_H5_Demo_v17.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

body_content = "".join(lines[3542:6104])

with open('index.html', 'r', encoding='utf-8') as f:
    index_content = f.read()

start_idx = index_content.find('<body>') + len('<body>\n')
end_idx = index_content.find('<script src="assets/app.js"></script>')

if start_idx > len('<body>\n') and end_idx != -1:
    new_content = index_content[:start_idx] + body_content + '\n' + index_content[end_idx:]
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Updated index.html successfully.")
else:
    print("Could not find boundaries in index.html")
