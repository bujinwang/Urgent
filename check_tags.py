with open("/Users/bujin/Documents/Projects/Urgent/急救侠_H5_Demo_v17.html", "r") as f:
    content = f.read()

style_start = content.find("<style>")
style_end = content.find("</style>")

css_content = content[style_start+7:style_end]

if "<" in css_content:
    print("Found < in CSS")
    for i, line in enumerate(css_content.split('\n')):
        if "<" in line:
            print(f"Line {i+1}: {line}")
