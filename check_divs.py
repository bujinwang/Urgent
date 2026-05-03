with open("/Users/bujin/Documents/Projects/Urgent/急救侠_H5_Demo_v17.html", "r") as f:
    content = f.read()

body_start = content.find("<body>")
body_end = content.find("</body>")

html_content = content[body_start:body_end]

open_divs = html_content.count("<div")
close_divs = html_content.count("</div")

print(f"Open divs: {open_divs}")
print(f"Close divs: {close_divs}")

open_spans = html_content.count("<span")
close_spans = html_content.count("</span")

print(f"Open spans: {open_spans}")
print(f"Close spans: {close_spans}")
