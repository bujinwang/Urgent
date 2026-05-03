with open("/Users/bujin/Documents/Projects/Urgent/急救侠_H5_Demo_v17.html", "r") as f:
    lines = f.readlines()

style_start = -1
style_end = -1
for i, line in enumerate(lines):
    if "<style>" in line: style_start = i
    if "</style>" in line: style_end = i

css_content = "".join(lines[style_start+1:style_end])

in_single = False
in_double = False
in_comment = False

for i in range(len(css_content)):
    if css_content[i:i+2] == "/*" and not in_comment and not in_single and not in_double:
        in_comment = True
        continue
    if css_content[i:i+2] == "*/" and in_comment:
        in_comment = False
        continue
    
    if in_comment: continue

    char = css_content[i]
    prev_char = css_content[i-1] if i > 0 else ""

    if char == "'" and not in_double and prev_char != "\\":
        in_single = not in_single
        if in_single: last_single = i
    elif char == '"' and not in_single and prev_char != "\\":
        in_double = not in_double
        if in_double: last_double = i

if in_single: print(f"Unclosed single quote starting at {last_single}: {css_content[last_single:last_single+50]}")
if in_double: print(f"Unclosed double quote starting at {last_double}: {css_content[last_double:last_double+50]}")
print("Quote check done.")
